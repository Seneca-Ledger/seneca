# Parser submissions

A Cloudflare Worker that receives statement layouts users taught their
instance and chose to share ("Help the project" after Teach), and files each
as an issue in the private `stoic-budget/parser-submissions` repository.

A layout holds the printed words of a statement's column headings and
balance labels, where its columns sit and the bank's name: never a figure, a
description, a name or the file (`src/submission.ts` refuses anything else).
The Worker stores nothing and does not log request bodies. It answers 201
`{ received: true }` and nothing about the issue.

## Deploy

Free Workers plan; one GitHub request per submission.

1. A private repository `stoic-budget/parser-submissions`.
2. A fine-grained GitHub token for that repository only, with Issues: read and write.
3. From this folder:

   ```sh
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler deploy
   ```

4. The URL Wrangler prints, plus `/submit` (now
   https://stoic-parser-submissions.peterbaikov12.workers.dev/submit), is the default of
   `PARSER_SUBMISSIONS_URL` in `backend/src/modules/parsing/services/layout-share.config.ts`.

## Test

```sh
npm run test:parser-submissions
```

## From a submission to the parser

Save the issue's JSON block to a file, then from `backend/` (in the dev
container):

```sh
node scripts/layout-to-golden.mjs submission.json <bank-name>
```

It writes an invented statement in that layout (`golden/<bank-name>/synthetic.pdf`)
and what reading it must give, and prints the entry to add to
`CONTRIBUTED_LAYOUTS` in `src/modules/parsing/helpers/contributed-layouts.ts`.
The statement is printed the way the bank prints (the submission's `print`:
date and amount shapes with digits as #, the minus, marks such as CR/DR,
two-line descriptions, a second page with or without the headings, type size
and row spacing, the currency), so the case tests what the bank's real files
put to the parser. Its headings are read only in files that name the bank, so a wrong submission
cannot misread another bank's statements. With it in place,
`GOLDEN_ENABLED=1 npx vitest run --project golden` reads the case.

## Is it true?

A submission cannot be proven: the Worker is public and nothing comes with the
statement itself. What helps:
- **Reading (reported)** in the issue: rows read, whether the running balance
  and printed totals held, statements read with it. An honest user's signal.
- **Layout key**: the same headings from anyone join one issue as comments. Many
  independent submissions are hard to fake; conflicting roles show up there.
- **Bank-scoped**: an accepted layout reads only its own bank's files.
- **After release**: a wrong layout fails the parse checks on real statements,
  which wait for review and show on the admin Parser health page.

## Pull requests from submissions

`workflow/propose-layout.yml` runs in the parser-submissions repository on each
new layout issue (repeats are comments and do not run it). It vets the
submission (`backend/scripts/layout-submission-vet.mjs`): refused without the
bank's name, for a bank with a parser of its own, without date, description and
money columns, without a reported reading that held (rows, running balance or
printed totals), or for a bank already contributed; common heading words and a
single statement are flagged for a look. Then it writes the golden case and the
entry in `contributed-layouts.data.ts`, runs the golden set and opens a pull
request in the project. The maintainer merges it; nothing merges by itself.
The issue gets a comment and a label: proposed, not-proposed or proposal-failed.

Set up once:

1. A fine-grained token for `stoic-budget/stoic-budget` with Contents and Pull
   requests read and write, saved in parser-submissions:
   `gh secret set MAIN_REPO_TOKEN --repo stoic-budget/parser-submissions`.
2. The workflow file at `.github/workflows/propose-layout.yml` in
   parser-submissions.

It runs the project's main branch, so it needs this code merged there.
`workflow_dispatch` proposes an existing issue again.

The project's CI runs the golden set (`golden` job) whenever parsing, the PDF
reading or `backend/golden` changes, so a proposed layout is checked there too.
