import { isFullPage } from "@notionhq/client";

import { getNotionClient, notionQueue } from "@/lib/notion/client";
import { readRelationIds } from "@/lib/notion/crawl";

/**
 * Week 2 write-back helpers. Not wired to UI yet — import from approve-link flow.
 *
 * Database relations: PATCH is replace-all (max 100 ids). Always read → merge → write.
 * Subpage links: append a page-mention block (subpages have no relation properties).
 */

export { readRelationIds };

/** Sets the full relation set on a database row. Replaces all existing links. */
export async function setRelations(
  pageId: string,
  propertyName: string,
  relatedPageIds: string[],
): Promise<void> {
  if (relatedPageIds.length > 100) {
    throw new Error(
      `Notion allows at most 100 relations per update; got ${relatedPageIds.length}`,
    );
  }

  const notion = getNotionClient();
  await notionQueue.run(() =>
    notion.pages.update({
      page_id: pageId,
      properties: {
        [propertyName]: {
          relation: relatedPageIds.map((id) => ({ id })),
        },
      },
    }),
  );
}

/** Adds one relation without dropping existing links on a database row. */
export async function addRelation(
  pageId: string,
  propertyName: string,
  newRelatedId: string,
): Promise<void> {
  const page = await notionQueue.run(() =>
    getNotionClient().pages.retrieve({ page_id: pageId }),
  );

  if (!isFullPage(page)) {
    throw new Error(`Page ${pageId} is not a full page object`);
  }

  const existing = await readRelationIds(page);

  if (existing.includes(newRelatedId)) return;

  await setRelations(pageId, propertyName, [...existing, newRelatedId]);
}

/**
 * Links two subpages by appending a page mention at the end of the source page.
 * Requires Update content capability and shared target page.
 */
export async function appendPageMentionLink(
  sourcePageId: string,
  targetPageId: string,
): Promise<void> {
  const notion = getNotionClient();
  await notionQueue.run(() =>
    notion.blocks.children.append({
      block_id: sourcePageId,
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "mention",
                mention: { type: "page", page: { id: targetPageId } },
              },
            ],
          },
        },
      ],
    }),
  );
}
