# Engram — Build Agent Prompt (v2)

> **⚠️ STALE — Week 1 shipped.** Do not send this file to a build agent.
>
> | Read instead | Purpose |
> | --- | --- |
> | `AGENTS.md` | Live project state, auth, crawl, deploy |
> | `WEEK2_PROMPT.md` | Week 2 build brief (AI, embeddings, write-back) |
> | `docs/NOTION_SDK.md` | Notion API gotchas ([research notes](a9f0d52a-663e-40ad-a5d0-4815e980c7b5)) |

---

# ARCHIVE BELOW — original Week 1 spec (historical)

---

# MODEL CONFIGURATION

You are running on **Claude Opus 5 with Extended Thinking** enabled.
Use extended thinking for: Notion data model (subpages vs database Relations), sync architecture, Three.js layout, Supabase schema.

---

# ROLE

Senior full-stack engineer continuing **Engram** — personal work knowledge graph.
Notion = content source of truth. App = Three.js neural visualization + (Week 2) AI link suggestions.

---

# CURRENT PROJECT STATE

## Location
`/Users/kacper.leczynski/Desktop/engram`

**Do NOT create a new repo.** Work here only.

## What exists today
- `.env.local` — all env vars already set (Notion, Supabase, AI keys, CRON_SECRET)
- **No Next.js scaffold yet** — bootstrap required
- **No shadcn** — App Router + Tailwind only
- All MCP servers connected: Notion, Supabase, Vercel, cursor-app-control

## Supabase pattern (follow exactly)

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...   # use in client helpers (NOT anon key naming in code)
SUPABASE_SERVICE_ROLE_KEY=...              # server-only
```

Helpers at **`@/utils/supabase/`** (NOT `@/lib/supabase/`):
- `utils/supabase/server.ts`
- `utils/supabase/client.ts`
- `utils/supabase/middleware.ts`
- `middleware.ts` (root)

Optional: `npx skills add supabase/agent-skills`

---

# PRODUCT SPEC (LOCKED)

| Decision | Choice |
|----------|--------|
| Wedge | Work → Observability/Evaluation |
| Notion | Hybrid: Notion = content, Engram = graph + AI |
| Capture | User writes in Notion; app syncs |
| Sync | On app open + manual ↻ |
| Graph UI | R3F, neuron aesthetic (#0a0a0f), pulsing synapses |
| Interaction | Click → side panel + zoom subgraph; filter Observability/all |
| Lucid | URL metadata only |
| Auth | Supabase passkey |
| AI | Week 2 only |
| Build order | Week 1 = graph; Week 2 = AI |

**Out of scope v0:** language learning, bills, Lucid parser, in-app capture, webhooks, multi-user, shadcn.

---

# NOTION INTEGRATION (verified 2026-03-11)

## Setup checklist
1. Internal Connection at https://app.notion.com/developers/connections
2. Capabilities: **Read content** + **Update content** (Week 2 write-back)
3. **Content access** tab → share root page Observability/Evaluation (+ ALL related databases if Relations exist)
4. Token → `NOTION_API_KEY` (already in `.env.local`)
5. Root page UUID → `NOTION_OBSERVABILITY_ROOT_PAGE_ID` (already in `.env.local`)

## SDK init (mandatory)

```bash
npm install @notionhq/client@5.25.2
```

```typescript
import { Client, collectPaginatedAPI, iteratePaginatedAPI, isFullBlock } from "@notionhq/client";

export const notion = new Client({
  auth: process.env.NOTION_API_KEY!,
  notionVersion: "2026-03-11",
  retry: { maxRetries: 5 },
});
```

Docs: https://developers.notion.com/llms.txt

## CRITICAL GOTCHAS

| Gotcha | Action |
|--------|--------|
| Subpages (`parent.type === "page_id"`) only have `title` property | **No Relations on subpages.** Hierarchy edges from `child_page` blocks. |
| Relations only on database/data_source pages | Cross-links: Supabase `edges` table; Week 2 write-back via page mention blocks OR DB Relations if database exists |
| Search API ≠ subtree crawl | Use recursive `blocks.children.list`, NOT REST Search |
| `child_page` blocks have `has_children: false` | They are references; use block.id as page ID |
| Relation read truncates at 25 | Paginate via `pages.properties.retrieve` when `has_more: true` |
| Relation write is **replace-all** (max 100/request) | Read → merge → write back |
| Share ALL related DBs with connection | Empty relations = target DB not shared |
| 2025-09-03 data model | Relations reference `data_source_id`; use `databases.retrieve` → `data_sources[]` |
| No native content hash | Use `last_edited_time` as cheap filter + own `content_hash` |
| Rate limit ~3 req/s | Central request queue; SDK retries 429/529 |
| Use `in_trash` not `archived` | API 2026-03-11 |
| MCP = dev only | Production sync uses `@notionhq/client` only |

## Subtree crawl (production pattern)

```typescript
async function crawlSubtree(rootPageId: string): Promise<string[]> {
  const pageIds: string[] = [rootPageId];
  const queue = [rootPageId];

  while (queue.length) {
    const pageId = queue.shift()!;
    const blocks = await collectPaginatedAPI(notion.blocks.children.list, {
      block_id: pageId,
      page_size: 100,
    });
    for (const block of blocks) {
      if (!isFullBlock(block)) continue;
      if (block.type === "child_page") {
        pageIds.push(block.id);
        continue; // child_page has no children on the block itself
      }
      if (block.type === "child_database") {
        await walkDatabase(block.id); // query data_sources separately
        continue;
      }
      if (block.has_children) queue.push(block.id);
    }
  }
  return pageIds;
}
```

## Content hash for diff sync
1. Cheap filter: compare Notion `last_edited_time`
2. Full hash: normalized title + plain text excerpt (first 2000 chars) + relation IDs
3. Store `{ notion_id, content_hash, relation_hash, last_edited_time }` in Supabase

## Week 2 write-back (do NOT build in Week 1)
- **Subpages:** append page mention link block via `blocks.children.append`
- **Database pages:** `pages.update` with full relation array (read → merge → write)
- Requires Update content capability + shared target DB

## MCP on start (dev only)
1. `notion-fetch` on `NOTION_OBSERVABILITY_ROOT_PAGE_ID`
2. If no seed: `notion-create-pages` → Metrics, Tracing, Alerts, Evaluation, Runbooks
3. Report: subpages vs embedded database → adapt edge extraction

---

# ENV VARS

Read existing `.env.local` — do NOT recreate. Expected keys:

```
NOTION_API_KEY
NOTION_OBSERVABILITY_ROOT_PAGE_ID
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
OPENAI_API_KEY          # Week 2
ANTHROPIC_API_KEY       # Week 2
AI_GATEWAY_API_KEY      # Week 2
CRON_SECRET             # Week 2
```

Create `.env.local.example` with placeholders only.

---

# TECH STACK

- Next.js 15 App Router, TypeScript, Tailwind (NO shadcn)
- `@react-three/fiber`, `@react-three/drei`, `three`
- `@notionhq/client@5.25.2`
- `@supabase/supabase-js`, `@supabase/ssr`
- Deploy: Vercel MCP

---

# SUPABASE SCHEMA

Run via Supabase MCP. Enable `vector` extension (Week 2 prep).

```sql
create extension if not exists vector;

create table pages (
  id uuid primary key default gen_random_uuid(),
  notion_id text unique not null,
  title text not null,
  content_hash text,
  relation_hash text,
  parent_notion_id text,
  hub_score float default 1.0,
  lucid_url text,
  notion_url text,
  last_edited_time timestamptz,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create table edges (
  id uuid primary key default gen_random_uuid(),
  source_page_id uuid references pages(id) on delete cascade,
  target_page_id uuid references pages(id) on delete cascade,
  edge_type text not null check (edge_type in ('hierarchy', 'relation', 'ai_suggested', 'ai_approved')),
  created_at timestamptz default now(),
  unique(source_page_id, target_page_id, edge_type)
);

create table embeddings (
  page_id uuid primary key references pages(id) on delete cascade,
  embedding vector(1536),
  updated_at timestamptz default now()
);

create table link_suggestions (
  id uuid primary key default gen_random_uuid(),
  from_page_id uuid references pages(id) on delete cascade,
  to_page_id uuid references pages(id) on delete cascade,
  confidence float,
  reason text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create table rejected_links (
  from_page_id uuid references pages(id) on delete cascade,
  to_page_id uuid references pages(id) on delete cascade,
  rejected_at timestamptz default now(),
  primary key (from_page_id, to_page_id)
);

create table sync_log (
  id uuid primary key default gen_random_uuid(),
  synced_at timestamptz default now(),
  pages_added int default 0,
  pages_changed int default 0
);
```

Node size: `baseRadius + (edgeCount * 2) + (hub_score * 5)`

---

# FILE STRUCTURE

```
engram/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── graph/page.tsx
│   ├── login/page.tsx
│   └── api/sync/route.ts
│   └── api/graph/route.ts
├── components/graph/
│   ├── GraphCanvas.tsx
│   ├── NeuronNode.tsx
│   ├── SynapseEdge.tsx
│   ├── GraphControls.tsx
│   └── SidePanel.tsx
├── utils/supabase/
│   ├── server.ts
│   ├── client.ts
│   └── middleware.ts
├── middleware.ts
├── lib/notion/
│   ├── client.ts
│   ├── sync.ts
│   ├── crawl.ts
│   └── hash.ts
├── lib/graph/
│   ├── layout.ts
│   └── weights.ts
└── supabase/migrations/001_initial_schema.sql
```

---

# WEEK 1 TASKS

## Step 0: Bootstrap
```bash
cd ~/Desktop/engram
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
npm install @react-three/fiber @react-three/drei three @notionhq/client@5.25.2
npm install @supabase/supabase-js @supabase/ssr
```
Add Supabase helpers + middleware. Remove todos demo.

## Step 1: Notion MCP inspect + seed if needed

## Step 2: Supabase migration via MCP

## Step 3: Sync (`POST /api/sync`)
- Crawl subtree, diff by hash, upsert pages + hierarchy edges (+ relation edges if DB exists)
- Rate-limit queue for Notion API

## Step 4: Graph (`/graph`)
- Neuron aesthetic, pulsing edges, side panel, zoom, filter, ↻ sync

## Step 5: Passkey auth + Vercel deploy

---

# DEFINITION OF DONE (Week 1)

1. Passkey login → graph loads
2. Seed pages as pulsing nodes with hierarchy edges
3. Click → preview + zoom children
4. Filter Observability / all
5. ↻ sync adds new Notion page as node
6. Deployed on Vercel

---

# CONSTRAINTS

- Do NOT create new project
- Do NOT use shadcn
- Do NOT build AI in Week 1
- Do NOT use Notion MCP at runtime
- Do NOT assume Relations on subpages
- Do NOT commit secrets
- Do NOT git commit unless asked

---

# START

1. Read `.env.local` (names only)
2. Notion MCP: fetch root → report structure
3. Bootstrap Next.js
4. Execute Week 1 steps; report after each milestone
