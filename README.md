# Engram

A neural map of a Notion workspace. Notion stays the source of truth for
content; Engram derives the graph and renders it as pulsing neurons and
synapses in Three.js.

Week 1 scope is the graph: crawl → diff → store → visualize. AI link
suggestions land in Week 2.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 (App Router), TypeScript, Tailwind v4 |
| 3D | `@react-three/fiber`, `@react-three/drei`, `three` |
| Content | `@notionhq/client` 5.x, Notion API `2026-03-11` |
| Data | Supabase Postgres (+ `pgvector`, Week 2) |
| Auth | Supabase passkeys (WebAuthn) with an email-link fallback |

## Setup

```bash
npm install
cp .env.local.example .env.local   # then fill in real values
npm run dev
```

### Required environment

See `.env.local.example`. The three that block a first sync:

- `NOTION_API_KEY` — internal integration token from
  [Notion connections](https://app.notion.com/developers/connections). Needs
  **Read content**, and **Update content** for Week 2 write-back.
- `NOTION_OBSERVABILITY_ROOT_PAGE_ID` — UUID of the page whose subtree gets
  crawled. Share that page with the integration under **Content access**.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; the sync writes with it.

### Supabase configuration

1. Apply `supabase/migrations/001_initial_schema.sql`.
2. Enable passkeys under **Authentication → Sign In / Providers**.
3. Add your app origin to the redirect URL allow list.

Regenerate database types after any migration:

```bash
supabase gen types typescript --project-id <ref> > utils/supabase/database.types.ts
```

## How it works

**Crawl** (`lib/notion/crawl.ts`) walks the subtree with
`blocks.children.list`. The REST search endpoint cannot express "everything
under this page", so recursion is the only option. `child_page` blocks are
references — their `id` *is* the page id, and `has_children` is always false,
so each one is enqueued as its own page.

**Diff** (`lib/notion/hash.ts`) stores a `content_hash` over the normalized
title plus a 2000-character plain-text excerpt, and a `relation_hash` over
sorted relation ids. Notion exposes no content hash of its own, and
`last_edited_time` alone flags formatting-only edits as changes.

**Rate limiting** (`lib/notion/client.ts`) serializes every Notion call ~350ms
apart, under the documented ~3 req/s ceiling. The SDK retries 429s on top.

**Sync** (`lib/notion/sync.ts`) upserts pages, rebuilds `hierarchy` and
`relation` edges, and prunes rows that vanished upstream — but only after a
complete crawl, so a timed-out run never deletes live data. `ai_suggested` and
`ai_approved` edges are never touched.

**Layout** (`lib/graph/layout.ts`) seeds nodes on depth shells via a Fibonacci
sphere, then relaxes them with repulsion and edge springs. It is fully
deterministic, so re-fetching never scrambles the user's mental map.

**Node size** is `baseRadius + (edgeCount * 2) + (hub_score * 5)`, where
`hub_score` is log-scaled subtree size.

## Notes and limits

- Subpages carry only a `title` property. Relations exist solely on data source
  rows, so hierarchy edges come from `child_page` blocks — never assume
  relations on subpages.
- A sync run is bounded by page count, depth, and a wall-clock budget below the
  serverless timeout. A truncated run reports itself and skips pruning.
- Notion MCP is a development tool only. Runtime sync uses `@notionhq/client`.
