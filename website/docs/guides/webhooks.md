---
title: Webhooks
description: Send statements and receipts into Seneca from other tools, and get told when something happens in a workspace
---

Webhooks live in **Plugins → Webhooks** and work in two directions.

## Inbound: upload from other tools

An inbound endpoint is a secret URL that accepts files without a login. Create one, copy its token
(it is shown once) and send files to:

- `POST /api/v1/webhooks/<token>/statements` — a bank statement (PDF, CSV, XLSX, OFX/QFX, QIF,
  camt.053, MT940)
- `POST /api/v1/webhooks/<token>/receipts` — a receipt (photo, PDF or e-invoice XML)

Send the file as multipart field `file`, or as JSON `{ "fileBase64": "…", "fileName": "march.pdf" }`.
Statements may name a `walletId` and `branchId`; the endpoint's defaults apply otherwise. Files land
in the workspace as if its owner had uploaded them.

## Outbound: events

A subscription sends a `POST` with a JSON body to your URL whenever one of its events happens. The URL
must be public (no private or loopback addresses). Every body has `event`, `workspaceId` and
`timestamp` (ISO 8601) next to the event's own fields.

| Event | When | Fields |
|---|---|---|
| `transaction.created` | One transaction was added: a manual expense, a receipt scan, an approved receipt booked as new, a bill paid in cash, a row recovered from a statement's warnings | `transactionId`, `amount`, `currency`, `transactionDate` (YYYY-MM-DD), `counterpartyName`, `transactionType`, `source`, `statementId`, `categoryId` |
| `transactions.imported` | A batch arrived: a statement or import was committed, a custom table became a statement, an entity import ran, a crypto wallet synced or its CSV was imported | `source`, `statementId`, `count`, `transactionIds` (at most 500), `truncated` |
| `statement.uploaded` | A statement file was uploaded | `statementId`, `statementName`, `bankName` |
| `statement.processed` | Its transactions were committed | `statementId`, `transactionCount` |
| `statement.failed` | Parsing or the import failed | `statementId`, `statementName`, `stage` (`parsing` or `import`), `errorMessage` |
| `transactions.uncategorized` | A processed statement left rows without a category | `statementId`, `count` |
| `receipt.needs_review` | A receipt was read but needs a person | `receiptId`, `source`, `reasons` (`missing_amount`, `possible_duplicate`) |
| `receipt.approved` | A receipt was approved | `receiptId`, `transactionId`, `mode` (`created`, `attached_to_bank_row`, `confirmed_scan`) |
| `invoice.paid` / `bill.paid` | Money owed to the workspace (an invoice) or by it (a bill) was paid in full | `payableId`, `direction`, `source`, `vendor`, `amount`, `currency`, `paidAt` |
| `invoice.overdue` / `bill.overdue` | It passed its due date unpaid | `payableId`, `direction`, `source`, `vendor`, `outstanding`, `currency`, `dueDate` |
| `budget.exceeded` | A budget's spending reached its limit this period (once per period) | `budgetId`, `name`, `categoryId`, `limitAmount`, `spentAmount`, `percentUsed`, `currency` |
| `tax.deadline.upcoming` | A VAT or income-tax return is due soon | `kind`, `returnName`, `periodStart`, `periodEnd`, `dueDate`, `daysLeft` |
| `tax.threshold.reached` | Taxable turnover crossed a registration-threshold step | `level`, `turnover`, `threshold`, `currency`, `percentUsed`, `periodStart`, `periodEnd` |

A large batch lists the first 500 ids and sets `truncated`; read the rest with
`GET /api/v1/transactions?statementId=…`.

### Headers and the signature

| Header | Value |
|---|---|
| `X-Seneca-Event` | The event name |
| `X-Seneca-Delivery` | The delivery id, the same on every retry: use it to ignore repeats |
| `X-Seneca-Signature` | `sha256=` + hex HMAC-SHA256 of the raw body with the subscription's secret |

Check the signature over the raw body before parsing it:

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

function isFromSeneca(rawBody, header, secret) {
  const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

### Retries

A delivery that does not get a `2xx` answer within 10 seconds is tried again after 30 seconds and
then 5 minutes; after the third attempt it is given up. Redirects are not followed. Each subscription
keeps its delivery log (`GET /api/v1/webhook-subscriptions/<id>/deliveries`), and a failed delivery
can be sent again with `POST /api/v1/webhook-deliveries/<id>/retry`. **Test** in the panel queues a
`statement.processed` body with `"test": true`.
