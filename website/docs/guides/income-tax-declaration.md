---
title: Income Tax Declaration
description: Year-end income tax drafts for the self-employed
---

**Tax Declaration** (`/tax-declaration`) turns a workspace's categorized transactions into a draft of
the annual income tax return. It is separate from the VAT engine.

:::caution
Seneca does not file anything with a tax authority, and a draft is not tax advice. Check every figure
before you file.
:::

![Tax declaration profile step for a German freelancer filing Anlage EÜR](/img/screenshots/tax-declaration.png)

## The wizard

Before the first use, each user accepts a disclaimer. The wizard then has five steps:

1. **Profile** — country, tax year and taxpayer type (plus the regime where the form depends on it).
2. **Data check** — a completeness score from 0 to 100 with the issues to fix: uncategorized
   transactions, unmapped categories, missing exchange rates, gaps in statement coverage, statements
   with errors or awaiting review, receipts awaiting review, stale uploads and irregular tracking.
   The score is a heuristic, not a guarantee.
3. **Mapping** — assign categories to form lines. Seneca suggests lines for the default categories,
   but **only mappings you confirm count**; suggestions never reach the draft.
4. **Draft** — the figures per line, with the transactions behind each one, warnings and, where the
   form supports it, a tax estimate.
5. **Export** — download the draft as PDF or XLSX.

Finalizing a year stores a snapshot of the draft, so later changes to transactions do not alter it.
Reopening returns the year to a live draft.

## Supported forms

| Country | Form | Tax years | Chosen when |
|---|---|---|---|
| Germany | Anlage EÜR | 2025, 2026 | self-employed |
| Spain | Modelo 100 — estimación directa simplificada | 2025, 2026 | self-employed |
| Poland | PIT-36L | 2025, 2026 | self-employed, regime `liniowy` |
| Poland | PIT-28 (ryczałt) | 2025 | self-employed, regime `ryczalt` |
| Poland | PIT-36 | 2025 | self-employed, regime `skala` |
| Everywhere else | Annual income and expense summary | any | fallback |

A form is listed only once its figures were checked against the published form.

## Currency conversion

Foreign-currency amounts are converted with the rule the country prescribes, where one was verified:

- **Poland** — the NBP table A rate of the last business day before the transaction date.
- **Italy** — the Banca d'Italia reference rate of the day, or the nearest earlier day, falling back
  to the monthly average.
- **Everywhere else** — the rate for the transaction's own date, marked as an assumption.

When no rate is available, the amount is reported as a missing exchange rate — it is never converted
at 1.

## Filing information

For tax year 2025 the draft shows the form, deadlines, filing portal and, where verified, record
retention periods for 25 EU countries: AT, CY, CZ, DE, DK, EE, ES, FI, FR, GR, HR, HU, IE, IT, LT,
LU, LV, MT, NL, PL, PT, RO, SE, SI, SK. Anything not verified is left out rather than guessed.

## Permissions and API

Reading drafts needs the report view permission; changing the profile or mappings and finalizing
need workspace settings management (owner or admin).

| Method | Route | Purpose |
|---|---|---|
| `GET` / `POST` | `/api/v1/income-tax/disclaimer` | Disclaimer status / accept |
| `GET` / `PUT` | `/api/v1/income-tax/profile` | Profile for a tax year |
| `GET` / `PUT` | `/api/v1/income-tax/mappings` | Category → line mappings |
| `GET` | `/api/v1/income-tax/returns/:taxYear` | Draft (or the finalized snapshot) |
| `POST` | `/api/v1/income-tax/returns/:taxYear/finalize` | Finalize the year |
| `POST` | `/api/v1/income-tax/returns/:taxYear/reopen` | Reopen a finalized year |
| `GET` | `/api/v1/income-tax/returns/:taxYear/export?format=pdf\|xlsx` | Download the document |

Next: [Observability](observability)
