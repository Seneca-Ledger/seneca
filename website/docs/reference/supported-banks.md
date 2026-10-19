---
title: Supported Banks
description: Statement format support matrix
---

Seneca includes bank-specific parsers plus generic fallbacks. The app shows the same list on the **Supported
banks** page (`/supported-banks`).

## Native PDF support

- Kaspi Bank (Kazakhstan)
- Bereke Bank, old and new PDF layouts (Kazakhstan)
- Bank Hapoalim / Isracard (Israel, Hebrew)

## Generic support

- CSV exports (delimiter detection)
- XLSX / XLS exports
- DOCX tables
- Images and scanned documents through OCR
- Any other PDF through the generic table parser, which reads transaction tables from the PDF text layer

## Adding a new bank

See [Adding a Bank Parser](../contributing/adding-a-bank-parser) for the recommended workflow.

If you have sample statements, open a GitHub issue with anonymized files to help maintainers add support.
