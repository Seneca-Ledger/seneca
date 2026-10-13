import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';

export type ReportFileFormat = 'pdf' | 'excel' | 'csv';

export type ReportCell = string | number;

export interface ReportSection {
  /** Heading rendered as a band row above the table. Omit for a single-table report. */
  title?: string;
  columns: string[];
  rows: ReportCell[][];
  /** Emphasised closing row (e.g. TOTAL), same width as `columns`. */
  total?: ReportCell[];
}

/**
 * Format-agnostic description of a report. Every template builds one of these;
 * `writeReportFile` is the single place that knows about xlsx/csv/pdf.
 */
export interface ReportDocument {
  title: string;
  /** e.g. "2024-01-01 — 2024-12-31 · EUR" */
  subtitle: string;
  sections: ReportSection[];
  /**
   * Caveats printed under the subtitle, before any table — e.g. amounts left
   * out because their currency had no rate. A reader must meet these before
   * the figures, not after them.
   */
  notes?: string[];
  /** PDF page orientation; by default landscape when a table is too wide for portrait. */
  orientation?: 'portrait' | 'landscape';
  /** Emphasised lines below all sections (e.g. NET INCOME). */
  footer?: ReportCell[][];
}

export interface ReportFile {
  filePath: string;
  fileName: string;
  contentType: string;
}

const CONTENT_TYPES: Record<ReportFileFormat, string> = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  pdf: 'application/pdf',
};

const EXTENSIONS: Record<ReportFileFormat, string> = { excel: 'xlsx', csv: 'csv', pdf: 'pdf' };

interface PdfMakeLike {
  vfs?: unknown;
  createPdf(docDefinition: unknown): { getBuffer(callback: (buffer: Uint8Array) => void): void };
}

interface PdfFontsLike {
  pdfMake?: { vfs?: unknown };
  vfs?: unknown;
}

function unwrapDefault<T>(module: unknown): T {
  const candidate =
    typeof module === 'object' && module !== null && 'default' in module
      ? (module as { default: unknown }).default
      : module;
  return candidate as T;
}

/** Loads pdfmake with its bundled Roboto vfs (which covers Cyrillic). */
export async function loadPdfMake(): Promise<PdfMakeLike> {
  const pdfMake = unwrapDefault<PdfMakeLike>(await import('pdfmake/build/pdfmake'));
  const pdfFonts = unwrapDefault<PdfFontsLike>(await import('pdfmake/build/vfs_fonts'));
  pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;
  return pdfMake;
}

function escapeCsvValue(value: ReportCell): string {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Flattens the document into the sheet/CSV row model: header, blank, sections,
 * footer.
 *
 * Every cell goes through the formula neutralizer on the way out. Report
 * content comes from parsed statements, receipt OCR and Gmail ingestion, so a
 * merchant name beginning with `=` would otherwise be a live formula the
 * moment the export is opened in Excel or Sheets. Quoting alone does not help:
 * spreadsheet apps evaluate the unquoted value.
 */
function toGridRows(doc: ReportDocument): ReportCell[][] {
  const rows: ReportCell[][] = [[doc.title], [doc.subtitle]];
  for (const note of doc.notes ?? []) {
    rows.push([note]);
  }
  rows.push([]);

  for (const section of doc.sections) {
    if (section.title) {
      rows.push([section.title]);
    }
    rows.push(section.columns);
    rows.push(...section.rows);
    if (section.total) {
      rows.push(section.total);
    }
    rows.push([]);
  }

  for (const line of doc.footer ?? []) {
    rows.push(line);
  }

  return rows.map(row => row.map(neutralizeSpreadsheetFormulaCell) as ReportCell[]);
}

/** Widest cell of each column, in characters, so a sheet opens readable. */
function columnWidths(rows: ReportCell[][]): Array<{ wch: number }> {
  const widths: number[] = [];
  // The title, subtitle and notes are single long cells that spill over
  // neighbours anyway; sizing column A by them would make it absurdly wide.
  const tableRows = rows.filter(row => row.length > 1);
  for (const row of tableRows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 8, Math.min(String(cell).length + 2, 50));
    });
  }
  return widths.map(wch => ({ wch }));
}

/**
 * Two decimals for every number in a column that holds money, i.e. any
 * fractional value; a column of counts keeps plain integers.
 */
function formatMoneyColumns(sheet: xlsx.WorkSheet, rows: ReportCell[][]): void {
  const moneyColumns = new Set<number>();
  for (const row of rows) {
    row.forEach((cell, index) => {
      if (typeof cell === 'number' && !Number.isInteger(cell)) {
        moneyColumns.add(index);
      }
    });
  }
  rows.forEach((row, rowIndex) => {
    for (const columnIndex of moneyColumns) {
      const cell = sheet[xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (cell && typeof row[columnIndex] === 'number') {
        cell.z = '#,##0.00';
      }
    }
  });
}

function writeExcel(doc: ReportDocument, filePath: string): void {
  const workbook = xlsx.utils.book_new();
  const rows = toGridRows(doc);
  const sheet = xlsx.utils.aoa_to_sheet(rows);
  sheet['!cols'] = columnWidths(rows);
  formatMoneyColumns(sheet, rows);
  // Sheet names are capped at 31 chars by the format and reject []:*?/\
  const sheetName = doc.title.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || 'Report';
  xlsx.utils.book_append_sheet(workbook, sheet, sheetName);
  xlsx.writeFile(workbook, filePath);
}

function writeCsv(doc: ReportDocument, filePath: string): void {
  const content = toGridRows(doc)
    .map(row => row.map(escapeCsvValue).join(','))
    .join('\n');
  // BOM so Excel opens UTF-8 correctly, matching the workspace export.
  fs.writeFileSync(filePath, `\uFEFF${content}`, 'utf-8');
}

/** A table wider than this prints smaller so its columns fit the page. */
const WIDE_TABLE_COLUMNS = 8;

function toPdfSection(section: ReportSection): unknown[] {
  // Numbers line up on the right, words on the left; a header follows its
  // column, judged by the first row.
  const numericColumn = section.columns.map(
    (_column, index) => typeof (section.rows[0] ?? section.total ?? [])[index] === 'number',
  );
  const alignment = (cell: ReportCell, index: number) =>
    typeof cell === 'number' ? 'right' : index === 0 || !numericColumn[index] ? 'left' : 'right';

  const body = [
    section.columns.map((text, index) => ({
      text,
      style: 'th',
      alignment: numericColumn[index] ? 'right' : 'left',
    })),
    ...section.rows.map(row =>
      row.map((cell, index) => ({ text: String(cell), alignment: alignment(cell, index) })),
    ),
  ];

  if (section.total) {
    body.push(
      section.total.map((cell, index) => ({
        text: String(cell),
        bold: true,
        alignment: alignment(cell, index),
      })),
    );
  }

  // The longest text column takes the spare width and wraps; the rest fit
  // their content. A fixed first column would hand the room to an empty one.
  const textLength = (index: number): number =>
    numericColumn[index]
      ? -1
      : Math.max(...section.rows.map(row => String(row[index] ?? '').length), 0);
  const flexible = section.columns.reduce(
    (best, _column, index) => (textLength(index) > textLength(best) ? index : best),
    0,
  );
  const widths = section.columns.map((_column, index) => (index === flexible ? '*' : 'auto'));
  const wide = section.columns.length > WIDE_TABLE_COLUMNS;

  return [
    ...(section.title ? [{ text: section.title, style: 'sectionTitle' }] : []),
    {
      table: { headerRows: 1, widths, body },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 14],
      ...(wide ? { fontSize: 7 } : {}),
    },
  ];
}

async function writePdf(doc: ReportDocument, filePath: string): Promise<void> {
  const pdfMake = await loadPdfMake();

  const docDefinition = {
    pageSize: 'A4',
    // A table too wide for a portrait page turns the page rather than cut columns off.
    pageOrientation:
      doc.orientation ??
      (doc.sections.some(section => section.columns.length > WIDE_TABLE_COLUMNS)
        ? 'landscape'
        : 'portrait'),
    pageMargins: [24, 28, 24, 28],
    content: [
      { text: doc.title, style: 'title' },
      { text: doc.subtitle, style: 'subtitle' },
      ...(doc.notes ?? []).map(note => ({ text: note, style: 'note' })),
      ...doc.sections.flatMap(toPdfSection),
      ...(doc.footer ?? []).map(line => ({ text: line.join('   '), style: 'footerLine' })),
    ],
    styles: {
      title: { bold: true, fontSize: 16 },
      subtitle: { fontSize: 9, color: '#6b7280', margin: [0, 2, 0, 16] },
      note: { fontSize: 9, color: '#b45309', margin: [0, 0, 0, 10] },
      sectionTitle: { bold: true, fontSize: 11, margin: [0, 6, 0, 6] },
      th: { bold: true, color: '#374151' },
      footerLine: { bold: true, fontSize: 11, margin: [0, 4, 0, 0] },
    },
    defaultStyle: { font: 'Roboto', fontSize: 9 },
  };

  await new Promise<void>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      fs.writeFileSync(filePath, Buffer.from(buffer));
      resolve();
    });
  });
}

/**
 * Renders `doc` into `targetDir` in the requested format.
 * `baseName` must already be filesystem-safe (it is built from a template id and ISO dates).
 */
export async function writeReportFile(
  doc: ReportDocument,
  format: ReportFileFormat,
  baseName: string,
  targetDir: string,
): Promise<ReportFile> {
  const fileName = `${baseName}.${EXTENSIONS[format]}`;
  const filePath = path.join(targetDir, fileName);

  if (format === 'excel') {
    writeExcel(doc, filePath);
  } else if (format === 'csv') {
    writeCsv(doc, filePath);
  } else {
    await writePdf(doc, filePath);
  }

  return { filePath, fileName, contentType: CONTENT_TYPES[format] };
}
