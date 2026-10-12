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
- Outbound HTTP goes through `common/effect/http-json.ts`: `getJson` (decode, retry 429/5xx/network) or `getWith` (the caller reads status, headers, text or bytes). Both run the whole exchange, body included, inside one timeout.
- Retry only where the provider's quota allows it. Openverse (200 searches a day), Nominatim (1 request a second), CoinGecko's free tier and the icon sources are asked once; a failure falls back (cache, last known value, "unavailable").
- Kept on plain `fetch` on purpose: `webhook-processor` (pinned-DNS agent, retries are durable rows), `model-proxy` (streams, manual redirects), `fetchPublicUrl` (the SSRF guard for user-supplied URLs), and calls that need an `AbortSignal` API through `attemptWithRetry` (Telegram, SMTP). Gmail, Google Drive and Dropbox are going away and stay as they are.
- `EffectRuntime` turns off trace propagation: the HTTP client would otherwise send `traceparent`/`b3` headers to every third party.
- **Request/response shapes the frontend reads**: define them in `packages/contracts/src`, never twice.
- **Plain TypeORM CRUD** stays `async/await`. Don't wrap a repository call in an Effect just to have one.

## Contracts (`packages/contracts`)
- `packages/contracts/src` is the source. `backend/src/contracts` and `frontend/app/lib/contracts` are generated copies: edit the source, then run `npm run contracts:sync`. CI and the pre-commit hook run `contracts:check`.
- Contracts import only `effect/*` subpaths and relative files. No Nest, TypeORM or React.
- Schemas describe the wire format without transformations (`decodeResponse` hands back the payload itself): dates are ISO strings, `decimal` and `bigint` columns are `DecimalString`, `date` columns are `DateOnly`, enums are `Schema.Literals`. Map a literal union onto an entity enum with a `Record<Literal, Enum>` so a value missing on either side fails to compile (see `goal-items.service.ts`).
- A response contract names what the client reads, not every column, and never a server path (`filePath`), a credential or another user's bookkeeping columns.
- Kinds that come from reference data the backend updates on its own (filing deadlines, retention periods) are open `Schema.String`s, and the page shows an unknown one by its key; code-defined enums stay closed literals.
- Every contract a page reads is exercised in `backend/@tests/e2e/contracts.e2e-spec.ts` with data in it, so a contract that only matches empty answers does not pass. That includes the mutations whose answers the page keeps.
- The `effect` version is pinned exactly and must be the same in `backend`, `frontend` and `packages/contracts` (`contracts:check` enforces it). Bump all three in one PR.

## Backend
- Request bodies: `@SchemaBody(Contract) body: Contract` from `src/common/effect/schema-body.ts`. It rejects unknown properties and answers 400 in the class-validator shape, so clients see no difference from a DTO.
- Optional body fields are `optionalNullable(X)` (`common/requests.ts`): `@IsOptional()` accepted null, and clients send null to clear a field. On create, spread `withoutNulls(body)` so a column default applies; on update, treat null as "clear" and `undefined` as "leave". Convert contract literals to entity enums with `toEnum(Enum, value)`.
- A mutation answers the same shape as the read of the same thing. `save()` leaves the values just assigned on the entity: numbers in `decimal` columns, a `Date` in a `date` column, `undefined` for fields a patch left out. Answer the stored form (see `asStored` in `payables.service.ts`) and never `Object.assign` a patch with undefined keys.
- Anything that answers a user answers `toCurrentUser(user)`, never the entity: the client stores it.
- Run Effects from Nest code through `EffectRuntime.run` (`src/common/effect/effect-runtime.ts`). It owns the shared layers (HTTP client) and turns a `DomainError` into the same response as `throw new XxxException(appError(code))`. The one exception: a self-contained Effect (no services, failures already handled) inside a class Nest does not construct, such as `BaseAiHelper`, may use `Effect.runPromise`. Never `runSync` in a request path.
- Typed domain failures: `new DomainError({ status, code, params? })` with a code from `src/common/errors/app-error.ts`. Anything else that fails or dies ends up as a logged 500.
- Inside an Effect, fail only with tagged errors (`Data.TaggedError`, effect's own). A plain `Error` subclass in the error channel makes TypeScript drop structurally compatible members such as `TimeoutError` from the union, so a handler silently misses them. Translate to Nest exceptions at the boundary with an exhaustive `switch` on `_tag` (see `toListingException` in `bank-sync/simplefin.provider.ts`).
- Nest services stay the composition root. Pass what an Effect needs as arguments or `Effect.provideService`; do not register Nest providers as Layers.
- Log at the Nest boundary with the class `Logger`, and never log a URL that carries an API key.
- Tests run under Jest: call the service, or `effects.run(...)`, and assert on the result. Mock HTTP with `global.fetch` returning a real `Response`; `EffectRuntime` reads `globalThis.fetch` per request. A body can be read once, so build a fresh `Response` per call (`mockImplementation(async () => new Response(...))`). The client passes a `URL`, so match with `String(input)`. Simulate a timeout with a fetch that settles only when `init.signal` aborts; a rejected fetch is a network failure, not a timeout.

## Frontend
- Type responses by contract with `apiQueryDecoded({ ..., contract: 'Name' })` / `checkContract('Name', payload, url)` from `app/lib/query-fn-schema.ts`. Outside production they also check the payload and throw `ContractMismatchError` on drift; production compiles the check out, so effect (~67 kB gzip in the webpack build) never ships.
- `apiQueryDecoded` unwraps a top-level `data` key (`unwrapEnvelope`). For a page that has one (`{ data, total }`), use `apiClient.get` and `checkContract` on the raw body.
- Request bodies: `payload satisfies ContractInput<'Name'>`. `satisfies` does not catch extra fields on a variable or a spread, so a body built from loose records goes through `checkBody('Name', body, url)` instead.
- Mutation answers the page keeps go through `checkContract` too, not `response.data as X`.
- Test fixtures are in the wire format, since outside production every response is checked. Build them with the helpers in `app/test/fixtures/contracts.ts` and override only what the test is about.
- Import contracts as types only (`import type`). Only `app/lib/contract-check.ts` imports the schemas as values; `contract-imports.test.ts` enforces it.
- Import Effect by subpath (`effect/Schema`, `effect/Exit`); Biome rejects the `effect` barrel.
