import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { GenericPdfParser } from './generic-pdf.parser';

/** The footer of every page, and the row that opens each account's activity. */
const ALLY_FOOTER = /\bAlly Bank Member FDIC\b/;
const ALLY_ACTIVITY = /\bBeginning Balance\b/i;

/** Notes Ally adds to the payee: "PAYPAL TRANSFER~ Future Amount: 700 ~", "Tran: DDIR". */
const ALLY_NOTES = /~[^~]*~|\bTran:\s*\S+/g;

export function isAllyStatement(text: string): boolean {
  return ALLY_FOOTER.test(text) && ALLY_ACTIVITY.test(text);
}

/**
 * The dated row names the kind of transaction ("Check Card Purchase", "ATM
 * Withdrawal"); the lines under it name who it was with.
 */
export function allyCounterparty(row: LayoutTransaction): string {
  return row.description
    .slice(row.firstLine.length)
    .replace(ALLY_NOTES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ally Bank (US) customer statement: an activity table per account with
 * credits, debits ("-$503.00") and a running balance in dollars, between
 * "Beginning Balance" and "Ending Balance" rows. The generic layout reading
 * reads the table; this adds the bank and the payee under each row.
 */
export class AllyParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.ALLY && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isAllyStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super
      .readTransactions(rows)
      .map(row => ({ ...row, counterparty: row.counterparty || allyCounterparty(row) }));
  }
}
