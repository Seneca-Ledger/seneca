import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * The bank's website in the footer of every page, and the statement date in
 * the heading. A transfer to the bank in another bank's statement names it
 * ("BOCHK"), not its website.
 */
const BOCHK_FOOTER = /\bwww\.bochk\.com\b/i;
const STATEMENT_DATE = /\bStatement Date\b/i;

export function isBankOfChinaStatement(text: string): boolean {
  return BOCHK_FOOTER.test(text) && STATEMENT_DATE.test(text);
}

/**
 * Bank of China (Hong Kong) consolidated statement: a portfolio and account
 * summary, then each account's transactions with dates year first
 * ("2020/09/30"), opened and closed by its brought and carried forward
 * balances. The account number is in the summary's column. The generic
 * layout reading reads all of it; this names the bank.
 */
export class BankOfChinaParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if (
      (bankName !== BankName.BANK_OF_CHINA && bankName !== BankName.OTHER) ||
      fileType !== FileType.PDF
    ) {
      return false;
    }
    try {
      return isBankOfChinaStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }
}
