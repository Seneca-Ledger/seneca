import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { datedMoneyLines } from '@/modules/parsing/helpers/scan-statement.helper';

/** A word is [text, x]. */
const row = (y: number, words: [string, number][]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
});

describe('datedMoneyLines', () => {
  it('counts lines that start with a date and carry money, whatever the headings say', () => {
    expect(
      datedMoneyLines([
        row(100, [['When', 40], ['What', 120], ['Left', 475]]),
        row(120, [['01-02-2025', 40], ['ACME', 120], ['Store', 145], ['12.50', 317], ['987.50', 470]]),
        row(140, [['03-02-2025', 40], ['Member', 120], ['One', 155], ['100.00', 382]]),
      ]),
    ).toBe(2);
  });

  it('counts no receipt line: a date alone, or money without a leading date', () => {
    expect(
      datedMoneyLines([
        row(40, [['01-02-2025', 40], ['14:32', 100]]),
        row(60, [['Wireless', 40], ['Buds', 90], ['12.50', 300]]),
        row(80, [['Total', 40], ['12.50', 300]]),
      ]),
    ).toBe(0);
  });
});
