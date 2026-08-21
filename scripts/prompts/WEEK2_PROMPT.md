# Engram — Week 2 Build Agent Prompt

> **Week 1 is shipped.** Read `AGENTS.md` for live state (production URL, crawl root, auth quirks, known bugs).
> Notion API reference: `docs/NOTION_SDK.md` (verified `@notionhq/client@5.25.2`, API `2026-03-11`).

---

# MODEL CONFIGURATION

You are running on **Claude Opus 5 with Extended Thinking** enabled.

---

# ROLE

Continue **Engram** at `/Users/kacper.leczynski/Desktop/engram`. Week 1 (graph + sync + auth + deploy) is done. Your scope is **Week 2 only** unless the user asks otherwise.

---

# WEEK 1 STATUS (do not rebuild)

| Item | Value |
| --- | --- |
| Production | https://engram-ten-alpha.vercel.app |
| Sync root | `AI Engineering` under Notion `Project` (see `AGENTS.md`) |
| Live graph | 71 pages, 70 hierarchy edges, subpages only (no DB Relations yet) |
| Notion client | `@notionhq/client@5.25.2`, `notionVersion: 2026-03-11`, rate queue in `lib/notion/client.ts` |
| Write-back stubs | `lib/notion/relations.ts` — `addRelation`, `setRelations`, `appendPageMentionLink` |

---

# WEEK 2 GOALS

1. **Incremental sync** — skip unchanged pages via `last_edited_time` before full hash (target: ~71 requests / ~25s unchanged run)
2. **Embeddings** — OpenAI `text-embedding-3-small` → Supabase `pgvector`
3. **Link suggestions on sync** — similarity + LLM → `link_suggestions` table
4. **Inbox UI** — Approve / Reject; rejected → `rejected_links` (never re-propose)
5. **Notion write-back on approve:**
   - Subpage → subpage: `appendPageMentionLink`
   - Database row (if added later): `addRelation(propertyName, …)` — **replace-all** semantics; read → merge → write
6. **Weekly batch** (manual trigger first) — reorganisation proposals with same approve UX
7. **Optional v0.1:** Notion webhooks (`page.content_updated`) — see `docs/NOTION_SDK.md`

---

# NOTION WRITE-BACK RULES (from SDK research)

| Gotcha | Action |
| --- | --- |
| Subpages have no Relations | Use `appendPageMentionLink` |
| Relation PATCH is replace-all, max 100 | Use `addRelation` in `lib/notion/relations.ts` |
| Relations truncate at 25 on retrieve | Already handled in exported `readRelationIds` |
| Share target DB with connection | Or relations read/write return empty / 404 |
| MCP dev only | Runtime = `@notionhq/client` |

---

# ENV (already in `.env.local` — do not recreate)

```
NOTION_API_KEY
NOTION_OBSERVABILITY_ROOT_PAGE_ID
NOTION_VERSION              # optional; defaults 2026-03-11
NEXT_PUBLIC_SUPABASE_*
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY / ANTHROPIC_API_KEY / AI_GATEWAY_API_KEY
CRON_SECRET
NEXT_PUBLIC_APP_URL
```

---

# CONSTRAINTS

- Do NOT recreate Week 1 scaffold
- Do NOT use shadcn
- Do NOT use Notion MCP at runtime
- Do NOT git commit unless asked
- Do NOT commit secrets

---

# START

1. Read `AGENTS.md` + `docs/NOTION_SDK.md`
2. Confirm env var names (values stay secret)
3. Implement incremental sync first (biggest perf win)
4. Then embeddings → suggestions → inbox → write-back

Report after each milestone with request counts from `sync_log`.
