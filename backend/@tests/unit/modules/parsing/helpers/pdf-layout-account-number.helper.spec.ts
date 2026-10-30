import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { findAccountNumberInColumn } from '@/modules/parsing/helpers/pdf-layout-account-number.helper';

/** A word is [text, x]; width is 5pt per character. */
type Word = [string, number];

const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});

const NUMBER = '000-111-2-333333-4';

describe('pdf-layout-account-number.helper', () => {
  it('reads the number under an "Account Number" heading, past a unit line', () => {
    const rows = [
      row(100, [['Account', 97], ['Type', 127], ['Account', 231], ['Number', 268], ['Balance', 318]]),
      row(109, [['in', 360], ['Original', 369], ['Currency', 397]]),
      row(123, [['HKD', 96], ['Savings', 115], ['Deposits', 144], [NUMBER, 230], ['1,000.00', 531]]),
    ];
    expect(findAccountNumberInColumn(rows)).toBe(NUMBER);
  });

  it('takes no number from another column or another page', () => {
    const heading = row(100, [['Account', 231], ['No.', 268]]);
    expect(findAccountNumberInColumn([heading, row(110, [['20201031', 40], ['10000001', 330]])])).toBeNull();
    expect(findAccountNumberInColumn([heading, row(110, [[NUMBER, 230]], 2)])).toBeNull();
    expect(findAccountNumberInColumn([row(100, [['Account', 231], ['Summary', 268]]), row(110, [[NUMBER, 230]])])).toBeNull();
  });
});
