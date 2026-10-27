import { BankName, FileType } from '@/entities/statement.entity';
import {
  AbsaParser,
  findAbsaAccountNumber,
  isAbsaStatement,
} from '@/modules/parsing/parsers/absa.parser';

const ACCOUNT = '4000000001';

/** The header as the PDF text layer reads it: the bank's column runs beside the holder's. */
const HEADER = [
  'Transaction History (2024-08-08 08:46:37)',
  'MEMBER ONE ABSA',
  `00001 Main Street ${ACCOUNT}`,
  'CENTRAL Savings account',
  '0001',
  'Current Balance R13.40',
  'Statement for the Period 2024-05-01 - 2024-08-08',
  'Date Transaction Description Amount Balance',
].join('\n');

describe('AbsaParser', () => {
  it('knows its header and reads the account number under the bank name', () => {
    expect(isAbsaStatement(HEADER)).toBe(true);
    expect(findAbsaAccountNumber(HEADER)).toBe(ACCOUNT);
  });

  it('does not claim a statement that only mentions the bank in a row', () => {
    const elsewhere = 'Statement for the period\n2024-06-20 NPF TRANSFER CR ABSA BANK 51834365 R8 000.00';
    expect(isAbsaStatement(elsewhere)).toBe(false);
  });

  it('parses Absa files under their own bank or under OTHER, and PDFs only', async () => {
    const parser = new AbsaParser();
    await expect(parser.canParse(BankName.ABSA, FileType.PDF, 'x.pdf', HEADER)).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', HEADER)).resolves.toBe(true);
    await expect(parser.canParse(BankName.KASPI, FileType.PDF, 'x.pdf', HEADER)).resolves.toBe(
      false,
    );
    await expect(parser.canParse(BankName.ABSA, FileType.CSV, 'x.csv', HEADER)).resolves.toBe(false);
  });
});
