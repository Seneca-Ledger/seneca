import * as xlsx from 'xlsx';
import { APP_NAME } from '../../common/brand';
import { toCsv } from '../../common/utils/csv.util';
import type { TaxReturnSnapshotLine } from '../../entities/tax-return.entity';

/**
 * Rendering a return as a document.
 *
 * Buffers rather than temp files: an export is one request long, and a file on
 * disk would need a lifecycle and a cleanup path for no gain.
 */

export interface TaxReturnDocumentInput {
  jurisdictionName: string;
  taxName: string;
  periodStart: string;
  periodEnd: string;
  status: 'draft' | 'filed';
  filedAt: string | null;
  currency: string;
  outputTax: number;
  inputTax: number;
  netPayable: number;
  lines: TaxReturnSnapshotLine[];
}

interface PdfMakeLike {
  vfs: unknown;
  createPdf(definition: unknown): { getBuffer(callback: (buffer: Uint8Array) => void): void };
}

interface PdfFontsLike {
  pdfMake?: { vfs?: unknown };
  vfs?: unknown;
}

/**
 * pdfmake ships as CJS and ESM depending on the bundle, so the module may or
 * may not be wrapped in `default`. Same unwrapping as the reports module does;
 * duplicated rather than refactoring that file, which is unrelated to this.
 */
function unwrap<T>(module: unknown): T {
  const candidate =
    typeof module === 'object' && module !== null && 'default' in module
      ? (module as { default: unknown }).default
      : module;
  return candidate as T;
}

const DIRECTION_LABEL: Record<string, string> = {
  output: 'Output',
  input: 'Input',
  reverse_charge: 'Reverse charge',
};

function money(value: number, currency: string): string {
  return `${Number(value).toFixed(2)} ${currency}`;
}

export function buildFileName(input: TaxReturnDocumentInput, extension: string): string {
  return `tax-return-${input.periodStart}_${input.periodEnd}.${extension}`;
}

/**
 * The line rows, shared by both formats so the two documents cannot drift.
 * `taxAmount` stays in the transaction's own currency and the converted figure
 * sits beside it, because a reader checking a line against an invoice needs
 * the original number.
 */
function lineRows(input: TaxReturnDocumentInput): Array<Record<string, string | number>> {
  return input.lines.map(line => ({
    Date: line.date,
    Counterparty: line.counterparty,
    Kind: DIRECTION_LABEL[line.direction] ?? line.direction,
    Currency: line.currency,
    'Net amount': Number(line.netAmount),
    'Tax amount': Number(line.taxAmount),
    'Exchange rate': line.exchangeRate,
    [`Tax in ${input.currency}`]: Number(line.taxAmountConverted),
  }));
}

function summaryRows(input: TaxReturnDocumentInput): Array<[string, string]> {
  return [
    ['Jurisdiction', `${input.jurisdictionName} (${input.taxName})`],
    ['Period', `${input.periodStart} — ${input.periodEnd}`],
    ['Status', input.status === 'filed' ? `Filed ${input.filedAt ?? ''}`.trim() : 'Draft'],
    ['Output tax', money(input.outputTax, input.currency)],
    ['Input tax', money(input.inputTax, input.currency)],
    [
      input.netPayable < 0 ? 'Reclaimable' : 'Payable',
      money(Math.abs(input.netPayable), input.currency),
    ],
  ];
}

/**
 * A draft is a working figure, not a filing. Saying so on the document keeps a
 * printed draft from being mistaken for what was submitted.
 */
const DISCLAIMER =
  `Produced by ${APP_NAME} from your own data using rates we maintain. Not a substitute for advice ` +
  'from an accountant — check these figures before submitting anything.';

export function buildTaxReturnXlsx(input: TaxReturnDocumentInput): Buffer {
  const workbook = xlsx.utils.book_new();

  const summary = xlsx.utils.aoa_to_sheet([
    ['Tax return'],
    [],
    ...summaryRows(input),
    [],
    [DISCLAIMER],
  ]);
  xlsx.utils.book_append_sheet(workbook, summary, 'Summary');

  const rows = lineRows(input);
  // aoa_to_sheet for the empty case: json_to_sheet on [] produces a sheet with
  // no header row at all, which reads as a broken export rather than an empty
  // period.
  const lines =
    rows.length > 0
      ? xlsx.utils.json_to_sheet(rows)
      : xlsx.utils.aoa_to_sheet([['No taxed transactions in this period']]);
  xlsx.utils.book_append_sheet(workbook, lines, 'Lines');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** The lines as CSV, for a spreadsheet or an accountant's import: one row per line, the totals after. */
export function buildTaxReturnCsv(input: TaxReturnDocumentInput): Buffer {
  const rows = lineRows(input);
  const header = rows.length > 0 ? Object.keys(rows[0]) : [];
  return Buffer.from(
    toCsv([header, ...rows.map(row => header.map(key => row[key])), [], ...summaryRows(input)]),
    'utf8',
  );
}

export async function buildTaxReturnPdf(input: TaxReturnDocumentInput): Promise<Buffer> {
  const pdfMake = unwrap<PdfMakeLike>(await import('pdfmake/build/pdfmake'));
  const pdfFonts = unwrap<PdfFontsLike>(await import('pdfmake/build/vfs_fonts'));
  pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

  const rows = lineRows(input);
  const header = rows.length > 0 ? Object.keys(rows[0]) : [];

  const docDefinition = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [20, 24, 20, 32],
    content: [
      { text: 'Tax return', style: 'title' },
      input.status === 'draft'
        ? { text: 'DRAFT — not filed', style: 'draftMark', margin: [0, 0, 0, 8] }
        : { text: '' },
      {
        table: {
          widths: [120, '*'],
          body: summaryRows(input).map(([label, value]) => [
            { text: label, style: 'summaryLabel' },
            { text: value, style: 'summaryValue' },
          ]),
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 16],
      },
      rows.length > 0
        ? {
            table: {
              headerRows: 1,
              widths: [56, '*', 70, 44, 70, 70, 52, 78],
              body: [
                header.map(cell => ({ text: cell, style: 'tableHeader' })),
                ...rows.map(row =>
                  header.map(key => {
                    const value = row[key];
                    return typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
                  }),
                ),
              ],
            },
            layout: 'lightHorizontalLines',
          }
        : { text: 'No taxed transactions in this period.', style: 'empty' },
      { text: DISCLAIMER, style: 'disclaimer', margin: [0, 18, 0, 0] },
    ],
    styles: {
      title: { bold: true, fontSize: 16, margin: [0, 0, 0, 8] },
      draftMark: { bold: true, fontSize: 10, color: '#b45309' },
      summaryLabel: { fontSize: 9, color: '#6b7280' },
      summaryValue: { fontSize: 10, bold: true },
      tableHeader: { bold: true, fontSize: 8 },
      empty: { fontSize: 10, color: '#6b7280' },
      disclaimer: { fontSize: 7, color: '#6b7280' },
    },
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  };

  return new Promise<Buffer>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      resolve(Buffer.from(buffer));
    });
  });
}
