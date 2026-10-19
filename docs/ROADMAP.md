# Roadmap

What Seneca is working towards, in the order we intend to do it. Derived from the 2026 research
into what people expect from a finance app (`docs/plans/2026-10-01-user-expectations-2026-research-plan.md`);
that document has the evidence behind every line here. Dates are intentions, not promises.

## Phase 0 — data you can trust (done 2026-10-01)

- [x] Transfers between own accounts paired automatically and by hand, excluded from spend and income.
- [x] Reimbursements linked to the expense they pay back; full repayments leave the aggregates.
- [x] Category provenance on every transaction, a fixed and visible order, a sticky manual pick.
- [x] Switches for AI categorisation, AI merchant names and learning; the "two corrections" guard.
- [x] Duplicate detection never matches rows from two different accounts.
- [x] This roadmap, the changelog entries and the UI stability principles (`docs/ui-principles.md`).

## Phase 1 — less manual work

- [x] Review inbox (2026-10-01): one queue for uncategorised and AI-categorised rows, receipts
      without an amount, suspected duplicates and detected subscriptions; keyboard-first on desktop,
      swipe on mobile; group by payee; a date range for "vacation mode"; "Trust AI picks" switch;
      a weekly "N waiting" notification.
- [x] Receipt → transaction match and one-click split by line-item category; Amazon orders matched to
      several charges; receipts embedded in email bodies, not only attachments (2026-10-01).
- [x] Telegram inbound: send a photo, a PDF or "coffee 4.50" to the bot and it lands in the review queue (2026-10-01).
- [x] Subscriptions 2.0: price-change alerts with the yearly effect, duplicate subscriptions, cost per
      use, bills and invoices in the charge calendar, sinking-fund goals for annual bills, an off switch
      for "is this recurring?" prompts (2026-10-01).
- [x] Budget mechanics: rollover (carry / refill up to the limit), parent-category budgets, a warning
      under a manual entry when it would push a budget over or overdraw the account (2026-10-01).
- [x] Workspace profile Home / Business: the home profile hides invoices, ledger, tax declaration and
      custom tables from the menu; picked at creation, switchable in Settings (2026-10-01).

## Phase 2 — planning ahead

- [x] Cash-flow forecast for 30/90/365 days from subscriptions, payables, invoices, goals, detected
      paydays and the everyday average; "safe to spend"; scenarios; runway for a business (2026-10-01).
- [x] Investments v1: investment and retirement accounts with manual holdings and ticker prices;
      contributions count as transfers; net worth with 1M–5Y/All ranges, an all-time high and an
      asset-class split (2026-10-01).
- [x] Reports: cash-flow Sankey, treemap, period comparison, "include transfers and investments"
      switch, category All/None filters, CSV export (2026-10-01).
- [x] MCP and AI as a trusted agent: scoped API keys, every AI/MCP write audited as its actor and
      undoable, MCP setup and security posture pages on the website (2026-10-01).
- [x] Small-business pack: bank reconciliation screen, AR/AP ageing, dunning reminders, duplicate
      payables, a business-subscriptions report with owners (2026-10-01).

## Phase 3 — by decision

- [x] Optional bank sync through the user's own provider account: SimpleFIN Bridge (open protocol,
      the user's own paid account, setup token → encrypted credential, pulls as OFX through the
      regular import, per-account switches and wallets, every 6 hours or on demand). README now says
      "Seneca holds no bank integration of its own; you may connect your own provider account".
      Enable Banking (EU/UK) is not wired: it needs an application registered with them.
- [x] Mobile layer: service worker with an offline queue for manual entries and receipt photos, web
      push for alerts, home-screen shortcuts (2026-10-01).
- [x] Import formats: OFX/QFX, QIF, camt.053, MT940, CSV presets for 22 banks, forwarded statements
      from the IMAP mailbox (2026-10-01).
- [x] Multi-currency audit: original amount and currency visible in the drawer with the rate used,
      manual rate override, a missing rate reported on the dashboard and in settings instead of a
      silent 1.0 (2026-10-01).
