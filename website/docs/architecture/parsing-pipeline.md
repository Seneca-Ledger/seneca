---
title: Parsing Pipeline
description: Upload -> parse -> review -> commit
---

The parsing pipeline is designed for reliability and repeatability. Every import is tracked as a session and can
be previewed, audited, or reprocessed.

## Pipeline stages

1. **Upload**
   - Files go to the uploads directory: `UPLOADS_DIR`, otherwise `./uploads` (`/app/uploads` in Docker)
   - A SHA-256 hash is computed to catch duplicate uploads
   - Up to 10 MB per file

2. **Queue**
   - Parsing runs asynchronously in the BullMQ statement parsing queue (`parsing/queue`)
   - `STATEMENT_PARSING_CONCURRENCY` (default 5) limits how many statements are parsed at once

3. **Parser selection**
   - `ParserFactoryService` detects the bank from the document text (bank name, then BIC) and holds the parsers:
     Bereke (new layout), Bereke (old layout), Kaspi, Hapoalim, generic PDF, Excel, CSV, and DOCX
   - `OcrService` (tesseract.js) extracts text from images and scans

4. **Quality gate**
   - `StatementQualityGateService` rates the parsed statement `ready`, `review`, or `blocked`

5. **Import session: preview and commit**
   - An `import_sessions` record tracks the status: `pending`, `processing`, `preview`, `completed`, `failed`,
     or `cancelled`
   - `GET /statements/:id/import-preview` shows the parsed rows and their conflicts with existing transactions
   - `POST /statements/:id/import-commit` saves them; each conflict is resolved as `skip`, `force_import`, or
     `mark_duplicate`

6. **Categorization**
   - Your categorization rules apply first, in priority order
   - Payee history fills the rest: a payee's default category moves only when two of its three most recent
     confirmed rows agree; anything left is *Uncategorized* and goes to **Review** — see
     [Categorization](../guides/categorization)

7. **Deduplication**
   - Transaction fingerprints plus fuzzy matching on date, amount, and text
   - Uncertain matches are flagged for manual review

## Error handling

- Parsing errors are captured on the statement and its import session
- `POST /statements/:id/reprocess` reruns parsing without re-uploading
- Logs are structured JSON with request and trace IDs; parsers log volumes and outcomes, never transaction
  contents

## Related code

- `backend/src/modules/parsing`
- `backend/src/modules/import`
- `backend/src/modules/classification`

Next: [Importing Statements](../guides/importing-statements)
