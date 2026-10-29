import { BankName, FileType } from '@/entities/statement.entity';
import {
  BankOfChinaParser,
  isBankOfChinaStatement,
} from '@/modules/parsing/parsers/bank-of-china.parser';

/** The lines the PDF text layer reads in the heading and the footer. */
const STATEMENT = [
  'MEMBER ONE Consolidated Statement',
  'i-Free Banking Customer No 00000001',
  'Statement Date 2020/10/31',
  'Address: 1 Example Road, Hong Kong Website: www.bochk.com',
].join('\n');

describe('BankOfChinaParser', () => {
  it('knows its statement by the website in the footer and the statement date', () => {
    expect(isBankOfChinaStatement(STATEMENT)).toBe(true);
    expect(isBankOfChinaStatement('Statement Date 2020/10/31\n2020/10/05 TRANSFER TO BOCHK 100.00')).toBe(
      false,
    );
  });

  it('parses its files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new BankOfChinaParser();
    await expect(parser.canParse(BankName.BANK_OF_CHINA, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(
      true,
    );
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.AXIS, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
    await expect(parser.canParse(BankName.BANK_OF_CHINA, FileType.CSV, 'x.csv', STATEMENT)).resolves.toBe(
      false,
    );
  });
});
