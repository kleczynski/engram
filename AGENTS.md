# AGENTS.md — Engram

Engram crawls a Notion subtree, diffs it into Supabase, and renders pages as pulsing neurons in Three.js. Single-user; Notion is the content source of truth. Week 1 is shipped; Week 2 (embeddings, AI links, write-back) is not — do not start it unless asked.

**Live:** https://engram-ten-alpha.vercel.app · Vercel `iclevers-projects/engram` · Supabase `skjnmileqyxrnjvxipwm` (eu-west-1) · Notion integration **synapsvault** · crawl root `Project → AI Engineering` (`32523a98-e714-8062-a3a3-cc2f89c39547`) · GitHub `kleczynski/engram` (public, branch: main).

## Stack

| Layer | Pin |
| --- | --- |
| App | Next.js **15.5.23** (not `@latest` / 16.x), React **19.1.0**, TypeScript 5, Tailwind **v4** (`@tailwindcss/postcss`) |
| 3D | `@react-three/fiber` ^9.7, `@react-three/drei` ^10.7, `three` ^0.185 |
| Notion | `@notionhq/client` ^5.25.2, API **`2026-03-11`** (SDK default is still `2025-09-03`) |
| Data | `@supabase/supabase-js` ^2.112, `@supabase/ssr` ^0.12; Postgres + `pgvector` (on, unused until Week 2) |
| Auth | `auth.experimental.passkey: true` + magic link; Resend SMTP `smtp.resend.com:465`, user `resend` |

Helpers live at `@/utils/supabase/` — never `@/lib/supabase/`. Keep root `middleware.ts`; do **not** rename to `proxy.ts`.

## CLI

```bash
npm install
npm run dev                                          # next dev --turbopack, :3000
npm run build && npm start
npm run lint                                         # oxlint (next/core-web-vitals equivalent)
npx tsc --noEmit                                     # no `test` script exists
npx tsx --env-file=.env.local scripts/sync-once.ts
npx tsx --env-file=.env.local scripts/login-link.ts [email] [origin]
npx vercel deploy --prod                             # only if asked; whoami = kleczynski
```

Done gate: `npx tsc --noEmit && npx oxlint .`. Reproduce crawl/layout/auth bugs on production first. Do not git commit, recreate `.env.local`, dump secrets, or deploy unless asked.

## Invariants (scar tissue)

- No shadcn, in-app capture, webhooks, or multi-user. Work in this repo only.
- `.gitignore` is `.env*` with `!.env.local.example`. `lib/env.ts` rejects empty / `...`-suffix / `replace_me` values. Client `NEXT_PUBLIC_*` must appear as **literals** (bundler inlining) — never `requireEnv` in client code. Helpers use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not ANON.
- Writes: `createAdminClient()` (service role) on the server only. RLS is authenticated SELECT; anon gets nothing. `SUPABASE_ACCESS_TOKEN` (`sbp_…`) is an **account-level** Management API token — local ops only, never Vercel.
- `next.config.ts` sets `outputFileTracingRoot: process.cwd()` so a parent lockfile does not win tracing root.

**Crawl / sync** (`lib/notion/*`):

- Runtime = `@notionhq/client` only. Notion MCP is inspect/seed during development.
- Walk with `blocks.children.list`. **Never REST Search** — it cannot express “everything under this page”.
- `child_page`: `block.id` **is** the page id; `has_children` is always false. Enqueue as a page; do not list children on the block. Use `in_trash`, not `archived`.
- Always descend: `toggle`, `column_list`, `column`, `synced_block`, `tab`, `callout`, `quote`, `table`. Descend list items **only** while the 2000-char excerpt is filling (full list walks were 138s / 394 req).
- Caps: 400 pages, depth 8, 20 block-list requests/page, 270s crawl budget (`maxDuration` 300). Serial queue 350ms (~3 req/s); SDK retries 429/529. A rejected task must not poison the queue chain.
- Relations exist only on data-source rows, never subpages. `pages.retrieve` truncates at 25 — paginate via `pages.properties.retrieve`. Relation PATCH is replace-all, max 100 (`addRelation` already read→merge→write). Current tree is **subpages only** → hierarchy edges from `child_page`. Share new pages with **synapsvault** or crawl 404s `object_not_found`.
- Diff: `content_hash` = sha256(normalized title + excerpt); `relation_hash` = sha256(sorted unique ids). Notion has no native hash. Incremental skip by `last_edited_time` is **not built** (~93s / 222 req every run).
- Rebuild `hierarchy` + `relation` only; **never** touch `ai_suggested` / `ai_approved`. Prune vanished pages **only if the crawl was complete**. Skip relation targets outside the subtree. `/graph` auto-POSTs `/api/sync` when `lastSyncedAt` is older than 10 minutes.

**Graph:** `computeLayout` is fully deterministic — no randomness. Radius = `6 + edgeCount*2 + hub_score*5`; `hub_score` is log2(descendants), cap 6. Observability filter matches title regex **plus ancestors** so the branch stays attached to the root.

**Auth (fragile):**

- Passkeys live at Authentication → **Passkeys**, not Providers. One RP ID: `engram-ten-alpha.vercel.app`. Changing it invalidates every enrolled passkey; production passkeys do not work on localhost.
- `registerPasskey()` needs a confirmed signed-in user. First login is email; `/login` while signed in is enrollment. Middleware **must not** bounce signed-in users from `/login`.
- `emailRedirectTo` = `${origin}/auth/callback` (**no query string**). Intended template: `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=magiclink`. Callback accepts PKCE `?code=` and `token_hash`. Some sends still render `{{ .ConfirmationURL }}` (PKCE, same-browser only).
- Allow-list matches the **full URL**; a bare origin never matches `/auth/callback` (silent fallback to `site_url`). Keep `https://engram-ten-alpha.vercel.app/**` and `http://localhost:3000/**`.
- Sender `onboarding@resend.dev` only delivers to the Resend account email. Per-address cooldown ~60s. Management API `smtp_port` must be the **string** `"465"`.
- Vercel Authentication = **preview only**. If every route 302s to `vercel.com/sso-api`, it drifted to “all”. After a domain change: Site URL, allow list `/**`, passkey RP ID/origins, `NEXT_PUBLIC_APP_URL`, then re-enrol.

## Specs

| Domain | Path |
| --- | --- |
| Week 2 brief | `WEEK2_PROMPT.md` (`BUILD_PROMPT.md` is stale — do not follow) |
| Notion API / crawl / write-back | `docs/NOTION_SDK.md` |
| Schema + RLS | `supabase/migrations/001_initial_schema.sql` → `utils/supabase/database.types.ts` |
| Env names | `.env.local.example` (`.env.local` already exists) |
| Sync / hash / write-back stubs | `lib/notion/{crawl,sync,hash,client,relations}.ts` |
| Layout / size / filter | `lib/graph/{layout,weights,types}.ts` |
| Auth gate | `middleware.ts`, `utils/supabase/{middleware,server,client}.ts`, `app/login/page.tsx`, `app/auth/callback/route.ts` |
| Ops | `scripts/{sync-once,login-link,configure-smtp,configure-urls}.ts` |

After a migration: `supabase gen types typescript --project-id skjnmileqyxrnjvxipwm > utils/supabase/database.types.ts`

## MCP & skills

| Tool | Scope |
| --- | --- |
| Notion MCP | Inspect/seed (`notion-fetch`, `notion-search`). **Never** production sync. |
| Supabase MCP | `list_tables` → `apply_migration`; advisors. Never print keys. |
| Vercel MCP / CLI | Status, logs, env **names**, deploy when asked. |
| Lucid MCP | Optional; crawl already extracts `lucid.app` URLs from blocks. |
| Figma MCP | Unused by this app. |
| `~/.agents/skills/grilling/SKILL.md` | Later: stress-test hub sketch / live bugs. Do not load until asked. |
| Model-router lock | Skip re-route when `.cursor/model-routing.lock.json` is valid. |

## Git & CI

**Remote:** https://github.com/kleczynski/engram (public, main branch)

**Branch protection (main):**
- Required status checks: `lint`, `typecheck`, `build` — must pass before merge.
- `claude-review` is advisory only — not a blocking check.
- Force push allowed (owner can fix history if an agent goes wrong).
- PR reviews not required; enforce admins disabled.

**Pre-commit hook** (husky + lint-staged):
- `oxlint` on staged `*.{ts,tsx}` files
- `npx tsc --noEmit` (full typecheck)

**Lint command:** `npx oxlint .` (replaces ESLint; config in `.oxlintrc.json`).

**Emergency bypass:** `--no-verify` skips the pre-commit hook. Use **only** with explicit user ask — never autonomously.

**GitHub Actions secrets:** `ANTHROPIC_API_KEY` must be added to the repo's Actions secrets for the Claude PR review workflow. Go to Settings → Secrets and variables → Actions → New repository secret → name: `ANTHROPIC_API_KEY`, value: the key from `.env.local`. `GITHUB_TOKEN` is provided automatically by Actions.

## Engram hub — agreed foundation (implement in this order)

Grilled and confirmed. Do not skip steps or reorder.

1. **`owner_id` migration** — add `owner_id uuid references auth.users default auth.uid()` (nullable) to `pages` and `edges`; backfill existing rows with the owner UID in the same SQL block. No RLS change yet. Regenerate `database.types.ts`.
2. **Notion pages** — create under `Project` (sibling of `AI Engineering`, not nested inside it):
   - `Engram` (hub)
     - `Progress` — plain page, status columns as headings/toggles; one neuron in graph. No database/rows.
     - `Tools` — list of links: Supabase, Vercel, Resend, synapsvault, auth. One-line description each.
     - `Vision` — north star + 3–5 design principles (placeholder; Session C fills it properly).
     - `Architecture` — stack table + sync loop description (mirrors this file's Stack section).
   - Share all with **synapsvault** (Content access or `⋯ → Connections`). A parent share inherits down.
3. **Crawl expansion** — add `NOTION_ENGRAM_ROOT_PAGE_ID` env var (Engram page id). Update `lib/notion/crawl.ts` to accept multiple root IDs (array). Add `NOTION_SKIP_ROOT_TITLES=Archive` blocklist — check top-level page title against it before descending. Do **not** change `NOTION_OBSERVABILITY_ROOT_PAGE_ID`. Long-term goal: crawl full workspace minus blocklist.
4. **Daily Cron** — add to `vercel.json`: `{ "crons": [{ "path": "/api/sync", "schedule": "0 6 * * *" }] }`. Route already checks `CRON_SECRET`; add it to Vercel env.
5. **Read-only graph for testers** — remove auth gate from `/graph` GET (visualization only); keep sync gated. Testers see the graph without a session. Passkey enrollment later promotes them to a real user.
6. **Sync + verify** — trigger sync, confirm Engram neuron appears in production graph.

**Explicitly not in this phase:** Week 2 AI, live status badges, in-app capture, webhooks, multi-user RLS, vision grilling (→ Session C).

**Visualization research** — a dedicated agent session will research state-of-the-art knowledge graph visualization. Scope: UX inspiration (Obsidian, Roam, Logseq) + algorithms (semantic clustering, hierarchical bundling) + Three.js/R3F feasibility. Problem framing: meaning (which nodes matter) + semantic connections (distant-node links). Constraint: keep Three.js/R3F + 3D primary; layout algorithm and shaders are on the table.
