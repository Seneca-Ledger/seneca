# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project Context (Seneca)

Detailed policy lives in `.claude/rules/*.md` (security, database, idempotency, api-standards, clean-architecture, frontend-perf, observability, best-practices, effect, design-tokens). Read those before changes in those domains.

**Styling:** every colour, size and weight follows the light and dark theme tokens; no raw hex, MUI colour defaults or Tailwind palette classes. See `.claude/rules/design-tokens.md`.

**Test fixtures:** invented, never lifted from real statements, receipts, the dev DB or the user's data. Keep the shape that matters to the case and make up the content: `'KSP - AirPods Pro'` → `'ACME Store - Wireless Buds'` (same hyphen, two words, a product inside). Same for people, e-mails, domains and IBANs (`Member One`, `member-1@example.com`, `example.co.il`). Name the value once and derive expectations from it.

## Quick Commands

```bash
# Dev (Docker, full stack)
make quick-dev                    # one-shot dev bring-up
make dev                          # docker compose dev with hot reload

# Build / test / lint
npm --prefix backend run test:e2e
npm --prefix backend run test:golden   # parsing golden tests (GOLDEN_ENABLED=1)
npm --prefix backend run lint:fix      # Biome only
npm --prefix frontend run lint:fix     # Biome
npm --prefix backend run typecheck
npm --prefix frontend run type-check

# Migrations (TypeORM)
npm run migration:run                         # prod path: builds scripts, uses migration lock
npm --prefix backend run migration:run:dev    # dev path: ts-node, no lock
npm run migration:generate -- src/migrations/<Name>
```

## Gotchas

- Lint is Biome only (ESLint was removed). In the frontend an `eslint-disable … react-hooks/*` comment is still meaningful: React Compiler skips that function.
- `prebuild` and `postinstall` on the frontend run `intlayer build`; deleting the intlayer config or skipping it breaks both install and build.
- Backend dev uses a manual nodemon command, not `nest start`, and bumps Node heap to 2 GB. Dev scripts (`migration:run:dev`, `seed:demo:dev`, `create-admin:dev`) run ts-node with `--transpile-only`; type-checking is `npm run typecheck`.
- SWC was evaluated for the backend dev loop and rejected: its CommonJS getter exports hit a TDZ on circular entity imports with `emitDecoratorMetadata`. Adopting it needs the TypeORM `Relation<>` wrapper on every relation property first.
- Docker dev: `node_modules` and `.next` are named volumes; `scripts/dev-entrypoint.sh` in each app re-runs `npm ci` only when `package-lock.json` changed. Dev images never compile source (bind mount).
- TypeORM SQL logging is off unless `DB_QUERY_LOGGING=true`.
- Always run migrations via the npm scripts, not raw `typeorm` — `migration:run` acquires a lock to prevent concurrent runs in deployment.
- Product name comes from `APP_NAME` (root `.env`): never write the name into UI text, e-mails or bot replies — use `APP_NAME`/`APP_SLUG` from `frontend/app/lib/brand.ts` or `backend/src/common/brand.ts` (in `*.content.ts` as a template literal). Seneca inside the Stoic quotes is the philosopher, not the product.
- Tenant isolation: every backend query must filter by `workspaceId`. See `.claude/rules/security.md`.
- API schemas live in `packages/contracts/src`; `backend/src/contracts` and `frontend/app/lib/contracts` are generated copies. Edit the source, then `npm run contracts:sync` (pre-commit and CI run `contracts:check`). See `.claude/rules/effect.md`.