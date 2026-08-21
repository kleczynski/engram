Read AGENTS.md in /Users/kacper.leczynski/Desktop/engram first.

## Task: Engram hub foundation

Implement the agreed foundation from the `## Engram hub — agreed foundation` section of AGENTS.md.
Work the 6 steps in order. Confirm each step is done before moving to the next.
Do not skip ahead. Do not create Notion pages before the migration is verified.

### Step 1 — owner_id migration

Add `owner_id uuid references auth.users default auth.uid()` (nullable, no NOT NULL) to both
`pages` and `edges` tables. In the same migration SQL block, backfill existing rows:

  UPDATE pages SET owner_id = '<your-uid-here>';
  UPDATE edges SET owner_id = '<your-uid-here>';

Before writing the migration:
- Use Supabase MCP `list_tables` to confirm current schema of `pages` and `edges`.
- Find the owner UID: run `scripts/login-link.ts` or query `auth.users` via Supabase MCP.
- Apply via Supabase MCP `apply_migration`.
- Regenerate types: `supabase gen types typescript --project-id skjnmileqyxrnjvxipwm > utils/supabase/database.types.ts`
- Run `npx tsc --noEmit` — must pass before proceeding.

Do NOT change RLS. Do NOT add a NOT NULL constraint. Nullable is intentional.

### Step 2 — Notion pages

Create the following page structure in Notion. Use Notion MCP for creation (inspect/seed only — never production sync):

  Engram                    ← new page, sibling of "AI Engineering" under "Project"
  ├── Progress              ← plain page; body: status columns as H2 headings (Now / Next / Done)
  ├── Tools                 ← plain page; body: list of links — Supabase dashboard, Vercel project,
  │                            Resend, synapsvault connection, Supabase auth settings.
  │                            One-line description per link.
  ├── Vision                ← plain page; body: placeholder north star paragraph +
  │                            bullet list "Design principles (TBD — Session C)"
  └── Architecture          ← plain page; body: stack table (copy from AGENTS.md Stack section) +
                               one paragraph describing the sync loop (crawl → diff → upsert → graph)

After creating each page, share it with the synapsvault integration (⋯ → Connections → synapsvault),
or the crawl will 404 with `object_not_found`. Sharing the parent `Engram` page inherits down if
Notion propagates it — verify by fetching each child page via Notion MCP before proceeding.

Note the Notion page ID of the `Engram` page — needed for Step 3.

### Step 3 — Crawl expansion

Add a second crawl root for the Engram page.

1. Add `NOTION_ENGRAM_ROOT_PAGE_ID=<engram-page-id>` to `.env.local` and to Vercel env
   (development + preview + production). Use `npx vercel env add` for each environment.
2. Add `NOTION_SKIP_ROOT_TITLES=Archive` to `.env.local` and Vercel env (all environments).
3. Update `lib/env.ts` to declare both new keys (optional but warn if missing).
4. Update `lib/notion/crawl.ts` to accept an array of root IDs. Both roots crawl independently;
   results merge before diff. The blocklist check: if a top-level page title matches any entry in
   `NOTION_SKIP_ROOT_TITLES` (comma-separated), skip it entirely without descending.
5. Update `app/api/sync/route.ts` to pass both root IDs to the crawl.
6. Do NOT change `NOTION_OBSERVABILITY_ROOT_PAGE_ID` or its env var name.
7. Run `npx tsc --noEmit` — must pass.

### Step 4 — Daily Cron

Add to `vercel.json` (create if it does not exist):

  {
    "crons": [{ "path": "/api/sync", "schedule": "0 6 * * *" }]
  }

`/api/sync` already checks `CRON_SECRET` — confirm the check exists in `app/api/sync/route.ts`.
If `CRON_SECRET` is not yet in Vercel env, add it now (`npx vercel env add CRON_SECRET`).

### Step 5 — Read-only graph for testers

**Important:** removing the auth gate from `/graph` is intentional and agreed. Do NOT re-add it
thinking it is a bug or a security oversight. The sync route stays gated; only the visualization
becomes public.

Check `middleware.ts` — it currently auth-gates `/graph`. Adjust the matcher so `/graph` is
public but `/api/sync` stays protected. Do not touch any other auth logic.

Also check the graph client component: the 10-minute auto-POST to `/api/sync` must be gated on
session presence. If there is no session, do not trigger sync — unauthenticated visitors should
only read, never write.

Run `npx tsc --noEmit`. Test locally: `npm run dev`, open http://localhost:3000/graph without
a session — graph should load. Confirm the auto-sync does not fire for unauthenticated visitors.

### Step 6 — Sync + verify

Trigger a full sync against both roots:

  npx tsx --env-file=.env.local scripts/sync-once.ts

Confirm:
- No truncation (crawl was complete).
- Engram neuron and its 4 children appear in the graph payload (`GET /api/graph`).
- Page count increased from 71.
- No `object_not_found` errors (all Engram pages shared with synapsvault).

Then deploy to production and verify on https://engram-ten-alpha.vercel.app/graph.

### Constraints
- Do not git commit unless asked.
- Do not recreate .env.local.
- Do not dump secret values into chat.
- Do not start Week 2 AI features.
- Done gate after every code change: `npx tsc --noEmit && npx oxlint .`
