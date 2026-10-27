import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { GenericPdfParser } from './generic-pdf.parser';

/** The legal name in the footer, and the heading of the transactions table. */
const ANZ_FOOTER = /\bAustralia and New Zealand Banking Group\b/i;
const ANZ_TABLE = /\bTransaction Details\b/i;

/** The date ANZ notes when it differs from the posting date: "EFFECTIVE DATE 03 FEB 2023". */
const EFFECTIVE_DATE = /\bEFFECTIVE(?:\s+DATE)?\s+\d{1,2}\s+[A-Z]{3}\s+\d{4}\b/gi;

export function isAnzStatement(text: string): boolean {
  return ANZ_FOOTER.test(text) && ANZ_TABLE.test(text);
}

export function anzCounterparty(description: string): string {
  return description.replace(EFFECTIVE_DATE, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * ANZ (Australia) account statement: dates without a year under a year line,
 * withdrawals, deposits and a running balance in dollars, and rows whose text
 * wraps around the amounts printed at their middle. The generic layout
 * reading reads the table; this adds the bank and drops the effective-date
 * notes from the payee.
 */
export class AnzParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.ANZ && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isAnzStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    return super
      .readTransactions(rows)
      .map(row => ({ ...row, counterparty: row.counterparty || anzCounterparty(row.description) }));
  }
}
