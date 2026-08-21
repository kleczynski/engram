Read AGENTS.md in /Users/kacper.leczynski/Desktop/engram first.

## Task: Dev toolchain foundation

Set up the engineering foundation before the Engram hub implementation begins.
No application code changes. No Notion pages. No crawl changes.

### Context

- Git is not initialized. Start from scratch.
- No .github directory exists.
- package.json has eslint + eslint-config-next. We want to replace ESLint with oxlint (https://oxc.rs/docs/guide/usage/linter).
- No pre-commit hooks exist.
- No CI exists.
- No commits have been made. The initial commit should be clean.
- AGENTS.md constraint: do not commit secrets, do not commit .env.local.

### What to implement (in order)

**1. Git init + .gitignore audit**
- `git init`
- Verify .gitignore covers .env*, .next/, node_modules/, .DS_Store. Add anything missing.
- Do not commit until step 5.

**2. Replace ESLint with oxlint**
- Remove eslint, eslint-config-next, @eslint/eslintrc from devDependencies.
- Install oxlint (https://oxc.rs/docs/guide/usage/linter — read the docs before writing config).
- Create oxlint config that covers the same rules as `next/core-web-vitals` + `next/typescript` where oxlint has equivalents.
- For any Next.js-specific rule oxlint cannot cover, document the gap in a comment in the oxlint config — do not silently drop it.
- Update package.json `lint` script to use oxlint.
- Update AGENTS.md done gate: replace `npx eslint .` with the new lint command.
- Delete eslint.config.mjs.
- Run lint and confirm zero errors before proceeding.

**3. Pre-commit hooks with husky + lint-staged**
- Install husky and lint-staged as devDependencies.
- `npx husky init`
- Hook: on pre-commit, run:
  - oxlint on staged .ts/.tsx files
  - `npx tsc --noEmit` (full typecheck — no incremental, no staged subset)
- Do NOT run lint on .js/.mjs files (scripts/ uses tsx, not lint targets).
- Confirm the hook fires on a dry run before proceeding.

**4. GitHub: create repo + push**
- Create a private GitHub repository named `engram` under the authenticated user (use `gh repo create`).
- Set remote origin.
- Make the initial commit: all current tracked files, commit message "init: Week 1 shipped — graph, sync, auth, deploy".
- Push to main.
- Confirm the push succeeded and the remote is visible.

**5. GitHub Actions — CI workflow**
- Create `.github/workflows/ci.yml`.
- Trigger: push to any branch + pull_request to main.
- Jobs (run in parallel where possible):
  - `lint`: oxlint on the full codebase
  - `typecheck`: `npx tsc --noEmit`
  - `build`: `npm run build` (catches Next.js build errors)
- Use Node.js 20.
- Cache node_modules between runs (actions/cache on package-lock.json hash).
- No deploy step in CI — deploys happen via Vercel CLI only when asked.

**6a. GitHub Actions — Claude PR review**
- Create `.github/workflows/pr-review.yml`.
- Trigger: pull_request (opened, synchronize) targeting main.
- Single job `claude-review`:
  - Checkout repo
  - Fetch the PR diff: `gh pr diff ${{ github.event.pull_request.number }}`
  - Send the diff to the Anthropic API (model: claude-haiku-4-5-20251001 for cost efficiency) with this system prompt:
    ```
    You are a senior engineer reviewing a PR on Engram, a Next.js 15 / React 19 / Three.js knowledge graph app.
    Stack constraints: no shadcn, no multi-user, no in-app capture, helpers at @/utils/supabase/ not @/lib/supabase/,
    middleware.ts must not be renamed, Next.js version is 15.5.23 not 16.x.
    Review the diff for: correctness, security (no secrets, no SQL injection, no XSS), stack constraint violations,
    and anything that would be hard to revert. Be concise. Flag blockers first, then suggestions.
    ```
  - Post the response as a PR review comment via `gh pr review --comment --body "..."`.
  - Use secret `ANTHROPIC_API_KEY` (already in .env.local — add to GitHub Actions secrets as well).
  - Use secret `GITHUB_TOKEN` (provided automatically by Actions).
- If the diff is empty or the PR has the label `skip-ai-review`, skip the job gracefully.

**6b. Branch protection (via gh CLI)**
- Set main branch protection:
  - Require status checks: `lint`, `typecheck`, `build` must pass before merge.
  - Do NOT require the `claude-review` job as a blocking check — it is advisory only.
  - Do NOT enable force-push protection (owner needs ability to fix history if an agent goes wrong).
- Print the final protection rule for confirmation.

**7. AGENTS.md update**
- Add a `## Git & CI` section documenting:
  - Remote URL
  - Branch protection rules (lint + typecheck + build block merge; claude-review is advisory)
  - Pre-commit hook contents
  - Lint command (oxlint)
  - How to bypass in emergencies: `--no-verify` only with explicit user ask — never use it autonomously
  - How to add `ANTHROPIC_API_KEY` to GitHub Actions secrets if not already set

### Constraints
- Do not commit .env.local or any file matching .env*.
- Do not use --no-verify at any point.
- Do not modify application code (app/, components/, lib/, utils/, middleware.ts).
- Run `npx tsc --noEmit` and lint after every tooling change to confirm nothing regressed.
- Confirm each numbered step is done before moving to the next.
