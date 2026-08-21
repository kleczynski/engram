import { NextResponse } from "next/server";

import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  GraphPayload,
} from "@/lib/graph/types";
import { observabilityCluster } from "@/lib/graph/weights";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [pagesResult, edgesResult] = await Promise.all([
    supabase
      .from("pages")
      .select(
        "id, notion_id, title, parent_notion_id, hub_score, notion_url, lucid_url, last_edited_time, last_synced_at",
      )
      .order("title"),
    supabase
      .from("edges")
      .select("id, source_page_id, target_page_id, edge_type"),
  ]);

  if (pagesResult.error || edgesResult.error) {
    const message = pagesResult.error?.message ?? edgesResult.error?.message;
    console.error("[api/graph]", message);

    return NextResponse.json(
      { error: "Could not load the graph." },
      { status: 500 },
    );
  }

  const pages = pagesResult.data ?? [];
  const idByNotionId = new Map(pages.map((page) => [page.notion_id, page.id]));

  const edges: GraphEdge[] = (edgesResult.data ?? [])
    .filter((edge) => edge.source_page_id && edge.target_page_id)
    .map((edge) => ({
      id: edge.id,
      source: edge.source_page_id!,
      target: edge.target_page_id!,
      type: edge.edge_type as EdgeType,
    }));

  const degree = new Map<string, number>();
  const hierarchyChildren = new Map<string, number>();

  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);

    if (edge.type === "hierarchy") {
      hierarchyChildren.set(
        edge.source,
        (hierarchyChildren.get(edge.source) ?? 0) + 1,
      );
    }
  }

  const parentOf = new Map<string, string | null>();
  for (const page of pages) {
    const parentId = page.parent_notion_id
      ? (idByNotionId.get(page.parent_notion_id) ?? null)
      : null;
    parentOf.set(page.id, parentId);
  }

  const depthOf = new Map<string, number>();
  const resolveDepth = (id: string, seen = new Set<string>()): number => {
    const cached = depthOf.get(id);
    if (cached !== undefined) return cached;
    if (seen.has(id)) return 0;

    seen.add(id);
    const parentId = parentOf.get(id) ?? null;
    const depth = parentId ? resolveDepth(parentId, seen) + 1 : 0;
    depthOf.set(id, depth);
    return depth;
  };

  const cluster = observabilityCluster(
    pages.map((page) => ({
      id: page.id,
      parentId: parentOf.get(page.id) ?? null,
      title: page.title,
    })),
  );

  const nodes: GraphNode[] = pages.map((page) => ({
    id: page.id,
    notionId: page.notion_id,
    title: page.title,
    depth: resolveDepth(page.id),
    parentId: parentOf.get(page.id) ?? null,
    notionUrl: page.notion_url,
    lucidUrl: page.lucid_url,
    hubScore: page.hub_score ?? 1,
    edgeCount: degree.get(page.id) ?? 0,
    childCount: hierarchyChildren.get(page.id) ?? 0,
    lastEditedTime: page.last_edited_time,
    observability: cluster.has(page.id),
  }));

  const lastSyncedAt = pages.reduce<string | null>((latest, page) => {
    if (!page.last_synced_at) return latest;
    return !latest || page.last_synced_at > latest ? page.last_synced_at : latest;
  }, null);

  const payload: GraphPayload = {
    rootId: nodes.find((node) => node.parentId === null)?.id ?? null,
    nodes,
    edges,
    lastSyncedAt,
  };

  return NextResponse.json(payload);
}
