import type { Mock } from 'vitest';
import type { PdfTextRow } from '@/common/utils/pdf-parser.util';
import {
  extractTablesFromPdf,
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
} from '@/common/utils/pdf-parser.util';
import {
  CONTRIBUTED_LAYOUTS,
  type ContributedLayout,
  contributedHeadings,
} from '@/modules/parsing/helpers/contributed-layouts';
import { GenericPdfParser } from '@/modules/parsing/parsers/generic-pdf.parser';

vi.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: vi.fn().mockResolvedValue({ locale: 'unknown', confidence: 0, method: 'legacy', reason: 'mock' }),
  },
}));
vi.mock('@/common/utils/pdf-parser.util', () => ({
  extractTextFromPdf: vi.fn(),
  extractTablesFromPdf: vi.fn(),
  extractTextAndLayoutFromPdf: vi.fn(),
}));

const northwind: ContributedLayout = {
  bank: 'Northwind Mutual',
  names: ['northwind mutual'],
  headings: [
    { phrase: 'when', role: 'date' },
    { phrase: 'what', role: 'description' },
    { phrase: 'went out', role: 'debit' },
    { phrase: 'came in', role: 'credit' },
    { phrase: 'left', role: 'balance' },
  ],
};

type Word = [string, number];
const row = (y: number, words: Word[]): PdfTextRow => ({
  page: 1,
  y,
  text: words.map(([text]) => text).join(' '),
  items: words.map(([text, x]) => ({ text, x, y, width: text.length * 5, height: 8, page: 1 })),
});
const rows = [
  row(100, [['When', 40], ['What', 120], ['Went', 300], ['Out', 322], ['Came', 375], ['In', 400], ['Left', 475]]),
  row(120, [['01-02-2025', 40], ['ACME', 120], ['Store', 145], ['12.50', 317], ['987.50', 470]]),
  row(140, [['03-02-2025', 40], ['Member', 120], ['One', 155], ['100.00', 382], ['1,087.50', 460]]),
];

async function read(text: string) {
  (extractTextFromPdf as Mock).mockResolvedValue(text);
  (extractTablesFromPdf as Mock).mockResolvedValue({ rowSets: [] });
  (extractTextAndLayoutFromPdf as Mock).mockResolvedValue({ text, rows });
  return new GenericPdfParser().parse('/tmp/statement.pdf');
}

describe('contributed layouts', () => {
  afterEach(() => {
    CONTRIBUTED_LAYOUTS.length = 0;
  });

  it('gives the headings of the banks a file names, as whole words', () => {
    expect(contributedHeadings('NORTHWIND  MUTUAL\nAccount statement', [northwind])?.get('went out')).toBe(
      'debit',
    );
    expect(contributedHeadings('Northwind Mutuality Fund', [northwind])).toBeUndefined();
    expect(contributedHeadings('Another Bank', [northwind])).toBeUndefined();
  });

  it('reads a statement of the named bank with them, and no other bank’s', async () => {
    expect((await read('Northwind Mutual statement')).transactions).toHaveLength(0);
    CONTRIBUTED_LAYOUTS.push(northwind);
    const named = await read('Northwind Mutual statement');
    expect(named.transactions.map(t => [t.paymentPurpose, t.debit, t.credit])).toEqual([
      ['ACME Store', 12.5, undefined],
      ['Member One', undefined, 100],
    ]);
    expect((await read('Another Bank statement')).transactions).toHaveLength(0);
  });
});
