---
paths:
  - "backend/**"
  - "frontend/**"
  - "packages/contracts/**"
---

# Effect and API contracts

Effect (`effect` 4.x) is adopted incrementally. NestJS, TypeORM, React Query and axios stay; Effect is used where typed errors, timeouts/retries or runtime validation pay off.

## When to use it
- **New external I/O** (provider APIs, bank sync): write the call as an Effect with a timeout, a retry policy for transient failures and a Schema-decoded response. Example: `backend/src/modules/exchange-rates/exchange-rates.http.ts`.
- Outbound HTTP goes through `common/effect/http-json.ts`: `getJson` (decode, retry 429/5xx/network) or `getWith` (the caller reads status, headers, text or bytes). Both run the whole exchange, body included, inside one timeout.
- Retry only where the provider's quota allows it. Openverse (200 searches a day), Nominatim (1 request a second), CoinGecko's free tier and the icon sources are asked once; a failure falls back (cache, last known value, "unavailable").
- Kept on plain `fetch` on purpose: `webhook-processor` (pinned-DNS agent, retries are durable rows), `model-proxy` (streams, manual redirects), `fetchPublicUrl` (the SSRF guard for user-supplied URLs), and calls that need an `AbortSignal` API through `attemptWithRetry` (Telegram, SMTP).
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
- Request bodies: `@SchemaBody(Contract) body: Contract` from `src/common/effect/schema-body.ts`. It rejects unknown properties and answers 400 `REQUEST_INVALID` with `details.issues` naming each failing field.
- Query strings and route parameters: `@SchemaQuery(XQuery) query: XQuery` / `@SchemaParams(XParams) params: XParams` from `src/common/effect/schema-query.ts`, with the schemas in `packages/contracts/src/requests/queries.ts`. Values arrive as strings, so numbers are `NumericInput`/`PageInput`, booleans `BooleanInput`, lists `StringListInput` (repeated keys or comma-separated), dates `IsoDateString`/`DateOnlyInput`; an empty value (`?page=`) is dropped before decoding, and unknown keys are a 400 as with the DTOs. Do not mix `@SchemaQuery` with `@Query('x')` in one handler: `x` would be an unknown key. Map literals onto entity enums with `toEnum`.
- Optional body fields are `optionalNullable(X)` (`common/requests.ts`): `@IsOptional()` accepted null, and clients send null to clear a field. On create, spread `withoutNulls(body)` so a column default applies; on update, `undefined` leaves a field, null clears a nullable column and leaves a NOT NULL one (`withoutNullsOnRequired(repository.metadata, body)`, which `WorkspaceCrudBaseService.update` already applies). Convert contract literals to entity enums with `toEnum(Enum, value)`.
- Answers: `@SchemaResponse(Contract)` from `src/common/effect/schema-response.ts` on every handler a contract describes. The answer is serialized, reduced to the keys the contract declares at every depth, then checked: outside production a drift is a 500 (e2e catches it), in production it is logged and still leaves projected. So an entity row cannot hand out a column or a joined account the contract does not name. The contract is the public answer of the endpoint, for the MCP server and API keys as well as the app: a field an integration needs belongs in it.
- Never sent, whatever the handler: `SERVER_ONLY_KEYS` (`common/utils/sensitive-keys.util.ts`: file paths, hashes and bytes, credentials) are stripped by a global interceptor. Account details (`ACCOUNT_KEYS`: Telegram ids, last login) leave only in a person's own profile; the audit trail drops them on write and on read.
- Every e2e app runs `LeakGuardInterceptor` (`@tests/e2e/helpers/leak-guard.ts`): an answer with an account detail or a file internal fails the request, except the own-profile handlers it lists.
- An id a request carries is looked up with the caller's workspace (`{ id, workspaceId }`, `In(ids)` plus `workspaceId`), never by id alone: a category, tag, tax rate or transaction of another workspace is "not found". `findByIds` and a bare `findOneBy({ id })` put another workspace's rows in reach.
- Text Postgres cannot store (a NUL, a lone surrogate) is a 400 from the schema pipes. A value Postgres refuses (SQLSTATE class 22: out of range, too long, malformed) is a 400 from `HttpExceptionFilter`, a delete of a record still in use (23503) a 409; neither is a 500.
- `@tests/e2e/workspace-isolation-sweep.e2e-spec.ts` aims every route at another workspace: B's ids in paths and bodies (bodies generated from the `@SchemaBody` contract), B's workspace in the header. It fails on B's data in an answer, a change to B's rows, a row of A's pointing at one of B's, and any 500. A new route is covered by itself; a new kind of record needs a step in `@tests/e2e/helpers/seed-workspace.ts`.
- A private transaction is redacted (`redactPrivateRows`) on every path that answers rows, not only the list: file details, the statement, a shared link.
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
- Request bodies and query params: `payload satisfies ContractInput<'Name'>` (`params: {...} satisfies ContractInput<'StatementsQuery'>`). `satisfies` does not catch extra fields on a variable or a spread, so a body built from loose records goes through `checkBody('Name', body, url)` instead.
- The api client is strict: `apiClient.get/post/…` take no type arguments and answer `UncheckedResponse` (`data: unknown`), and `apiQuery` answers `unknown`. The compiler is the scanner: an answer the page reads has to go through `checkContract`/`apiQueryDecoded`, or it does not compile.
- Mutation answers the page keeps go through `checkContract` too, never `response.data as X`. A mutation whose answer nothing reads is `async () => { await apiClient.post(...); }`, so it returns `void`.
- A download (`responseType: 'blob'`) reads its body with `blobOf(response)` from `app/lib/api.ts`, which checks it is a `Blob`.
- Free-form JSON the backend stores (`parsingDetails`, view preferences) is typed key by key: a contract with `Schema.StructWithRest` for the keys the app reads, or a `read` function that narrows `Record<string, unknown>` with `typeof` checks. Never a caller-chosen generic over the answer.
- In tests, mock an api call with `apiResponse(data)` from `app/test/api-response.ts`, which builds a typed `UncheckedResponse`.
- Test fixtures are in the wire format, since outside production every response is checked. Build them with the helpers in `app/test/fixtures/contracts.ts` and override only what the test is about.
- Import contracts as types only (`import type`). Only `app/lib/contract-check.ts` imports the schemas as values; `contract-imports.test.ts` enforces it.
- Import Effect by subpath (`effect/Schema`, `effect/Exit`); Biome rejects the `effect` barrel.
