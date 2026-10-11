---
paths:
  - "backend/**"
  - "frontend/**"
  - "packages/contracts/**"
---

# Effect and API contracts

Effect (`effect` 4.x) is adopted incrementally. NestJS, TypeORM, React Query and axios stay; Effect is used where typed errors, timeouts/retries or runtime validation pay off.

## When to use it
- **New external I/O** (provider APIs, bank sync, AI calls): write the call as an Effect with a timeout, a retry policy for transient failures and a Schema-decoded response. Example: `backend/src/modules/exchange-rates/exchange-rates.http.ts`.
- **Request/response shapes the frontend reads**: define them in `packages/contracts/src`, never twice.
- **Plain TypeORM CRUD** stays `async/await`. Don't wrap a repository call in an Effect just to have one.

## Contracts (`packages/contracts`)
- `packages/contracts/src` is the source. `backend/src/contracts` and `frontend/app/lib/contracts` are generated copies: edit the source, then run `npm run contracts:sync`. CI and the pre-commit hook run `contracts:check`.
- Contracts import only `effect/*` subpaths and relative files. No Nest, TypeORM or React.
- Schemas describe the wire format without transformations (`decodeResponse` hands back the payload itself): dates are ISO strings, enums are `Schema.Literals`. Map a literal union onto an entity enum with a `Record<Literal, Enum>` so a value missing on either side fails to compile (see `goal-items.service.ts`).
- The `effect` version is pinned exactly and must be the same in `backend`, `frontend` and `packages/contracts` (`contracts:check` enforces it). Bump all three in one PR.

## Backend
- Request bodies: `@SchemaBody(Contract) body: Contract` from `src/common/effect/schema-body.ts`. It rejects unknown properties and answers 400 in the class-validator shape, so clients see no difference from a DTO.
- Run Effects from Nest code through `EffectRuntime.run` (`src/common/effect/effect-runtime.ts`). It owns the shared layers (HTTP client) and turns a `DomainError` into the same response as `throw new XxxException(appError(code))`. The one exception: a self-contained Effect (no services, failures already handled) inside a class Nest does not construct, such as `BaseAiHelper`, may use `Effect.runPromise`. Never `runSync` in a request path.
- Typed domain failures: `new DomainError({ status, code, params? })` with a code from `src/common/errors/app-error.ts`. Anything else that fails or dies ends up as a logged 500.
- Inside an Effect, fail only with tagged errors (`Data.TaggedError`, effect's own). A plain `Error` subclass in the error channel makes TypeScript drop structurally compatible members such as `TimeoutError` from the union, so a handler silently misses them. Translate to Nest exceptions at the boundary with an exhaustive `switch` on `_tag` (see `toListingException` in `bank-sync/simplefin.provider.ts`).
- Nest services stay the composition root. Pass what an Effect needs as arguments or `Effect.provideService`; do not register Nest providers as Layers.
- Log at the Nest boundary with the class `Logger`, and never log a URL that carries an API key.
- Tests run under Jest: call the service, or `effects.run(...)`, and assert on the result. Mock HTTP with `global.fetch` returning a real `Response`; `EffectRuntime` reads `globalThis.fetch` per request.

## Frontend
- Type responses by contract with `apiQueryDecoded({ ..., contract: 'Name' })` / `checkContract('Name', payload, url)` from `app/lib/query-fn-schema.ts`. Outside production they also check the payload and throw `ContractMismatchError` on drift; production compiles the check out, so effect (~67 kB gzip in the webpack build) never ships.
- Import contracts as types only (`import type`). Only `app/lib/contract-check.ts` imports the schemas as values; `contract-imports.test.ts` enforces it.
- Import Effect by subpath (`effect/Schema`, `effect/Exit`); Biome rejects the `effect` barrel.
