# Bankstatemently open benchmark (bsb)

Synthetic statements from fictional banks, taken from
[bankstatemently/bank-statement-parsing-benchmark](https://github.com/bankstatemently/bank-statement-parsing-benchmark)
at commit `2d8d31d6`, dataset version 2.4. MIT licensed, see `LICENSE`.

| File | Country | Layout | Rows |
|---|---|---|--:|
| `bsb-001.pdf` | Singapore | debit/credit columns, multi-line descriptions | 12 |
| `bsb-002.pdf` | US | credit card, post + trans date, no year, continuation rows | 15 |
| `bsb-003.pdf` | Netherlands | counterparty + IBAN column, `1 mei`, `-1.450,77 €` | 22 |
| `bsb-004.pdf` | Hong Kong | two accounts (HKD, USD) in separate tables | 15 + 10 |
| `bsb-005.pdf` | Canada (French) | `02 janv. 25`, `1 200,45 $` | 25 |

The benchmark keeps its answers on its own server, and the example submission
in its repo predates a reissue of bsb-001, so the fixtures here were built by
hand from the PDFs. Every row is checked against the statement: running
balances row by row where printed, and the printed totals (and, for bsb-004,
the deposit/withdrawal totals of each account).

Conventions:

- `counterpartyName` is the whole description cell, lines joined with a space.
  bsb-003 has its own counterparty column: the name goes there, the IBAN into
  `counterpartyAccount` and the description into `paymentPurpose`.
- The booking date wins where a row prints two: Post Date (bsb-002), Date (bsb-003).
  A missing year comes from the statement period.
- bsb-002 is a card: balances are what is owed, so they are negative, and the
  `0.00` lines under a charge are part of its description, not rows.
- bsb-004 prints no opening balance; it is the first row undone
  (42,580.00 HKD, 150,000.00 USD). Its fixture lists both accounts under `accounts`.
- bsb-005: "Frais sur compte" under the table is a note, not a row; the
  printed debit total excludes it.

When the benchmark reissues a PDF (its README keeps a changelog with hashes),
replace the file and re-verify the fixture rather than re-recording it.
