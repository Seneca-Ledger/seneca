import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's legal name in the letterhead, and the headings of its activity lists. */
const ASSOCIATED_NAME = /\bAssociated Bank,? N\.\s?A\./i;
const ASSOCIATED_ACTIVITY =
  /\b(?:Deposits and Other Additions|Withdrawals and Other Deductions)\b/i;

/**
 * What Associated prints around the payee: the kind of entry before it ("DDA
 * PUR" for a card purchase) and the trace number after it.
 */
const ENTRY_KIND = /^DDA\s+PUR\s+/i;
const TRACE_NUMBER = /\s+\d{9,}$/;

export function isAssociatedStatement(text: string): boolean {
  return ASSOCIATED_NAME.test(text) && ASSOCIATED_ACTIVITY.test(text);
}

export function associatedCounterparty(description: string): string {
  return description.replace(ENTRY_KIND, '').replace(TRACE_NUMBER, '').trim();
}

/**
 * Associated Bank (US) statement of accounts: deposits and withdrawals listed
 * under headings of their own, unsigned amounts in dollars, no running
 * balance, each list closed by a TOTAL line. The generic layout reading reads
 * the lists; this adds the bank and the payee without the entry kind and the
 * trace number.
 */
export class AssociatedParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.ASSOCIATED && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isAssociatedStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || associatedCounterparty(row.description),
    }));
  }
}
