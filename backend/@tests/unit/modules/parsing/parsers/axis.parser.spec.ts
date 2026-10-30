import { BankName, FileType } from '@/entities/statement.entity';
import { AxisParser, axisCounterparty, isAxisStatement } from '@/modules/parsing/parsers/axis.parser';

/** The lines the PDF text layer reads around the transactions table. */
const STATEMENT = [
  'SAMPLE OWNER',
  'IFSC Code :EXMP0000001',
  'Statement of Axis Account No :100000000000001 for the period (From : 23-08-2023 To : 24-01-2024)',
  'Tran Date Chq No Particulars Debit Credit Balance Init.',
].join('\n');

describe('AxisParser', () => {
  it('knows its statement by the heading over the transactions', () => {
    expect(isAxisStatement(STATEMENT)).toBe(true);
    expect(isAxisStatement('Axis Bank Ltd\nYour card is on its way')).toBe(false);
  });

  it.each([
    ['UPI/P2A/100000000001/MEMBER ONE/Example Pay/Payment', 'MEMBER ONE'],
    ['NEFT/N100000000002/ACME LOGISTICS LIMITED/EXAMPLE BANK/13445731', 'ACME LOGISTICS LIMITED'],
    ['NEFT/MB/EXMB40044963901/MEMBER TWO/EXAMPLE PAYMENTS BANK /', 'MEMBER TWO'],
    ['IMPS/P2A/100000000003/ACMEPAYS/EXAMPLEBA N/FTTransf', 'ACMEPAYS'],
    ['UPI/CRADJ/100000000004/12.10.2023', 'UPI/CRADJ/100000000004/12.10.2023'],
    ['ECS Txn Chrgs Incl GST', 'ECS Txn Chrgs Incl GST'],
  ])('names the other side of %s', (description, expected) => {
    expect(axisCounterparty(description)).toBe(expected);
  });

  it('parses Axis files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new AxisParser();
    await expect(parser.canParse(BankName.AXIS, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.ATB, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
    await expect(parser.canParse(BankName.AXIS, FileType.CSV, 'x.csv', STATEMENT)).resolves.toBe(false);
  });
});
