import type { SyncSummary } from "@/lib/graph/types";
import { descendantCounts, hubScore } from "@/lib/graph/weights";
import { getRootPageId } from "@/lib/notion/client";
import { crawlSubtree } from "@/lib/notion/crawl";
import { contentHash, relationHash } from "@/lib/notion/hash";
import type { TablesInsert } from "@/utils/supabase/database.types";
import { createAdminClient } from "@/utils/supabase/server";

const CHUNK_SIZE = 200;
/** Edge types owned by the sync. AI edge types are left untouched. */
const SYNCED_EDGE_TYPES = ["hierarchy", "relation"];

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function edgeKey(source: string, target: string, type: string): string {
  return `${source}|${target}|${type}`;
}

export async function syncNotionSubtree(
  options: { deadline?: number } = {},
): Promise<SyncSummary> {
  const startedAt = Date.now();
  const supabase = createAdminClient();

  const crawl = await crawlSubtree(getRootPageId(), { deadline: options.deadline });
  const warnings = [...crawl.warnings];

  const { data: existingRows, error: existingError } = await supabase
    .from("pages")
    .select("id, notion_id, content_hash, relation_hash");

  if (existingError) {
    throw new Error(`Could not read existing pages: ${existingError.message}`);
  }

  const existing = new Map(
    (existingRows ?? []).map((row) => [row.notion_id, row] as const),
  );

  const descendants = descendantCounts(
    crawl.pages.map((page) => ({
      id: page.notionId,
      parentId: page.parentNotionId,
    })),
  );

  const syncedAt = new Date().toISOString();
  let pagesAdded = 0;
  let pagesChanged = 0;
  let pagesUnchanged = 0;

  const pageRows: TablesInsert<"pages">[] = crawl.pages.map((page) => {
    const content = contentHash({ title: page.title, excerpt: page.excerpt });
    const relations = relationHash(page.relationIds);
    const previous = existing.get(page.notionId);

    if (!previous) {
      pagesAdded += 1;
    } else if (
      previous.content_hash !== content ||
      previous.relation_hash !== relations
    ) {
      pagesChanged += 1;
    } else {
      pagesUnchanged += 1;
    }

    return {
      notion_id: page.notionId,
      title: page.title,
      content_hash: content,
      relation_hash: relations,
      parent_notion_id: page.parentNotionId,
      notion_url: page.notionUrl,
      lucid_url: page.lucidUrl,
      hub_score: hubScore(descendants.get(page.notionId) ?? 0),
      last_edited_time: page.lastEditedTime,
      last_synced_at: syncedAt,
    };
  });

  for (const batch of chunk(pageRows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from("pages")
      .upsert(batch, { onConflict: "notion_id" });

    if (error) throw new Error(`Could not upsert pages: ${error.message}`);
  }

  // Re-read so newly inserted rows get their generated ids.
  const { data: idRows, error: idError } = await supabase
    .from("pages")
    .select("id, notion_id");

  if (idError) {
    throw new Error(`Could not resolve page ids: ${idError.message}`);
  }

  const idByNotionId = new Map(
    (idRows ?? []).map((row) => [row.notion_id, row.id] as const),
  );

  const desiredEdges = new Map<string, TablesInsert<"edges">>();

  for (const page of crawl.pages) {
    const pageId = idByNotionId.get(page.notionId);
    if (!pageId) continue;

    if (page.parentNotionId) {
      const parentId = idByNotionId.get(page.parentNotionId);
      if (parentId && parentId !== pageId) {
        desiredEdges.set(edgeKey(parentId, pageId, "hierarchy"), {
          source_page_id: parentId,
          target_page_id: pageId,
          edge_type: "hierarchy",
        });
      }
    }

    // Relation targets outside the crawled subtree have no node to attach to.
    for (const relationNotionId of page.relationIds) {
      const relatedId = idByNotionId.get(relationNotionId);
      if (!relatedId || relatedId === pageId) continue;

      desiredEdges.set(edgeKey(pageId, relatedId, "relation"), {
        source_page_id: pageId,
        target_page_id: relatedId,
        edge_type: "relation",
      });
    }
  }

  for (const batch of chunk([...desiredEdges.values()], CHUNK_SIZE)) {
    const { error } = await supabase.from("edges").upsert(batch, {
      onConflict: "source_page_id,target_page_id,edge_type",
      ignoreDuplicates: true,
    });

    if (error) throw new Error(`Could not upsert edges: ${error.message}`);
  }

  const { data: currentEdges, error: edgeReadError } = await supabase
    .from("edges")
    .select("id, source_page_id, target_page_id, edge_type")
    .in("edge_type", SYNCED_EDGE_TYPES);

  if (edgeReadError) {
    throw new Error(`Could not read edges: ${edgeReadError.message}`);
  }

  const staleEdgeIds = (currentEdges ?? [])
    .filter((edge) => {
      if (!edge.source_page_id || !edge.target_page_id) return true;
      return !desiredEdges.has(
        edgeKey(edge.source_page_id, edge.target_page_id, edge.edge_type),
      );
    })
    .map((edge) => edge.id);

  for (const batch of chunk(staleEdgeIds, CHUNK_SIZE)) {
    const { error } = await supabase.from("edges").delete().in("id", batch);
    if (error) throw new Error(`Could not delete stale edges: ${error.message}`);
  }

  let pagesRemoved = 0;

  if (crawl.truncated) {
    warnings.push(
      "Crawl was incomplete, so pages missing from this run were left in place.",
    );
  } else {
    const crawledIds = new Set(crawl.pages.map((page) => page.notionId));
    const vanished = (idRows ?? [])
      .map((row) => row.notion_id)
      .filter((notionId) => !crawledIds.has(notionId));

    for (const batch of chunk(vanished, CHUNK_SIZE)) {
      const { error } = await supabase
        .from("pages")
        .delete()
        .in("notion_id", batch);

      if (error) {
        throw new Error(`Could not remove deleted pages: ${error.message}`);
      }
      pagesRemoved += batch.length;
    }
  }

  const { error: logError } = await supabase.from("sync_log").insert({
    synced_at: syncedAt,
    pages_added: pagesAdded,
    pages_changed: pagesChanged,
  });

  if (logError) warnings.push(`Could not write sync_log: ${logError.message}`);

  return {
    pagesAdded,
    pagesChanged,
    pagesUnchanged,
    pagesRemoved,
    edgesWritten: desiredEdges.size,
    notionRequests: crawl.requestCount,
    truncated: crawl.truncated,
    warnings: [...new Set(warnings)],
    durationMs: Date.now() - startedAt,
  };
}
