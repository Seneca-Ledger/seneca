import { BankName, FileType } from '@/entities/statement.entity';
import { AnzParser, anzCounterparty, isAnzStatement } from '@/modules/parsing/parsers/anz.parser';

/** The lines the PDF text layer reads around the transactions table. */
const STATEMENT = [
  'ANZ ACCESS ADVANTAGE STATEMENT',
  'Transaction Details',
  'Date Transaction Details Withdrawals ($) Deposits ($) Balance ($)',
  '01 FEB ACME STORE EXAMPLE TOWN 12.50 987.50',
  'Australia and New Zealand Banking Group Limited (ANZ) ABN 11 005 357 522.',
].join('\n');

describe('AnzParser', () => {
  it('knows its statement by the legal name and the transactions table', () => {
    expect(isAnzStatement(STATEMENT)).toBe(true);
    expect(
      isAnzStatement('Australia and New Zealand Banking Group Limited\nYour new card is on its way'),
    ).toBe(false);
  });

  it('drops the effective-date note from the payee', () => {
    expect(anzCounterparty('ANZ ATM EXAMPLE TOWN EFFECTIVE DATE 03 FEB 2023')).toBe(
      'ANZ ATM EXAMPLE TOWN',
    );
    expect(anzCounterparty('WAGES ACME CO EFFECTIVE 28 FEB 2023')).toBe('WAGES ACME CO');
  });

  it('parses ANZ files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new AnzParser();
    await expect(parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.ALLY, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
    await expect(parser.canParse(BankName.ANZ, FileType.CSV, 'x.csv', STATEMENT)).resolves.toBe(false);
  });
});
