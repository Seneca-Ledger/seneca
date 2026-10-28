import { BankName, FileType } from '@/entities/statement.entity';
import { AtbParser, atbCounterparty, isAtbStatement } from '@/modules/parsing/parsers/atb.parser';

/** The lines OCR reads around one account's part of the statement. */
const STATEMENT = [
  'ATB Financial',
  'Consolidated Statement',
  'A summary of Deposit Account',
  'Unlimited Account',
  '00123456701 Transit # 00123-123',
  'Aug 8 POS Purchase ACME STORE $8.88 1,950.31',
].join('\n');

describe('AtbParser', () => {
  it('knows its statement by the bank name and an account summary heading', () => {
    expect(isAtbStatement(STATEMENT)).toBe(true);
    expect(isAtbStatement('ATB Financial\nYour new card is on its way')).toBe(false);
  });

  it('names the merchant after "POS Purchase" when ATB prints one', () => {
    expect(atbCounterparty('POS Purchase ACME STORE')).toBe('ACME STORE');
    expect(atbCounterparty('MOBILE Bill Payment')).toBe('MOBILE Bill Payment');
  });

  it('parses ATB files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new AtbParser();
    await expect(parser.canParse(BankName.ATB, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
    await expect(parser.canParse(BankName.ATB, FileType.CSV, 'x.csv', STATEMENT)).resolves.toBe(false);
  });
});
