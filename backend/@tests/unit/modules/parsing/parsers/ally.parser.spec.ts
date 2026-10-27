import { BankName, FileType } from '@/entities/statement.entity';
import { AllyParser, allyCounterparty, isAllyStatement } from '@/modules/parsing/parsers/ally.parser';
import type { LayoutTransaction } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** The lines the PDF text layer reads around one account's activity. */
const STATEMENT = [
  'COMBINED CUSTOMER STATEMENT',
  'Account Number: xxxxxx0001 Open Date: 01/02/2020',
  'Activity',
  'Date Description Credits Debits Balance',
  '01/06/2023 Beginning Balance $1,000.00',
  '01/07/2023 Check Card Purchase $0.00 -$12.50 $987.50',
  'ACME STORE EXAMPLE TOWN, ST',
  'Ally Bank Member FDIC STMTCMB100 05/2013',
].join('\n');

const row = (firstLine: string, description: string): LayoutTransaction => ({
  date: { day: 7, month: 1, year: 2023 },
  dateText: '01/07/2023',
  firstLine,
  description,
  counterparty: '',
});

describe('AllyParser', () => {
  it('knows its statement by the page footer and the activity table', () => {
    expect(isAllyStatement(STATEMENT)).toBe(true);
    expect(isAllyStatement('Ally Bank Member FDIC\nYour new card is on its way')).toBe(false);
  });

  it('takes the payee from the lines under the transaction kind, without Ally notes', () => {
    expect(
      allyCounterparty(
        row('Direct Deposit', 'Direct Deposit EXAMPLE PAY~ Future Amount: 700 ~ Tran: DDIR TRANSFER'),
      ),
    ).toBe('EXAMPLE PAY TRANSFER');
    expect(allyCounterparty(row('Interest Paid', 'Interest Paid'))).toBe('');
  });

  it('parses Ally files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new AllyParser();
    await expect(parser.canParse(BankName.ALLY, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.ABSA, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(
      false,
    );
    await expect(parser.canParse(BankName.ALLY, FileType.CSV, 'x.csv', STATEMENT)).resolves.toBe(false);
  });
});
