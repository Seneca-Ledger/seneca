# Review queue, documents archive, bills — 2026-10-04

## Why

The Statements page had a Submit → Approve → Pay stage chain borrowed from Expensify.
Lumio's users (Home: individuals and couples; Business: freelancers and micro-business)
have no approver role, so "Approve" was always self-approval, and receipts could never
leave it (Pay refuses receipts). Three places asked the same "have I checked this?"
question: Submit (per document), Review (per row) and Unapproved cash (computed in the
browser, ignore stored in localStorage). Pay was chained to the stages, although a bank
statement or a receipt is money already spent; the statement-page "Pay" button never
produced a single payable in the dev data.

## Model

- **Review** (sidebar) is the only queue of decisions: uncategorised rows, duplicates,
  receipts waiting for approval, subscriptions. Later: "this is a bill" and
  "looks like the payment of bill X".
- **Statements** is the archive of documents, tabs **Documents | Pay | Receive**.
  A document's state is derived: "N to review" while Review still has its rows or the
  receipt is not approved, otherwise done. No stage buttons.
- **Pay / Receive** are obligations (what I owe / what I am owed). They are linked to
  the queue through money: a bank row that matches an open bill closes it.

## Steps

1. Queue → Review, Statements → documents.
   - Remove the Approve and Unapproved cash tabs (routes redirect to `/review`), the
     bulk Submit/Unapprove bar buttons and the stage buttons on the statement page
     (incl. the statement → payable "Pay").
   - Documents tab (route stays `/statements/submit` for now) lists every statement and
     receipt regardless of `stage`, with a "to review" marker.
   - Review lists every receipt awaiting approval (not only `needs_review`).
   - Approving a scanned receipt confirms the transaction the scan already booked,
     with the receipt's current data, instead of booking a second one.
   - The `stage` columns and `/statements/stage`, `/receipts/stage` stay untouched;
     dropping them is a later migration.
2. Review: "looks like the payment of bill X" (reuses `smb/reconciliation.util.ts`).
3. Review: "this is a bill" → creates a payable in Pay and leaves the queue.
4. Hide Receive in the Home profile.

## Confirmed-only numbers (decided 2026-10-04)

The user decided: nothing counts anywhere until a person confirmed it.

- A transaction counts only when `isVerified = true`. Imported, synced, scanned and
  converted rows are born unconfirmed and wait in Review; rows a person entered
  (manual expense, cash payment of a bill, approved receipt, converted parser sample)
  are born confirmed. Approving a receipt confirms its transaction.
- Review lists every unconfirmed row, whatever set its category (rule, history, AI,
  transfers). "Trust AI picks" is removed. A statement can be confirmed at once
  (`POST /review-inbox/statements/:id/approve`, categorised rows only).
- Existing data is not migrated: what is unconfirmed today stays out until approved.
- Applies to every derived number: dashboard, reports and exports, scheduled reports,
  budgets and alerts, goals, forecast, balances and net worth, ledger postings, tax
  (VAT, threshold, income tax), insights and stoic advice, subscription detection,
  SMB reconciliation, bill payment candidates, investments, crypto flows, custom-table
  "fill from Lumio", and client-side analytics built from `/transactions`.
- Not filtered: the transactions list itself (shows a marker), a statement's own
  totals and edit view, category usage counts, income-tax completeness (activity days).
- Helper: `backend/src/common/utils/counted-transactions.util.ts` (`onlyCounted`, `countedSql`,
  `countedWhere`): confirmed, not a suspected duplicate, not on a trashed statement. Transfers
  between own accounts are excluded by each income/expense caller, never by the helper, since
  wallet balances and the balance sheet need them.
- Screens with numbers say how much is still unconfirmed and link to Review.
