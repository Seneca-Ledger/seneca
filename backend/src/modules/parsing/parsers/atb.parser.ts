import { extractTextFromPdf, type PdfTextRow } from '../../../common/utils/pdf-parser.util';
import { BankName, FileType } from '../../../entities/statement.entity';
import type { LayoutTransaction } from '../helpers/pdf-layout-table.helper';
import { GenericPdfParser } from './generic-pdf.parser';

/** The bank's name in the letterhead, and the heading over each account's part. */
const ATB_NAME = /\bATB\s+Financial\b/i;
const ATB_ACCOUNT_SUMMARY = /\bA summary of (Deposit|Loan) Account\b/i;

/** "POS Purchase MCDONALD'S": the kind of entry, then the merchant when ATB names one. */
const POS_PURCHASE = /^POS Purchase\s+/i;

export function isAtbStatement(text: string): boolean {
  return ATB_NAME.test(text) && ATB_ACCOUNT_SUMMARY.test(text);
}

export function atbCounterparty(description: string): string {
  return description.replace(POS_PURCHASE, '').trim();
}

const rowText = (row: PdfTextRow) => row.items.map(item => item.text).join(' ');

interface AtbAccountPart {
  kind: 'deposit' | 'loan';
  name: string;
  number: string;
  rows: PdfTextRow[];
}

/**
 * The statement's parts, one per account, each opening with "A summary of
 * Deposit Account", the account's name and its number. The front page lists
 * every account by name with its number ("Springboard Savings Account" /
 * "#00123456702"), which is preferred: the number under a part's heading can
 * repeat another account's.
 */
function splitAccountParts(rows: PdfTextRow[]): AtbAccountPart[] {
  const ordered = [...rows].sort((a, b) => a.page - b.page || a.y - b.y);
  const parts: AtbAccountPart[] = [];
  for (const [index, row] of ordered.entries()) {
    const heading = rowText(row).match(ATB_ACCOUNT_SUMMARY);
    if (heading) {
      const name = rowText(ordered[index + 1] ?? row).trim();
      const printed = rowText(ordered[index + 2] ?? row).match(/^#?(\d{6,})/)?.[1] ?? '';
      const kind = heading[1].toLowerCase() === 'loan' ? 'loan' : 'deposit';
      parts.push({ kind, name, number: listedNumber(ordered, name) ?? printed, rows: [] });
    } else {
      parts[parts.length - 1]?.rows.push(row);
    }
  }
  return parts;
}

/** The number the front page lists under the account's name. */
function listedNumber(rows: PdfTextRow[], name: string): string | null {
  const index = rows.findIndex(row => row.page === 1 && rowText(row).startsWith(name));
  return index === -1
    ? null
    : (rowText(rows[index + 1] ?? rows[index]).match(/^#(\d{6,})/)?.[1] ?? null);
}

/**
 * ATB Financial (Canada) consolidated statement: a part per account, each
 * with a summary and a table of money out, money into and the balance, dates
 * without a year. Often a scan, read by OCR. Deposit accounts come out as one
 * statement each; loan parts are left out, their payments already show as
 * transfers from the deposit account.
 */
export class AtbParser extends GenericPdfParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    if ((bankName !== BankName.ATB && bankName !== BankName.OTHER) || fileType !== FileType.PDF) {
      return false;
    }
    try {
      return isAtbStatement(cachedText ?? (await extractTextFromPdf(filePath)));
    } catch (error) {
      this.logger.error('Error in canParse:', error);
      return false;
    }
  }

  protected readTransactions(rows: PdfTextRow[]): LayoutTransaction[] {
    const parts = splitAccountParts(rows).filter(part => part.kind === 'deposit');
    if (parts.length === 0) {
      return super.readTransactions(rows);
    }
    return parts.flatMap(part =>
      super.readTransactions(part.rows).map(row => ({
        ...row,
        counterparty: row.counterparty || atbCounterparty(row.description),
        account: { accountNumber: part.number || part.name },
      })),
    );
  }
}
