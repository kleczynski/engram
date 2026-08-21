import {
  isFullBlock,
  isFullPage,
  type BlockObjectResponse,
  type PageObjectResponse,
  type RichTextItemResponse,
} from "@notionhq/client";

import { getNotionClient, notionPageUrl, notionQueue } from "@/lib/notion/client";

export const UNTITLED = "Untitled";

const EXCERPT_LIMIT = 2000;
const DEFAULT_MAX_PAGES = 400;
const DEFAULT_MAX_DEPTH = 8;
/** Caps how deep we descend into containers (toggles, columns) per page. */
const BLOCK_REQUESTS_PER_PAGE = 20;
const LUCID_HOST = "lucid.app";

export type CrawledPage = {
  notionId: string;
  title: string;
  parentNotionId: string | null;
  notionUrl: string;
  lucidUrl: string | null;
  lastEditedTime: string | null;
  excerpt: string;
  relationIds: string[];
  depth: number;
};

export type CrawlResult = {
  rootNotionId: string;
  pages: CrawledPage[];
  /** True when a budget stopped the crawl, meaning results are incomplete. */
  truncated: boolean;
  warnings: string[];
  requestCount: number;
};

export type CrawlOptions = {
  maxPages?: number;
  maxDepth?: number;
  /** Epoch ms after which the crawl stops and reports itself truncated. */
  deadline?: number;
};

type QueueEntry = {
  notionId: string;
  title: string;
  parentNotionId: string | null;
  lastEditedTime: string | null;
  depth: number;
};

/** Blocks whose `type` payload we must not treat as inline content. */
const PAGE_LIKE_BLOCKS = new Set(["child_page", "child_database"]);

/**
 * Containers that can hold a nested subpage, so they are always walked. Every
 * other parent block (list items, mostly) only contributes text, and walking
 * those dominated crawl time — one page spent 15 of its 16 requests on
 * `bulleted_list_item` children that held no pages at all.
 */
const PAGE_CONTAINER_BLOCKS = new Set([
  "toggle",
  "column_list",
  "column",
  "synced_block",
  "tab",
  "callout",
  "quote",
  "table",
]);

function blockPayload(block: BlockObjectResponse): Record<string, unknown> {
  const payload = (block as unknown as Record<string, unknown>)[block.type];
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : {};
}

function blockRichText(block: BlockObjectResponse): RichTextItemResponse[] {
  const richText = blockPayload(block).rich_text;
  return Array.isArray(richText) ? (richText as RichTextItemResponse[]) : [];
}

function blockUrl(block: BlockObjectResponse): string | null {
  const url = blockPayload(block).url;
  return typeof url === "string" ? url : null;
}

function pageTitle(page: PageObjectResponse): string {
  for (const property of Object.values(page.properties)) {
    if (property.type === "title") {
      const title = property.title.map((item) => item.plain_text).join("").trim();
      if (title) return title;
    }
  }

  return UNTITLED;
}

type PageContent = {
  excerpt: string;
  lucidUrl: string | null;
  childPages: QueueEntry[];
  childDatabaseIds: string[];
  warnings: string[];
  requests: number;
};

type BlockCursor = { id: string; container: boolean };

/**
 * Reads one page's blocks, descending into container blocks but never into
 * `child_page` / `child_database` — those are separate nodes in the graph.
 */
async function readPageContent(
  page: QueueEntry,
  options: { deadline?: number },
): Promise<PageContent> {
  const notion = getNotionClient();
  const content: PageContent = {
    excerpt: "",
    lucidUrl: null,
    childPages: [],
    childDatabaseIds: [],
    warnings: [],
    requests: 0,
  };

  const excerptParts: string[] = [];
  let excerptLength = 0;
  let requests = 0;
  const blockQueue: BlockCursor[] = [{ id: page.notionId, container: true }];

  while (blockQueue.length > 0 && requests < BLOCK_REQUESTS_PER_PAGE) {
    if (options.deadline && Date.now() > options.deadline) break;

    const next = blockQueue.shift()!;
    // A non-container was queued only for its text; skip it once we have enough.
    if (!next.container && excerptLength >= EXCERPT_LIMIT) continue;

    const blockId = next.id;
    let cursor: string | undefined;

    do {
      requests += 1;

      let response;
      try {
        response = await notionQueue.run(() =>
          notion.blocks.children.list({
            block_id: blockId,
            page_size: 100,
            start_cursor: cursor,
          }),
        );
      } catch (error) {
        content.warnings.push(
          `Could not list blocks of ${blockId}: ${errorMessage(error)}`,
        );
        break;
      }

      for (const block of response.results) {
        if (!isFullBlock(block) || block.in_trash) continue;

        if (block.type === "child_page") {
          content.childPages.push({
            notionId: block.id,
            title: block.child_page.title.trim() || UNTITLED,
            parentNotionId: page.notionId,
            lastEditedTime: block.last_edited_time,
            depth: page.depth + 1,
          });
          continue;
        }

        if (block.type === "child_database") {
          content.childDatabaseIds.push(block.id);
          continue;
        }

        if (excerptLength < EXCERPT_LIMIT) {
          const text = blockRichText(block)
            .map((item) => item.plain_text)
            .join("");
          if (text) {
            excerptParts.push(text);
            excerptLength += text.length;
          }
        }

        if (!content.lucidUrl) {
          const url = blockUrl(block);
          if (url?.includes(LUCID_HOST)) content.lucidUrl = url;
        }

        if (block.has_children && !PAGE_LIKE_BLOCKS.has(block.type)) {
          const container = PAGE_CONTAINER_BLOCKS.has(block.type);
          if (container || excerptLength < EXCERPT_LIMIT) {
            blockQueue.push({ id: block.id, container });
          }
        }
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor && requests < BLOCK_REQUESTS_PER_PAGE);
  }

  content.excerpt = excerptParts.join("\n").slice(0, EXCERPT_LIMIT);
  content.requests = requests;
  return content;
}

async function collectRelationIds(
  pageId: string,
  propertyId: string,
): Promise<string[]> {
  const notion = getNotionClient();
  const ids: string[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionQueue.run(() =>
      notion.pages.properties.retrieve({
        page_id: pageId,
        property_id: propertyId,
        page_size: 100,
        start_cursor: cursor,
      }),
    );

    if (response.object !== "list") break;

    for (const item of response.results) {
      if (item.type === "relation") ids.push(item.relation.id);
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return ids;
}

/**
 * Relations only exist on data source rows, never on subpages, and a page
 * response truncates them at 25 — refetch the property when it has more.
 */
export async function readRelationIds(page: PageObjectResponse): Promise<string[]> {
  const ids: string[] = [];

  for (const property of Object.values(page.properties)) {
    if (property.type !== "relation") continue;

    const hasMore = (property as { has_more?: boolean }).has_more === true;
    if (hasMore) {
      ids.push(...(await collectRelationIds(page.id, property.id)));
    } else {
      ids.push(...property.relation.map((relation) => relation.id));
    }
  }

  return ids;
}

/** Data source rows become graph nodes parented to the containing page. */
async function readDatabaseRows(
  databaseBlockId: string,
  parentNotionId: string,
  depth: number,
): Promise<{ pages: CrawledPage[]; warnings: string[]; requests: number }> {
  const notion = getNotionClient();
  const warnings: string[] = [];
  const pages: CrawledPage[] = [];
  let requests = 1;

  let database;
  try {
    database = await notionQueue.run(() =>
      notion.databases.retrieve({ database_id: databaseBlockId }),
    );
  } catch (error) {
    warnings.push(
      `Could not retrieve database ${databaseBlockId} (is it shared with the integration?): ${errorMessage(error)}`,
    );
    return { pages, warnings, requests };
  }

  if (!("data_sources" in database)) {
    warnings.push(`Database ${databaseBlockId} returned no data sources.`);
    return { pages, warnings, requests };
  }

  for (const dataSource of database.data_sources) {
    let cursor: string | undefined;

    do {
      let response;
      requests += 1;
      try {
        response = await notionQueue.run(() =>
          notion.dataSources.query({
            data_source_id: dataSource.id,
            page_size: 100,
            start_cursor: cursor,
          }),
        );
      } catch (error) {
        warnings.push(
          `Could not query data source ${dataSource.id}: ${errorMessage(error)}`,
        );
        break;
      }

      for (const row of response.results) {
        if (!isFullPage(row) || row.in_trash) continue;

        pages.push({
          notionId: row.id,
          title: pageTitle(row),
          parentNotionId,
          notionUrl: row.url || notionPageUrl(row.id),
          lucidUrl: null,
          lastEditedTime: row.last_edited_time,
          excerpt: "",
          relationIds: await readRelationIds(row),
          depth,
        });
      }

      cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  return { pages, warnings, requests };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Walks the page subtree with `blocks.children.list`. The REST search endpoint
 * cannot express "everything under this page", so recursion is the only option.
 */
export async function crawlSubtree(
  rootPageId: string,
  options: CrawlOptions = {},
): Promise<CrawlResult> {
  const notion = getNotionClient();
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const warnings: string[] = [];
  const pages: CrawledPage[] = [];
  const seen = new Set<string>();
  let truncated = false;
  let requestCount = 1;

  const rootResponse = await notionQueue.run(() =>
    notion.pages.retrieve({ page_id: rootPageId }),
  );

  if (!isFullPage(rootResponse)) {
    throw new Error(
      `Root page ${rootPageId} returned a partial object. Check that the integration has access to it.`,
    );
  }

  const queue: QueueEntry[] = [
    {
      notionId: rootResponse.id,
      title: pageTitle(rootResponse),
      parentNotionId: null,
      lastEditedTime: rootResponse.last_edited_time,
      depth: 0,
    },
  ];

  while (queue.length > 0) {
    if (pages.length >= maxPages) {
      truncated = true;
      warnings.push(`Stopped after ${maxPages} pages.`);
      break;
    }

    if (options.deadline && Date.now() > options.deadline) {
      truncated = true;
      warnings.push("Stopped early to stay within the request time budget.");
      break;
    }

    const entry = queue.shift()!;
    if (seen.has(entry.notionId)) continue;
    seen.add(entry.notionId);

    const content =
      entry.depth >= maxDepth
        ? {
            excerpt: "",
            lucidUrl: null,
            childPages: [],
            childDatabaseIds: [],
            warnings: [],
            requests: 0,
          }
        : await readPageContent(entry, { deadline: options.deadline });

    warnings.push(...content.warnings);
    requestCount += content.requests;

    pages.push({
      notionId: entry.notionId,
      title: entry.title,
      parentNotionId: entry.parentNotionId,
      notionUrl:
        entry.depth === 0
          ? rootResponse.url || notionPageUrl(entry.notionId)
          : notionPageUrl(entry.notionId),
      lucidUrl: content.lucidUrl,
      lastEditedTime: entry.lastEditedTime,
      excerpt: content.excerpt,
      relationIds: [],
      depth: entry.depth,
    });

    for (const child of content.childPages) {
      if (!seen.has(child.notionId)) queue.push(child);
    }

    for (const databaseBlockId of content.childDatabaseIds) {
      const rows = await readDatabaseRows(
        databaseBlockId,
        entry.notionId,
        entry.depth + 1,
      );
      warnings.push(...rows.warnings);
      requestCount += rows.requests;

      for (const row of rows.pages) {
        if (seen.has(row.notionId)) continue;
        seen.add(row.notionId);
        pages.push(row);
      }
    }

    if (entry.depth >= maxDepth && content.childPages.length === 0) {
      warnings.push(`Reached max depth ${maxDepth} at "${entry.title}".`);
    }
  }

  return {
    rootNotionId: rootResponse.id,
    pages,
    truncated,
    warnings: [...new Set(warnings)],
    requestCount,
  };
}
