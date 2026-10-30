import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { GenericPdfParser } from './generic-pdf.parser';

/** The heading over the transactions: "Statement of Axis Account No :… for the period". */
const AXIS_STATEMENT = /\bStatement of Axis Account No\b/i;

/** Payment rails whose narration names the other side after a reference number. */
const NAMED_RAIL = /^(?:UPI|NEFT|IMPS)\//i;
/** A reference: a run of letters and digits with at least six digits in it. */
const REFERENCE = /^(?=(?:\D*\d){6})[A-Z0-9]{8,}$/i;

export function isAxisStatement(text: string): boolean {
  return AXIS_STATEMENT.test(text);
}

/**
 * The other side of a UPI, NEFT or IMPS payment: the part after the reference
 * ("UPI/P2A/360872435577/MAMTA KUM/Paytm Pay/Payment" → "MAMTA KUM",
 * "NEFT/N3512…/DELHIVERY LIMITED/HDFC BANK/…" → "DELHIVERY LIMITED"). Anything
 * else keeps its description.
 */
export function axisCounterparty(description: string): string {
  if (!NAMED_RAIL.test(description)) {
    return description;
  }
  const parts = description.split('/').map(part => part.trim());
  const reference = parts.findIndex(part => REFERENCE.test(part));
  const name = reference === -1 ? undefined : parts[reference + 1];
  return name && !/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(name) ? name : description;
}

/**
 * Axis Bank (India) account statement: debit, credit and balance in rupees
 * without a currency mark, each row's narration starting on the line above
 * its date, and the branch code in a column of its own. The generic layout
 * reading reads the table; this adds the bank and the payee from the
 * narration.
 */
export class AxisParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.AXIS && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isAxisStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super.readTransactions(rows).map(row => ({
      ...row,
      counterparty: row.counterparty || axisCounterparty(row.description),
    }));
  }
}
