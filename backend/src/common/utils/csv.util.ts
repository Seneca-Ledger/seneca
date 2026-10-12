import { neutralizeSpreadsheetFormulaCell } from './spreadsheet-formula.util';

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(value: CsvCell): string {
  // Cells come from bank descriptors and receipt OCR: a merchant name starting
  // with `=` must not become a live formula when the file is opened.
  const text = String(neutralizeSpreadsheetFormulaCell(value ?? ''));
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a UTF-8 BOM, so Excel opens accented and Cyrillic names correctly. */
export function toCsv(rows: CsvCell[][]): string {
  return `﻿${rows.map(row => row.map(escapeCell).join(',')).join('\r\n')}\r\n`;
}
