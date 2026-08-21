import { createHash } from "node:crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Notion exposes no content hash, so we derive one from the title plus a
 * bounded plain-text excerpt. `last_edited_time` is the cheap pre-filter;
 * this catches edits that leave the timestamp untouched (and ignores edits
 * that only touched formatting).
 */
export function contentHash(input: { title: string; excerpt: string }): string {
  return sha256(`${normalize(input.title)}\u0000${normalize(input.excerpt)}`);
}

/** Order-independent hash so reordering relations is not a change. */
export function relationHash(relationIds: string[]): string {
  return sha256([...new Set(relationIds)].toSorted().join(","));
}
