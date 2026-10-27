import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name printed on its own line in the header, beside the holder's name. */
const ABSA_HEADER = /\bABSA\s*\n/i;
const ABSA_STATEMENT = /transaction history|statement for the period/i;

/**
 * The account number sits under the bank's name and above the account type
 * ("ABSA / 4048123456 / Savings account"), at the end of the lines it shares
 * with the holder's address.
 */
const ABSA_ACCOUNT =
  /\bABSA\s*\n[^\n]*?(\d{9,11})\s*\n[^\n]*\b(?:savings|cheque|current|transmission|credit card)\s+account\b/i;

export function isAbsaStatement(text: string): boolean {
  return ABSA_HEADER.test(text) && ABSA_STATEMENT.test(text);
}

export function findAbsaAccountNumber(text: string): string | null {
  return text.match(ABSA_ACCOUNT)?.[1] ?? null;
}

/**
 * Absa (South Africa) transaction history: one account, ISO dates, a signed
 * amount and a running balance in rand ("-R2 000.00", "R7 822.73"), rows
 * without ruling lines. The generic layout reading reads the table; this adds
 * what only Absa's header tells: the bank and the account number.
 */
export class AbsaParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.ABSA && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isAbsaStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await extractTextFromPdf(filePath));
    const parsed = await super.parse(filePath, text);
    return {
      ...parsed,
      metadata: {
        ...parsed.metadata,
        accountNumber: findAbsaAccountNumber(text) ?? parsed.metadata.accountNumber,
      },
    };
  }
}
