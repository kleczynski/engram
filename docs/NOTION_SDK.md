# Notion SDK reference (Engram)

Verified against `@notionhq/client@5.25.2` and API version **`2026-03-11`**. Sourced from [Notion SDK research](https://developers.notion.com) session (Aug 2026).

**Runtime code:** `lib/notion/*` — not Notion MCP.  
**Handoff for agents:** read `AGENTS.md` first; this doc is Notion-specific depth.

---

## Client init

```typescript
import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
  notionVersion: "2026-03-11", // optional via NOTION_VERSION; SDK default is 2025-09-03
  retry: { maxRetries: 5 },
});
```

Engram wraps all calls in `notionQueue` (~350ms spacing) — see `lib/notion/client.ts`.

---

## Internal connection checklist

1. [Developer portal](https://app.notion.com/developers/connections) → **Internal connections** → create **synapsvault**
2. Capabilities: **Read content** (now) + **Update content** (Week 2 write-back)
3. **Content access** → share crawl root **and every database** used by Relation columns
4. Token → `NOTION_API_KEY`; root UUID → `NOTION_OBSERVABILITY_ROOT_PAGE_ID`
5. Optional pin → `NOTION_VERSION=2026-03-11`

Child pages inherit access when a parent is shared.

---

## Subtree crawl (production)

| Approach | Use |
| --- | --- |
| Recursive `blocks.children.list` | **Yes** — exact subtree under root |
| REST `POST /v1/search` | **No** — title search workspace-wide, no parent filter |
| MCP `notion-search` + `page_url` | Dev/explore only — not for sync |

Rules implemented in `lib/notion/crawl.ts`:

- `child_page`: `block.id` **is** the page id; `has_children` is always false — enqueue as page, do not list children on the block
- `child_database`: `databases.retrieve` → `data_sources[]` → `dataSources.query`
- Descend toggles/columns/etc. when they can hide nested pages; skip list-item descent unless excerpt still filling (perf)

---

## Relations

| Fact | Implication |
| --- | --- |
| Subpages (`parent.type === "page_id"`) only have `title` | No Relations on free subpages |
| Relations exist on **data source rows** only | Current tree is subpages-only → hierarchy edges only |
| `pages.retrieve` truncates relations at **25** | Paginate via `pages.properties.retrieve` when `has_more` — see `readRelationIds` in `crawl.ts` |
| Relation PATCH is **replace-all**, max **100** ids | Read → merge → write — see `lib/notion/relations.ts` |
| Target database must be shared | Empty relations usually mean DB not shared with connection |
| 2025-09-03 model | Relations reference `data_source_id`, not `database_id` |

### Week 2 write-back paths

1. **Subpage → subpage:** append page-mention block (`appendPageMentionLink` in `relations.ts`)
2. **Database row:** `addRelation` / `setRelations` on the relation property

---

## Diff / sync state

Notion has **no content hash**. Engram stores:

- `content_hash` — sha256(normalized title + excerpt)
- `relation_hash` — sha256(sorted relation ids)
- `last_edited_time` — on page row; cheap skip **not implemented yet** (known perf gap)

---

## Rate limits & errors

- ~**3 req/s** average per connection (+ workspace cap)
- SDK retries **429** / **529**; Engram adds serial queue
- Use **`in_trash`**, not `archived` (2026-03-11)
- Never key sync state on Notion URLs — UUIDs only

---

## Webhooks (v0.1+, not built)

Connection → Webhooks tab → subscribe to `page.content_updated`, `page.properties_updated`, etc.  
SDK ≥ 5.23: `verifyWebhookSignature()`. Events may batch ~1 minute.

Future env: `NOTION_WEBHOOK_VERIFICATION_TOKEN`, `WEBHOOK_PUBLIC_URL`.

---

## MCP vs `@notionhq/client`

| | MCP | Client |
| --- | --- | --- |
| Auth | OAuth (user) | Internal connection token |
| Production sync | No | **Yes** |
| Webhooks | No | Yes |
| Relation updates | `notion-update-page` (markdown) | Typed `pages.update` |

---

## Key doc links

- [llms.txt index](https://developers.notion.com/llms.txt)
- [Internal connections](https://developers.notion.com/guides/get-started/internal-connections)
- [Relation property values](https://developers.notion.com/reference/page-property-values#relation)
- [Request limits](https://developers.notion.com/reference/request-limits)
- [Webhooks](https://developers.notion.com/reference/webhooks)
