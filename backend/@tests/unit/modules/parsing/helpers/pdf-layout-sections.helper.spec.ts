import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readSectionHeading } from '@/modules/parsing/helpers/pdf-layout-sections.helper';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 10pt. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1, height = 10): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height, page })),
});

/** Every word of a phrase, 5pt per character and a space apart, starting at x. */
const phrase = (text: string, x: number): Word[] => {
  let at = x;
  return text.split(' ').map(word => {
    const placed: Word = [word, at];
    at += (word.length + 1) * 5;
    return placed;
  });
};

// Amounts end at 560 (right-aligned); the text starts at 130.
const entry = (y: number, date: string, text: string, amount: string, page = 1) =>
  row(y, [[date, 60], ...phrase(text, 130), [amount, 560 - amount.length * 5]], page);

describe('pdf-layout-sections.helper', () => {
  it('knows deposit and withdrawal headings, continued or not, and nothing else', () => {
    expect(readSectionHeading(row(10, phrase('Deposits and Other Additions', 50)))).toBe('credit');
    expect(
      readSectionHeading(row(10, phrase('Withdrawals and Other Deductions (continued)', 50))),
    ).toBe('debit');
    expect(readSectionHeading(row(10, phrase('DEPOSIT ACCOUNTS', 50)))).toBeNull();
    expect(readSectionHeading(row(10, phrase('Plus: Deposits and Other Additions 3,909.54', 50)))).toBeNull();
  });

  it('signs each row by its section, without a column header, up to the totals line', () => {
    const rows = readLayoutTransactions([
      row(100, phrase('Deposits and Other Additions', 50)),
      entry(120, '02/18/2020', 'ACME CO PAYROLL', '862.79'),
      entry(132, '03/01/2020', 'ATM DEP EXAMPLE TOWN', '1,105.00'),
      row(144, [['TOTAL', 400], ['$1,967.79', 515]]),
      row(170, phrase('Withdrawals and Other Deductions', 50)),
      entry(190, '02/19/2020', 'DDA PUR ACME STORE', '500.99'),
      // A footer close under the last row is not its text.
      row(214, phrase('Member FDIC. Equal Housing Lender', 145), 1, 8),
      row(60, phrase('Withdrawals and Other Deductions (continued)', 50), 2),
      entry(80, '03/16/2020', 'SERVICE FEE', '4.00', 2),
      row(92, [['TOTAL', 400], ['$504.99', 525]], 2),
      // The daily balances under the lists are not movements.
      row(140, phrase('Balance Summary', 50), 2),
      row(160, [['02/18/2020', 60], ['505.03', 180], ['03/01/2020', 240], ['25.30', 535]], 2),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.debit, t.credit])).toEqual([
      ['02/18/2020', 'ACME CO PAYROLL', undefined, 862.79],
      ['03/01/2020', 'ATM DEP EXAMPLE TOWN', undefined, 1105],
      ['02/19/2020', 'DDA PUR ACME STORE', 500.99, undefined],
      ['03/16/2020', 'SERVICE FEE', 4, undefined],
    ]);
  });

  it('adds a wrapped line that starts under the text to the row above', () => {
    const rows = readLayoutTransactions([
      row(100, phrase('Withdrawals', 50)),
      entry(120, '02/19/2020', 'DDA PUR ACME STORE', '500.99'),
      row(131, phrase('EXAMPLE TOWN', 130)),
    ]);
    expect(rows.map(t => t.description)).toEqual(['DDA PUR ACME STORE EXAMPLE TOWN']);
  });
});
