---
title: Importing Statements
description: Uploads, supported formats, and validation
---

Lumio accepts multiple statement formats and standardizes them into a consistent transaction model.

## Supported inputs

- PDF — native parsers for supported banks, and a generic table parser for the rest
- CSV, XLSX and XLS exports
- DOCX files with statement tables
- Images (JPG, PNG, TIFF, BMP, WEBP) via OCR

Each file may be up to 10 MB, and one upload request takes up to 5 files. See
[Supported Banks](../reference/supported-banks) for the native parsers.

Files can also come in without a manual upload: S3-compatible and WebDAV storage sync, an IMAP inbox
for receipts and invoice attachments. CSV and Excel files can also be imported into a custom table.
See [Integrations](integrations).

## Import flow

1. Upload a file from the Statements page.
2. Lumio checks the file hash, then parses the file in a background queue, picking a parser by
   bank and file type.
3. The import preview shows the parsed rows and any conflicts.
4. Resolve each conflict — skip it, import it anyway, or mark it as a duplicate.
5. Commit to write the transactions to the workspace.

## Validation and dedup

- A SHA-256 hash identifies a statement file that was already uploaded.
- Each transaction gets a fingerprint built from the account, date, amount, currency and direction;
  rows that match existing transactions are flagged as conflicts.
- Conflicts are resolved manually in the preview.

## Tips

- Use the same export date range for consistent results.
- Upload one account per file when possible.
- If a bank is unsupported, use a CSV/XLSX export or let the generic PDF parser try.

![Statements work queue with spend analytics and top categories](/img/screenshots/statements-top-categories.png)

Next: [Workspaces and RBAC](workspaces-and-rbac)
