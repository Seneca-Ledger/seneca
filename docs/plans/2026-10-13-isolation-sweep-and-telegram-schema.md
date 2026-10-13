# Workspace isolation sweep and a schema for the Telegram webhook

Research for two follow-ups to the response contracts (PR #291). Both were
prototyped on 2026-10-13. The numbers below come from that run, not estimates.

## 1. Automatic workspace isolation tests

### What the existing tests cover

`workspace-isolation.e2e-spec.ts` checks Gmail receipts, cloud storage and the
storage pages by hand. The API has 668 routes, and 307 of them take an id in the
path. Hand-written cases cannot keep up with that.

Every route behind `WorkspaceAuth`/`WorkspaceContextGuard` checks membership of
the workspace in `x-workspace-id`. Isolation then depends on each service
filtering by that workspace. A missed filter in a by-id query is the bug class
to catch: user A, in their own workspace, passes an id from workspace B.

88 handlers have no workspace guard. They are mostly account-level (auth, users,
workspaces, push). Storage checks access per file with `checkFileAccess`.

### The prototype

A throwaway e2e suite, deleted after the run:

1. Register two accounts, A and B. Seed B through the API: categories, a manual
   expense, a wallet, a goal with a contribution, a budget, a payable with a
   payment, a client with an invoice, a custom table with a row, a tag, a
   folder, a tax rate and a note.
2. Collect B's ids from the database: every row of every table that has a
   `workspace_id` column.
3. Enumerate the routes from the running app (`expressApp.router.stack`). Then,
   as A in A's workspace:
   - **Reads.** Call every GET route, substituting B's ids into the path
     parameters. A leak is any 2xx answer that contains one of B's ids.
   - **Writes.** Call every POST, PUT, PATCH and DELETE route that takes a
     parameter, with B's ids. Fingerprint all of B's tables with `md5` before
     and after; any difference is a leak.

Result:

| | |
|---|---|
| GET routes | 281 |
| Read requests | 4 754 (31 s) |
| Read leaks | 0 |
| Positive control (B over its own lists finds B's ids) | 35 routes |
| Write requests | 11 144 |
| B's tables changed | none |
| Statuses | 404: 6 767, 400: 3 080, 403: 737, 500: 280, 401: 112, 2xx: 168 |

The positive control matters: the same scanner finds B's ids when B reads its
own lists, so zero leaks means zero leaks, not a blind scanner.

### Findings from the prototype

- **No cross-workspace read or write** for the seeded data.
- **Wrong statuses on foreign or unknown ids.** "Not found" is thrown as a plain
  `Error`, which becomes a 500:
  - `PUT` and `DELETE /categorization-rules/:id`;
  - `POST /transactions/:id/unmark-duplicate`;
  - `POST /import-sessions/:id/cancel`;
  - `POST /classification/transaction/:id`.
- **Success on any id, with nothing changed.** These should be 404:
  - `DELETE /receipts/:id`;
  - `DELETE /reports/balance/accounts/:id`;
  - `POST /insights/:id/dismiss`.

### Limits of the prototype, and how to close them

- **Bodies.** 3 080 write requests stopped at validation (400), because `{}` is
  not a valid body. The ownership check behind them never ran. Effect 4 ships
  `Arbitrary.schema(schema)` with `Arbitrary.sampleEffect`, which generates
  valid values from a schema (checked: `CreatePayableBody` gives
  `{"vendor":"AVr","amount":0}`). Two pieces are needed to use it:
  - `SchemaBody` also records its schema as metadata;
  - the sweep reads routes and handlers through Nest's `DiscoveryService`, so it
    knows each route's body contract and can send a valid, encoded body.
- **Seed coverage.** The seed reached 21 of 71 workspace tables. A permanent
  suite needs a fixture that creates every kind of record:
  - receipts, ledger accounts and journal entries;
  - subscriptions, crypto wallets, metals and investments;
  - review items, report schedules, webhooks;
  - storage views and shares.

  The contracts e2e already creates most of these and is the place to borrow
  from.
- **Parameters.** One id is substituted into every parameter of a route. Routes
  with two ids (`/custom-tables/:id/rows/:rowId`) want one id from each table.
  Matching parameter names to tables (`:rowId` → `custom_table_rows`) fixes that.

### Proposed permanent suite

`workspace-isolation-sweep.e2e-spec.ts`:

- route discovery through `DiscoveryService`;
- an "every record" seed for B;
- the read sweep with its positive control;
- the write sweep with schema-generated bodies;
- the fingerprint comparison.

Known no-op routes go in an allowlist until they are fixed to answer 404. The
suite fails on any read leak, any change to B, and any 500. Expected cost: about
2 minutes of e2e time.

Defense in depth, later and optional: Postgres row-level security with the
workspace id set per request. Today a missing `workspaceId` filter is caught
only by tests. Under RLS the database itself would refuse the row. It needs a
`SET LOCAL` per transaction and policies on 71 tables, so it is a project of its
own.

## 2. A schema for the Telegram webhook body

### Today

`POST /telegram/webhook` takes `@Body() update: TelegramUpdatePayload`, a
TypeScript interface:

- the global ValidationPipe skips it;
- nothing checks the body at runtime;
- `TelegramWebhookGuard` compares the secret header in constant time, so only
  Telegram (or someone holding the secret) gets this far.

The service reads:

- `update_id`;
- `message.{chat.id, text, caption, from.id, from.language_code, photo[], document}`;
- `callback_query.{id, data, from, message.chat.id}`.

It is the last request body without a schema outside Gmail, Drive and Dropbox,
which are being removed. The inbound webhooks (`/webhooks/:token/...`) already
use `@SchemaBody`.

### Design

- **A backend-only schema** in the telegram module (`telegram-update.schema.ts`):
  Telegram, not the app, is the client, so it does not belong in
  `packages/contracts`. It covers only the fields above:
  - ids as `Number | String`;
  - `photo` as an array of `{ file_id, file_size?, width?, height? }`;
  - `document` as `{ file_id, file_name?, mime_type? }`;
  - text capped at Telegram's 4 096 characters.

  The service's interfaces become `typeof Schema.Type`.
- **Lenient on extra fields**, decoded with `onExcessProperty: 'ignore'`.
  Telegram adds fields to its updates over time, and an update kind the bot
  does not handle still arrives.
- **Never a 400.** Telegram retries an update that gets a non-2xx answer, and
  undelivered updates pile up meanwhile. A malformed update is logged with its
  `update_id` and answered `{ ok: true }`. It is decoded in the controller
  (`decodeUnknownExit`), not with `@SchemaBody`, which answers 400 by design.
- **Tests:**
  - unit decoding: a photo update, a document update, a callback query, an
    unknown kind, a wrong type;
  - e2e: a malformed update with a valid secret answers 200 and books nothing.

Effort: about half a day, schema, controller, typing and tests.
