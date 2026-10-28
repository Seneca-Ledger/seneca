import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * The bank's registered name in the footer and its website in the heading. A
 * payment to the bank in another bank's statement names it, not both.
 */
const BOS_FOOTER = /\bBank\s*of\s*Scotland\s*plc\b/i;
const BOS_WEBSITE = /\bbankofscotland\.co\.uk\b/i;

export function isBankOfScotlandStatement(text: string): boolean {
  return BOS_FOOTER.test(text) && BOS_WEBSITE.test(text);
}

/**
 * Bank of Scotland (UK) current account statement: sort code, account number
 * and IBAN in the heading, the period beside the account's name, and a
 * summary of "Balance on <date>", money in and money out. The generic reading
 * does all of it; this names the bank.
 */
export class BankOfScotlandParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.BANK_OF_SCOTLAND && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isBankOfScotlandStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }
}
