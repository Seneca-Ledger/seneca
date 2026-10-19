/**
 * Synthetic fixture generators for parsing regression tests.
 *
 * Generates real CSV/XLSX files that are parsed end-to-end.
 * PDF parsing is tested via mocked pdfplumber data (see pdf-mock-data.ts).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

export interface ExpectedFixture {
  filePath: string;
  expectedTransactionCount: number;
  expectedDebitSum: number;
  expectedCreditSum: number;
  expectedCurrency: string;
}

// ── Generic CSV ──────────────────────────────────────────────────────────────

export function buildGenericCsv(outDir: string): ExpectedFixture {
  const filePath = path.join(outDir, 'generic-statement.csv');

  // Dates use day > 12 to prevent xlsx library from auto-converting
  // dd.mm.yyyy strings to Excel serial numbers (happens when day <= 12).
  const rows = [
    'Date,Document,Counterparty,Debit,Credit,Purpose',
    '15.03.2024,INV-100,Acme Corp,1200.50,,Office supplies KZT',
    '18.03.2024,INV-101,Global Trade,,5600.00,Consulting fee KZT',
    '22.03.2024,INV-102,Quick Logistics,800.00,,Delivery KZT',
    '25.03.2024,INV-103,Tech Solutions,,2400.75,Software license KZT',
  ];

  fs.writeFileSync(filePath, rows.join('\n'), 'utf-8');

  return {
    filePath,
    expectedTransactionCount: 4,
    expectedDebitSum: 2000.50,
    expectedCreditSum: 8000.75,
    expectedCurrency: 'KZT',
  };
}

// ── Cyrillic CSV (semicolon-separated, comma-decimal amounts) ────────────────

export function buildCyrillicCsv(outDir: string): ExpectedFixture {
  const filePath = path.join(outDir, 'cyrillic-statement.csv');

  const rows = [
    'Дата;Номер документа;Контрагент;Дебет;Кредит;Назначение',
    '15.03.2024;DOC-100;ТОО Ромашка;1500,00;;Оплата услуг',
    '18.03.2024;DOC-101;АО Береке;;2500,50;Возврат аванса',
  ];

  fs.writeFileSync(filePath, rows.join('\n'), 'utf-8');

  return {
    filePath,
    expectedTransactionCount: 2,
    expectedDebitSum: 1500,
    expectedCreditSum: 2500.5,
    expectedCurrency: 'KZT',
  };
}

// ── Single signed amount column (no separate Debit/Credit) ───────────────────

export function buildSignedAmountCsv(outDir: string): ExpectedFixture {
  const filePath = path.join(outDir, 'signed-amount-statement.csv');

  const rows = [
    'Date,Document,Counterparty,Amount,Purpose',
    '15.03.2024,INV-100,Acme Corp,-1200.50,Office supplies KZT',
    '18.03.2024,INV-101,Global Trade,5600.00,Consulting fee KZT',
    '22.03.2024,INV-102,Quick Logistics,-800.00,Delivery KZT',
  ];

  fs.writeFileSync(filePath, rows.join('\n'), 'utf-8');

  return {
    filePath,
    expectedTransactionCount: 3,
    expectedDebitSum: 2000.5,
    expectedCreditSum: 5600.0,
    expectedCurrency: 'KZT',
  };
}

// ── Generic XLSX ─────────────────────────────────────────────────────────────

export function buildGenericXlsx(outDir: string): ExpectedFixture {
  const filePath = path.join(outDir, 'generic-statement.xlsx');

  const header = ['Date', 'Document', 'Counterparty', 'Debit', 'Credit', 'Purpose'];
  const data = [
    header,
    ['01.04.2024', 'X-001', 'Vendor Alpha', 3500, '', 'Equipment purchase KZT'],
    ['05.04.2024', 'X-002', 'Service Beta', '', 7200, 'Monthly service KZT'],
    ['10.04.2024', 'X-003', 'Vendor Gamma', 1800, '', 'Consumables KZT'],
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');
  XLSX.writeFile(workbook, filePath);

  return {
    filePath,
    expectedTransactionCount: 3,
    expectedDebitSum: 5300,
    expectedCreditSum: 7200,
    expectedCurrency: 'KZT',
  };
}

// ── XLSX with a genuine Excel Date-typed date column ────────────────────────
// (regression: ExcelParser used to read date cells with `raw` sheet_to_json
// defaults, so a real Date cell — not a date-shaped string — came through as
// its raw day-count serial number, e.g. 45306, which normalizeDate parses as
// a "valid" but wildly wrong Date rather than failing.)

export function buildXlsxWithDateTypedCells(outDir: string): ExpectedFixture & { expectedDate: Date } {
  const filePath = path.join(outDir, 'date-typed-statement.xlsx');
  const expectedDate = new Date(2024, 3, 15); // 2024-04-15

  const header = ['Date', 'Document', 'Counterparty', 'Debit', 'Credit', 'Purpose'];
  const data = [
    header,
    [expectedDate, 'X-001', 'Vendor Alpha', 3500, '', 'Equipment purchase KZT'],
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data, { cellDates: true });
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');
  XLSX.writeFile(workbook, filePath, { cellDates: true });

  return {
    filePath,
    expectedTransactionCount: 1,
    expectedDebitSum: 3500,
    expectedCreditSum: 0,
    expectedCurrency: 'KZT',
    expectedDate,
  };
}
