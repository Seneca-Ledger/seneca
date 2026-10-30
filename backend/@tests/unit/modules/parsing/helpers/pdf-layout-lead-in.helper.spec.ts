import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 9pt. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 9, page })),
});

// "Particulars" is centred over a cell whose text starts at 132; the branch
// code under "Init. Br" is no part of the row's text. Right edges: Debit 360,
// Credit 425, Balance 504.
const header = row(100, [
  ['Tran', 40],
  ['Date', 61],
  ['Particulars', 190],
  ['Debit', 335],
  ['Credit', 395],
  ['Balance', 469],
  ['Init.', 538],
]);
const dated = (y: number, date: string, text: string, amount: [string, number], balance: string, page = 1) =>
  row(y, [[date, 39], [text, 132], amount, [balance, 504 - balance.length * 5], ['870', 539]], page);

describe('pdf-layout-lead-in.helper', () => {
  it("reads text printed above the date as that row's, over page breaks and three lines", () => {
    const rows = readLayoutTransactions([
      header,
      row(114, [['UPI/P2A/100000000001/MEMBER', 132], ['ONE', 262]]),
      dated(123, '30-08-2023', 'Pay/Payment', ['800.00', 330], '690.11'),
      row(136, [['NEFT/N100000000002/EXAMPLE', 132]]),
      row(145, [['PROVIDENT', 132], ['FUND', 185]]),
      dated(154, '21-12-2023', 'INDIA//URGENT', ['9650.00', 390], '10340.11'),
      row(167, [['UPI/P2A/100000000003/ACME', 132], ['STORE', 262]]),
      dated(176, '22-12-2023', '/Payment', ['40.00', 340], '10300.11'),
      // The next page has no header: its first row's text is still above its date.
      row(40, [['UPI/P2A/100000000004/MEMBER', 132], ['TWO', 262]], 2),
      dated(49, '29-12-2023', 'DAS', ['300.00', 330], '10000.11', 2),
      row(62, [['UPI/P2A/100000000005/ACME', 132]], 2),
      dated(71, '30-12-2023', 'SHOP', ['.11', 345], '10000.00', 2),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.debit, t.credit])).toEqual([
      ['30-08-2023', 'UPI/P2A/100000000001/MEMBER ONE Pay/Payment', 800, undefined],
      ['21-12-2023', 'NEFT/N100000000002/EXAMPLE PROVIDENT FUND INDIA//URGENT', undefined, 9650],
      ['22-12-2023', 'UPI/P2A/100000000003/ACME STORE /Payment', 40, undefined],
      ['29-12-2023', 'UPI/P2A/100000000004/MEMBER TWO DAS', 300, undefined],
      ['30-12-2023', 'UPI/P2A/100000000005/ACME SHOP', 0.11, undefined],
    ]);
  });

  it('keeps evenly spaced lines under a row with that row', () => {
    const rows = readLayoutTransactions([
      header,
      dated(120, '06-01-2023', 'Check Card Purchase', ['29.23', 330], '3550.65'),
      row(131.7, [['ACME', 132], ['STORE', 160]]),
      row(143.2, [['EXAMPLE', 132], ['TOWN', 172]]),
      dated(154, '09-01-2023', 'Direct Deposit', ['1500.00', 390], '5050.65'),
      row(165.7, [['PAYROLL', 132]]),
    ]);
    expect(rows.map(t => t.description)).toEqual([
      'Check Card Purchase ACME STORE EXAMPLE TOWN',
      'Direct Deposit PAYROLL',
    ]);
  });
});
