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
and what reading it must give, and prints the heading phrases to add to
`HEADINGS` in `src/modules/parsing/helpers/pdf-layout-columns.helper.ts`. With
them in place, `GOLDEN_ENABLED=1 npx vitest run --project golden` reads it.
