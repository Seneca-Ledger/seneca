import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { readLayoutTransactions } from '@/modules/parsing/helpers/pdf-layout-table.helper';

/** A word is [text, x]; width is 5pt per character, height 6pt. */
type Word = [string, number];

const row = (y: number, words: Word[]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 6, page: 1 })),
});

describe('pdf-layout-stacked-header.helper', () => {
  it('reads a header whose headings wrap onto a second line', () => {
    const rows = readLayoutTransactions([
      // "Money out of" / "your account ($)" ends at 400, "Money into" / … at 515.
      row(100, [['Money', 330], ['out', 360], ['of', 380], ['Money', 445], ['into', 475]]),
      row(106, [
        ['Date', 85],
        ['Description', 130],
        ['your', 325],
        ['account', 347],
        ['($)', 385],
        ['your', 440],
        ['account', 462],
        ['($)', 500],
        ['Balance', 540],
        ['($)', 580],
      ]),
      row(120, [['Aug', 85], ['8', 101], ['ACME', 130], ['Store', 155], ['$8.88', 375], ['1,950.31', 555]]),
      row(136, [['Aug', 85], ['9', 101], ['Deposit', 130], ['$300.00', 480], ['2,250.31', 555]]),
      // OCR lost the decimal point: no amount, and not part of the text either.
      row(152, [['Aug', 85], ['9', 101], ['Withdrawal', 130], ['$200.00', 365], ['205031', 565]]),
    ]);
    expect(rows.map(t => [t.dateText, t.description, t.debit, t.credit, t.balance])).toEqual([
      ['Aug 8', 'ACME Store', 8.88, undefined, 1950.31],
      ['Aug 9', 'Deposit', undefined, 300, 2250.31],
      ['Aug 9', 'Withdrawal', 200, undefined, undefined],
    ]);
  });
});
