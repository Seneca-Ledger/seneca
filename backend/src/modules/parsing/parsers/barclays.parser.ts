import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { isPageFooterLine } from '../helpers/pdf-layout-page-footer.helper';
import type { LayoutReading, LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { findDayRangePeriod } from '../helpers/statement-header-period.helper';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * The registered name, and the bank's own code: the BIC or an IBAN with its
 * bank code. Another bank's statement names Barclays in a payee line, but
 * prints neither.
 */
const BARCLAYS_NAME = /\bBarclays\s+Bank\s+(?:UK\s+)?PLC\b/i;
const BARCLAYS_CODE = /\bBUKBGB22\b|\bGB\d{2}\s?BUKB\s?\d{4}/;

export function isBarclaysStatement(text: string): boolean {
  return BARCLAYS_NAME.test(text) && BARCLAYS_CODE.test(text);
}

/** What the card payment line prints before the payee. */
const PAYEE_PREFIXES = [
  'Card Payment to ',
  'Sent to ',
  'Bill Payment to ',
  'Direct Debit to ',
  'Standing Order to ',
];
const RECEIVED_PREFIX = 'Received from ';

/** The date of use the reader left dangling after "On" on a wrapped line. */
const DANGLING_ON = /\s+On(?:\s+\d{1,2}\s+[A-Za-z]{3})?$/;

function startsWith(text: string, prefix: string): boolean {
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

export function barclaysPayee(description: string): { counterparty: string; description: string } {
  const clean = description.replace(/\s+/g, ' ').trim();
  const text = clean.replace(DANGLING_ON, '');
  const prefix = PAYEE_PREFIXES.find(p => startsWith(text, p));
  if (prefix) {
    return { counterparty: text.slice(prefix.length).trim(), description: text };
  }
  if (startsWith(clean, RECEIVED_PREFIX)) {
    const payee = clean.slice(RECEIVED_PREFIX.length).replace(/\s+Ref:.*$/i, '');
    return { counterparty: payee.trim(), description: clean };
  }
  return { counterparty: '', description: text };
}

/**
 * Barclays (UK) current account statement. The generic reading does the
 * table; this names the bank, drops the "Continued" page break, reads the
 * period printed as a day range, and strips the payment words from the payee.
 */
export class BarclaysParser extends GenericPdfParser {
  protected reading: LayoutReading = { skip: isPageFooterLine };

  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.BARCLAYS && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isBarclaysStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  protected readTransactions(
    rows: PdfTextRow[],
    reading: LayoutReading = this.reading,
  ): LayoutTransaction[] {
    return super.readTransactions(rows, { ...reading, skip: isPageFooterLine }).map(row => {
      const payee = barclaysPayee(row.description);
      return { ...row, ...payee, counterparty: row.counterparty || payee.counterparty };
    });
  }

  protected extractDateRange(text: string): { from: Date | null; to: Date | null } {
    return findDayRangePeriod(text) ?? super.extractDateRange(text);
  }
}
