import { BankName, FileType } from '@/entities/statement.entity';
import {
  AssociatedParser,
  associatedCounterparty,
  isAssociatedStatement,
} from '@/modules/parsing/parsers/associated.parser';

/** The lines the PDF text layer reads around the activity lists. */
const STATEMENT = [
  'Associated Bank N.A.',
  'FINANCIAL STATEMENT OF ACCOUNTS',
  'Deposits and Other Additions',
  '02/18/2020 ACME CO PAYROLL 862.79',
  'Withdrawals and Other Deductions',
  '02/19/2020 DDA PUR ACME STORE EXAMPLE TOWN WI 104900520954 500.99',
].join('\n');

describe('AssociatedParser', () => {
  it('knows its statement by the bank name and the activity headings', () => {
    expect(isAssociatedStatement(STATEMENT)).toBe(true);
    expect(isAssociatedStatement('Associated Bank N.A.\nYour new debit card')).toBe(false);
  });

  it('drops the entry kind and the trace number from the payee', () => {
    expect(associatedCounterparty('DDA PUR ACME STORE EXAMPLE TOWN WI 104900520954')).toBe(
      'ACME STORE EXAMPLE TOWN WI',
    );
    expect(associatedCounterparty('CHECKING/MMA WD')).toBe('CHECKING/MMA WD');
  });

  it('parses Associated files under its own bank or under OTHER, and PDFs only', async () => {
    const parser = new AssociatedParser();
    await expect(
      parser.canParse(BankName.ASSOCIATED, FileType.PDF, 'x.pdf', STATEMENT),
    ).resolves.toBe(true);
    await expect(parser.canParse(BankName.OTHER, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(true);
    await expect(parser.canParse(BankName.ANZ, FileType.PDF, 'x.pdf', STATEMENT)).resolves.toBe(false);
    await expect(
      parser.canParse(BankName.ASSOCIATED, FileType.CSV, 'x.csv', STATEMENT),
    ).resolves.toBe(false);
  });
});
