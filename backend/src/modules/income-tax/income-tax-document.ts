import * as xlsx from 'xlsx';
import { APP_NAME } from '../../common/brand';
import { toCsv } from '../../common/utils/csv.util';
import { neutralizeSpreadsheetFormulaCell } from '../../common/utils/spreadsheet-formula.util';
import type { IncomeTaxDraft } from './income-tax.types';

/**
 * Rendering an income-tax draft as a document.
 *
 * English, like the VAT return document, with the official form terms kept in
 * the line labels. The disclaimer opens the document and repeats on every PDF
 * page: a printed page travels without the rest of the file.
 */

export const INCOME_TAX_DOCUMENT_DISCLAIMER =
  `DRAFT — NOT TAX ADVICE, NOT FILED. Prepared by ${APP_NAME} from the data you entered. ` +
  'These figures can only be relied on if the app was used every day and every income ' +
  'and expense was tracked consistently; missing statements, receipts or uncategorised ' +
  'transactions make them wrong. Check them against the pre-filled return of your tax ' +
  'authority and consult a tax adviser if in doubt.';

const WARNING_TEXT: Record<string, string> = {
  form_edition_older:
    'Line numbers are from an earlier edition of the form; check them against the current one.',
  de_entertainment_records:
    'Business entertainment needs place, date, participants and occasion on record.',
  de_gift_limit_exceeded:
    'Gifts to one recipient exceeded 50 EUR in the year, so none of them are deductible.',
  de_home_office_exclusive:
    'The daily home-office allowance cannot be combined with the home-study flat rate; only the flat rate was used.',
  de_small_business_with_vat_revenue:
    'Marked as a small business (Kleinunternehmer) but revenue is booked as subject to VAT.',
  es_activity_key_missing: 'No activity key (A01–A05, B01–B06) is set for the activity.',
  es_simplified_regime_unavailable:
    'Previous-year turnover above 600,000 EUR: the simplified regime is not available.',
  es_single_client_excludes_allowance:
    'The single-client reduction excludes the 5% hard-to-justify allowance.',
  pl_health_cap_applied:
    'Health contributions exceed the annual cap for the year; only the capped amount is counted.',
  pl_deductions_exceed_income:
    'Deductions exceed income; the remaining base is shown as 0. Check the figures.',
  pl_ryczalt_limit_exceeded:
    'Previous-year revenue above 8,569,200 PLN: ryczałt is not available in 2025.',
  pl_ryczalt_multiple_rates:
    'Revenue at several rates: check the PIT-28 instructions for splitting the health contribution reduction.',
};

const FX_RULE_TEXT: Record<string, string> = {
  transaction_date:
    'Rate for the transaction date (the official rule for this country is not verified)',
  nbp_previous_business_day:
    'NBP average rate of the last business day before the transaction (art. 11a PIT Act)',
  bdi_reference_rate:
    "Banca d'Italia reference rate of the transaction day or the nearest earlier day, else the monthly average (Redditi PF instructions)",
};

const RETENTION_TEXT: Record<string, string> = {
  booking_documents: 'booking documents (invoices, receipts)',
  books_and_records: 'books, records and annual accounts',
  other_business_documents: 'other documents, including business letters',
  tax_records: 'tax records (income, expenses, deductions)',
  commercial_books: 'accounting books and supporting documents (traders)',
  accounting_records: 'accounting records',
};

const DEADLINE_TEXT: Record<string, string> = {
  standard: 'filing deadline',
  paper: 'on paper',
  online: 'online',
  adviser: 'via a tax adviser',
  online_pay_and_file: 'filing and paying online',
  no_assessment_received: 'if no assessment was received',
  direct_debit: 'if paying by direct debit',
  online_zone_1: 'online, départements 01–19 and non-residents',
  online_zone_2: 'online, départements 20–54',
  online_zone_3: 'online, départements 55–976',
  higher_rate_income: 'if income taxed at the higher rate exceeds EUR 105,300',
  with_extension: 'with an extension',
  correction: 'deadline to correct the pre-filled return',
};

const ISSUE_TEXT: Record<string, string> = {
  no_transactions: 'No transactions recorded for the year',
  uncategorized_transactions: 'Uncategorised transactions (left out of the figures)',
  unmapped_categories: 'Transactions in categories not assigned to a line (left out)',
  missing_exchange_rates: 'Transactions without an exchange rate (left out)',
  statement_coverage_gaps: 'Months without a bank statement',
  statements_with_errors: 'Statements that failed to import',
  statements_pending_review: 'Statements not yet reviewed',
  receipts_pending_review: 'Receipts not yet reviewed',
  stale_upload: 'Days since the last statement upload',
  irregular_tracking: 'Share of days with any activity recorded (%)',
};

interface PdfMakeLike {
  vfs: unknown;
  createPdf(definition: unknown): { getBuffer(callback: (buffer: Uint8Array) => void): void };
}

interface PdfFontsLike {
  pdfMake?: { vfs?: unknown };
  vfs?: unknown;
}

/** Same unwrapping as the reports and VAT documents: pdfmake may or may not sit under `default`. */
function unwrap<T>(module: unknown): T {
  const candidate =
    typeof module === 'object' && module !== null && 'default' in module
      ? (module as { default: unknown }).default
      : module;
  return candidate as T;
}

function money(value: number, currency: string): string {
  return `${Number(value).toFixed(2)} ${currency}`;
}

export function buildIncomeTaxFileName(draft: IncomeTaxDraft, extension: string): string {
  return `income-tax-${draft.country.code.toLowerCase()}-${draft.taxYear}-${draft.pack.formKey}.${extension}`;
}

function warningText(code: string): string {
  return WARNING_TEXT[code] ?? code;
}

function summaryRows(draft: IncomeTaxDraft): Array<[string, string]> {
  const edition =
    draft.pack.formEditionYear !== null && draft.pack.formEditionYear < draft.taxYear
      ? ` (line numbers from the ${draft.pack.formEditionYear} edition)`
      : '';
  return [
    ['Country', `${draft.country.name} (${draft.country.code})`],
    ['Tax year', String(draft.taxYear)],
    ['Form', `${draft.pack.name}${edition}`],
    ['Taxpayer', draft.taxpayerType.replace('_', '-')],
    [
      'Status',
      draft.status === 'finalized' ? `Finalized ${draft.finalizedAt?.slice(0, 10) ?? ''}` : 'Draft',
    ],
    ['Currency', draft.currency],
    // Drafts finalized before the rule was recorded converted at the transaction date.
    ['Exchange rates', FX_RULE_TEXT[draft.fxRule ?? 'transaction_date']],
    ['Data completeness', `${draft.completeness.score} / 100`],
    ['Where to file', draft.pack.filingChannel ?? draft.filingInfo?.portal ?? 'Your tax authority'],
    ...(draft.filingInfo
      ? ([
          ['Return form', draft.filingInfo.formName],
          [
            'Deadline',
            draft.filingInfo.deadlines
              .map(
                deadline => `${deadline.date} (${DEADLINE_TEXT[deadline.kind] ?? deadline.kind})`,
              )
              .join('; '),
          ],
        ] as Array<[string, string]>)
      : []),
    ...(draft.filingInfo?.retention
      ? ([
          [
            'Keep records until',
            draft.filingInfo.retention.periods
              .map(period => `${period.until} (${RETENTION_TEXT[period.kind] ?? period.kind})`)
              .join('; '),
          ],
        ] as Array<[string, string]>)
      : []),
  ];
}

function figureRows(draft: IncomeTaxDraft): string[][] {
  return draft.figures.map(figure => [
    figure.lineNo ?? '—',
    figure.fieldNo ?? '—',
    figure.label,
    money(figure.amount, draft.currency),
    money(figure.deductible, draft.currency),
    String(figure.transactionCount),
  ]);
}

function issueRows(draft: IncomeTaxDraft): string[][] {
  return draft.completeness.issues.map(issue => [
    issue.severity,
    ISSUE_TEXT[issue.code] ?? issue.code,
    String(issue.count),
  ]);
}

const FIGURE_HEADER = ['Line', 'Field', 'Description', 'Booked', 'Deductible', 'Transactions'];

export function buildIncomeTaxXlsx(draft: IncomeTaxDraft): Buffer {
  const workbook = xlsx.utils.book_new();

  const summary = xlsx.utils.aoa_to_sheet([
    ['Income tax declaration draft'],
    [INCOME_TAX_DOCUMENT_DISCLAIMER],
    [],
    ...summaryRows(draft),
    [],
    FIGURE_HEADER,
    ...figureRows(draft),
    [],
    ...(draft.taxEstimate
      ? [
          ['Estimated income tax', money(draft.taxEstimate.amount, draft.currency)],
          ['Basis', draft.taxEstimate.basis],
          ['Not included', draft.taxEstimate.excludes.join('; ')],
          [],
        ]
      : []),
    ['Warnings'],
    ...(draft.warnings.length > 0 ? draft.warnings.map(w => [warningText(w.code)]) : [['None']]),
    [],
    ['Data completeness issues'],
    ...(issueRows(draft).length > 0 ? issueRows(draft) : [['None']]),
  ]);
  xlsx.utils.book_append_sheet(workbook, summary, 'Draft');

  const contributionRows = Object.entries(draft.contributions).flatMap(([lineKey, rows]) =>
    rows.map(row => ({
      Line: lineKey,
      Date: row.date,
      // Bank and user text: a leading = + - @ must not become a formula once edited.
      Counterparty: neutralizeSpreadsheetFormulaCell(row.counterparty),
      Category: neutralizeSpreadsheetFormulaCell(row.categoryName ?? ''),
      Currency: row.currency,
      Amount: row.amount,
      'Exchange rate': row.exchangeRate,
      [`Amount in ${draft.currency}`]: row.amountConverted,
    })),
  );
  const transactions =
    contributionRows.length > 0
      ? xlsx.utils.json_to_sheet(contributionRows)
      : xlsx.utils.aoa_to_sheet([['No transactions contributed to this draft']]);
  xlsx.utils.book_append_sheet(workbook, transactions, 'Transactions');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/**
 * The draft as CSV: figures first, then every transaction behind them, with
 * plain numbers so a spreadsheet or an accountant's software can add them up.
 */
export function buildIncomeTaxCsv(draft: IncomeTaxDraft): Buffer {
  return Buffer.from(
    toCsv([
      ['Income tax declaration draft'],
      [INCOME_TAX_DOCUMENT_DISCLAIMER],
      [],
      ...summaryRows(draft),
      [],
      FIGURE_HEADER,
      ...draft.figures.map(figure => [
        figure.lineNo ?? '',
        figure.fieldNo ?? '',
        figure.label,
        figure.amount,
        figure.deductible,
        figure.transactionCount,
      ]),
      [],
      [
        'Line',
        'Date',
        'Counterparty',
        'Category',
        'Currency',
        'Amount',
        'Exchange rate',
        `Amount in ${draft.currency}`,
      ],
      ...Object.entries(draft.contributions).flatMap(([lineKey, rows]) =>
        rows.map(row => [
          lineKey,
          row.date,
          row.counterparty,
          row.categoryName ?? '',
          row.currency,
          row.amount,
          row.exchangeRate,
          row.amountConverted,
        ]),
      ),
    ]),
    'utf8',
  );
}

export async function buildIncomeTaxPdf(draft: IncomeTaxDraft): Promise<Buffer> {
  const pdfMake = unwrap<PdfMakeLike>(await import('pdfmake/build/pdfmake'));
  const pdfFonts = unwrap<PdfFontsLike>(await import('pdfmake/build/vfs_fonts'));
  pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs;

  const cell = (text: string, style?: string) => ({ text, style });

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [28, 28, 28, 56],
    footer: (currentPage: number, pageCount: number) => ({
      margin: [28, 8, 28, 0],
      stack: [
        { text: INCOME_TAX_DOCUMENT_DISCLAIMER, style: 'footer' },
        { text: `${currentPage} / ${pageCount}`, style: 'footer', alignment: 'right' },
      ],
    }),
    content: [
      { text: 'Income tax declaration draft', style: 'title' },
      { text: INCOME_TAX_DOCUMENT_DISCLAIMER, style: 'disclaimer', margin: [0, 0, 0, 12] },
      {
        table: {
          widths: [110, '*'],
          body: summaryRows(draft).map(([label, value]) => [
            cell(label, 'summaryLabel'),
            cell(value, 'summaryValue'),
          ]),
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          headerRows: 1,
          widths: [34, 34, '*', 70, 70, 40],
          body: [FIGURE_HEADER.map(text => cell(text, 'tableHeader')), ...figureRows(draft)],
        },
        layout: 'lightHorizontalLines',
      },
      draft.taxEstimate
        ? {
            margin: [0, 14, 0, 0],
            stack: [
              {
                text: `Estimated income tax: ${money(draft.taxEstimate.amount, draft.currency)}`,
                style: 'section',
              },
              { text: draft.taxEstimate.basis, style: 'muted' },
              { text: `Not included: ${draft.taxEstimate.excludes.join('; ')}`, style: 'muted' },
            ],
          }
        : { text: '' },
      { text: 'Warnings', style: 'section', margin: [0, 14, 0, 4] },
      draft.warnings.length > 0
        ? { ul: draft.warnings.map(w => warningText(w.code)) }
        : { text: 'None', style: 'muted' },
      { text: 'Data completeness issues', style: 'section', margin: [0, 14, 0, 4] },
      draft.completeness.issues.length > 0
        ? {
            table: {
              widths: [60, '*', 50],
              body: issueRows(draft),
            },
            layout: 'lightHorizontalLines',
          }
        : { text: 'None', style: 'muted' },
    ],
    styles: {
      title: { bold: true, fontSize: 16, margin: [0, 0, 0, 6] },
      disclaimer: { fontSize: 9, bold: true, color: '#b45309' },
      summaryLabel: { fontSize: 9, color: '#6b7280' },
      summaryValue: { fontSize: 10, bold: true },
      tableHeader: { bold: true, fontSize: 8 },
      section: { bold: true, fontSize: 11 },
      muted: { fontSize: 8, color: '#6b7280' },
      footer: { fontSize: 6, color: '#6b7280' },
    },
    defaultStyle: { font: 'Roboto', fontSize: 8 },
  };

  return new Promise<Buffer>(resolve => {
    pdfMake.createPdf(docDefinition).getBuffer((buffer: Uint8Array) => {
      resolve(Buffer.from(buffer));
    });
  });
}
