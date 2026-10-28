import { BankName, FileType } from '@/entities/statement.entity';
import {
  BankOfScotlandParser,
  isBankOfScotlandStatement,
} from '@/modules/parsing/parsers/bank-of-scotland.parser';

/** The lines the PDF text layer reads in the heading and the footer. */
const STATEMENT = [
  'AccountNo 00000001',
  'IBAN GB00 BOFS 0000 0000 0000 01',
  'www.bankofscotland.co.uk',
  'BankofScotlandplc.Registeredoffice:TheMound,Edinburgh',
].join('\n');

describe('BankOfScotlandParser', () => {
  it('knows its statement by its registered name and its website', () => {
    expect(isBankOfScotlandStatement(STATEMENT)).toBe(true);
    expect(isBankOfScotlandStatement('20 Jun FASTER PAYMENT BANK OF SCOTLAND PLC 100.00')).toBe(false);
  });

  it('parses its files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new BankOfScotlandParser();
    await expect(
      parser.canParse(BankName.BANK_OF_SCOTLAND, FileType.PDF, 'x.pdf', STATEMENT),
    ).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.AXIS, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
    await expect(
      parser.canParse(BankName.BANK_OF_SCOTLAND, FileType.CSV, 'x.csv', STATEMENT),
    ).resolves.toBe(false);
  });
});
