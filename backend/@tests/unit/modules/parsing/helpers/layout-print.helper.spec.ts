import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import { layoutPrint } from '@/modules/parsing/helpers/layout-print.helper';

type Word = [string, number];
const row = (y: number, words: Word[], page = 1): PdfTextRow => ({
  page,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page })),
});
const header = (page: number) =>
  row(100, [['When', 40], ['What', 120], ['Sum', 330], ['Left', 470]], page);

// Two pages, headings repeated; descriptions on two lines; money in "1.087,50",
// money out in brackets, "CR" beside the balance.
const rows = [
  row(60, [['Currency', 40], ['EUR', 100]]),
  header(1),
  row(120, [['01.02.2025', 40], ['ACME', 120], ['Store', 145], ['(12,50)', 330], ['987,50', 470], ['CR', 505]]),
  row(130, [['Wireless', 120], ['Buds', 160]]),
  row(150, [['03.02.2025', 40], ['Member', 120], ['One', 155], ['1.087,50', 330], ['2.075,00', 470], ['CR', 505]]),
  row(160, [['transfer', 120]]),
  header(2),
  row(120, [['07.02.2025', 40], ['City', 120], ['Water', 145], ['(45,20)', 330], ['2.029,80', 470], ['CR', 505]], 2),
  row(130, [['Utility', 120]], 2),
];
const regions = [
  { tag: 'date', page: 1, x0: 35, y0: 115, x1: 100, y1: 170 },
  { tag: 'description', page: 1, x0: 115, y0: 115, x1: 300, y1: 170 },
  { tag: 'amount', page: 1, x0: 320, y0: 115, x1: 380, y1: 170 },
  { tag: 'balance', page: 1, x0: 450, y0: 115, x1: 530, y1: 170 },
];
const headings = new Map([
  ['when', 'date'],
  ['what', 'description'],
  ['sum', 'amount'],
  ['left', 'balance'],
] as const);

describe('layoutPrint', () => {
  it('reads how the statement prints, with digits as #', () => {
    expect(layoutPrint(rows, regions, headings)).toEqual({
      dateShape: '##.##.####',
      amounts: { decimal: ',', thousands: '.', negative: 'parentheses', marks: ['CR'] },
      descriptionLines: 2,
      pages: 2,
      headerOnEveryPage: true,
      fontSize: 8,
      rowGap: 30,
      currency: 'EUR',
    });
  });

  it('keeps no figure, name or description', () => {
    const printed = JSON.stringify(layoutPrint(rows, regions, headings));
    for (const secret of ['12', '987', '2025', 'acme', 'member', 'water']) {
      expect(printed.toLowerCase()).not.toContain(secret);
    }
  });

  it('notices a page without the headings', () => {
    const noRepeat = rows.filter(line => line !== rows[6]);
    expect(layoutPrint(noRepeat, regions, headings).headerOnEveryPage).toBe(false);
  });
});
