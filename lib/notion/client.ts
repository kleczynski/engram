import { Client } from "@notionhq/client";

import { optionalEnv, optionalEnvWarned, requireEnv } from "@/lib/env";

/** Latest Notion API version. The SDK still defaults to 2025-09-03. */
export const DEFAULT_NOTION_VERSION = "2026-03-11";

/** Notion allows roughly 3 requests/second averaged per integration. */
const MIN_REQUEST_INTERVAL_MS = 350;

/**
 * Serializes every Notion call and spaces request starts apart. The SDK's own
 * retry handles 429/529 responses; this queue keeps us from provoking them.
 */
class RateLimitedQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private nextSlotAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      const wait = this.nextSlotAt - Date.now();
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.nextSlotAt = Date.now() + this.minIntervalMs;
      return task();
    });

    // A rejected task must not poison the chain for callers queued behind it.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
}

export const notionQueue = new RateLimitedQueue(MIN_REQUEST_INTERVAL_MS);

let client: Client | null = null;

/** Lazy so a missing token fails at request time, not at module load. */
export function getNotionClient(): Client {
  if (!client) {
    client = new Client({
      auth: requireEnv("NOTION_API_KEY"),
      notionVersion: optionalEnv("NOTION_VERSION") ?? DEFAULT_NOTION_VERSION,
      retry: { maxRetries: 5 },
    });
  }

  return client;
}

export function getRootPageId(): string {
  return requireEnv("NOTION_OBSERVABILITY_ROOT_PAGE_ID");
}

function normalizePageId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

/**
 * Crawl roots. Observability stays required; Engram is optional until the
 * hub page is shared with synapsvault and the env var is set.
 */
export function getRootPageIds(): string[] {
  const roots = [getRootPageId()];
  const engram = optionalEnvWarned("NOTION_ENGRAM_ROOT_PAGE_ID");

  if (engram) {
    const seen = new Set(roots.map(normalizePageId));
    if (!seen.has(normalizePageId(engram))) roots.push(engram);
  }

  return roots;
}

/** Comma-separated top-level titles to skip without descending. */
export function getSkipRootTitles(): string[] {
  const raw = optionalEnvWarned("NOTION_SKIP_ROOT_TITLES");
  if (!raw) return [];

  return raw
    .split(",")
    .map((title) => title.trim())
    .filter(Boolean);
}

/** Notion page links are for humans; IDs remain the stable reference. */
export function notionPageUrl(pageId: string): string {
  return `https://app.notion.com/p/${pageId.replace(/-/g, "")}`;
}
