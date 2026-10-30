import { resolveFileType } from '../../../common/utils/file-validator.util';
import { ocrPdfLayout } from '../../../common/utils/pdf-ocr.util';
import {
  extractTextAndLayoutFromPdf,
  extractTextLayerFromPdf,
  type PdfTextRow,
} from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { DocumentClassifierService } from '../services/document-classifier.service';
import type { ParserFactoryService } from '../services/parser-factory.service';
import { readLayoutTransactions } from './pdf-layout-table.helper';
import { findStatementAmounts } from './statement-amount.helper';
import { parseDateParts } from './statement-date.helper';

/** Formats that only ever carry a bank's transactions. */
const STATEMENT_FORMATS = new Set(['csv', 'xlsx', 'ofx', 'qif', 'camt', 'mt940']);

/**
 * Dated rows with money under a table header. Statements print dozens; a
 * receipt or an invoice prints none, its lines do not start with a date.
 */
const MIN_STATEMENT_ROWS = 3;

/**
 * Whether a file dropped into the scan is a bank statement, to be parsed for
 * all its transactions, rather than a receipt or an invoice booked as one
 * expense. A PDF is a statement when a bank's own parser claims it (unless it
 * reads as a receipt or an invoice, as a payment receipt naming the bank
 * does), or when its table holds dated rows, or, under headings no reader
 * knows, lines that start with a date and carry money: a statement whose
 * layout the parser cannot read yet, which the user may then teach it. The document classifier alone
 * is not enough: it takes an e-invoice with "balance" in it for a statement.
 * A PDF without a text layer is a scan: only its first page is read (OCR
 * takes seconds a page, and the upload waits), and the classifier decides.
 * Images stay receipts.
 */
export async function isBankStatementScan(
  file: { path: string; mimetype: string; originalname?: string | null },
  parserFactory: ParserFactoryService,
): Promise<boolean> {
  const format = resolveFileType(file);
  if (STATEMENT_FORMATS.has(format)) {
    return true;
  }
  if (format !== 'pdf') {
    return false;
  }

  const text = await extractTextLayerFromPdf(file.path).catch(() => '');
  if (!text.trim()) {
    const firstPage = await ocrPdfLayout(file.path, 1).catch(() => ({ text: '' }));
    const { documentType } = new DocumentClassifierService().classify(firstPage.text, {
      fileNameHint: file.originalname ?? undefined,
    });
    return documentType === 'bank_statement';
  }

  const { bankName } = await parserFactory.detectBankAndFormat(file.path, FileType.PDF, text);
  if (bankName !== BankName.OTHER) {
    const { documentType } = new DocumentClassifierService().classify(text, {
      fileNameHint: file.originalname ?? undefined,
    });
    return documentType !== 'receipt' && documentType !== 'invoice';
  }

  const { rows } = await extractTextAndLayoutFromPdf(file.path).catch(() => ({ rows: [] }));
  return (
    readLayoutTransactions(rows).length >= MIN_STATEMENT_ROWS ||
    datedMoneyLines(rows) >= MIN_STATEMENT_ROWS
  );
}

/** Lines whose first word is a date and that carry an amount besides it, whatever the headings. */
export function datedMoneyLines(rows: PdfTextRow[]): number {
  return rows.filter(row => {
    const [first, ...rest] = [...row.items].sort((a, b) => a.x - b.x);
    const dated = first && (parseDateParts(first.text, 'dmy') ?? parseDateParts(first.text, 'mdy'));
    return Boolean(dated) && findStatementAmounts(rest.map(item => item.text).join(' ')).length > 0;
  }).length;
}
