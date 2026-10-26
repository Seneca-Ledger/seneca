/**
 * Integration test: run HapoalimParser (Tesseract OCR path) against the invented
 * statement pages in docs/statements-examples/hapoalim. The pages are rendered by
 * backend/scripts/fixtures/make-hapoalim-example.py from hapoalim-example.json,
 * which this spec reads too, so every expectation comes from that one file.
 */
import * as fs from 'fs';
import * as path from 'path';
import { HapoalimParser } from '@/modules/parsing/parsers/hapoalim.parser';
import { BankName, FileType } from '@/entities/statement.entity';

vi.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: vi.fn().mockResolvedValue({
      locale: 'he',
      confidence: 0.9,
      method: 'mock',
      reason: 'mock',
    }),
  },
}));

interface FixtureRow {
  date: string;
  merchant: string;
  charge: string;
  note?: string;
}

interface FixturePage {
  page: number;
  foreign: FixtureRow[];
  domestic: FixtureRow[];
}

const EXAMPLES_DIR = path.resolve(__dirname, '../../../docs/statements-examples/hapoalim');
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../scripts/fixtures/hapoalim-example.json'), 'utf8'),
) as { accountNumber: string; billingDate: string; pages: Record<string, FixturePage> };

/** DD/MM/YY as printed on the statement → YYYY-MM-DD. */
const isoDate = (printed: string) => {
  const [day, month, year] = printed.split('/');
  return `20${year}-${month}-${day}`;
};

const amount = (printed: string) => Number(printed.replace(/,/g, ''));

function expectRows(fileName: string, rows: FixtureRow[], parsed: Awaited<ReturnType<HapoalimParser['parse']>>) {
  expect(parsed.transactions).toHaveLength(rows.length);
  rows.forEach((row, i) => {
    const tx = parsed.transactions[i];
    expect(tx.transactionDate.toISOString().slice(0, 10), `${fileName} row ${i + 1}`).toBe(isoDate(row.date));
    expect(tx.debit, `${fileName} row ${i + 1}`).toBe(amount(row.charge));
    expect(tx.credit).toBeUndefined();
    expect(tx.counterpartyName).toContain(row.merchant);
    if (row.note) expect(tx.paymentPurpose).toContain(row.note);
  });
}

describe('HapoalimParser integration — example statement images', () => {
  const parser = new HapoalimParser();

  it.each(Object.keys(FIXTURE.pages))('canParse %s', async fileName => {
    const result = await parser.canParse(BankName.HAPOALIM, FileType.IMAGE, path.join(EXAMPLES_DIR, fileName));
    expect(result).toBe(true);
  }, 120000);

  it('parses hapoalim-1.jpg (page 2: foreign continuation + domestic)', async () => {
    const page = FIXTURE.pages['hapoalim-1.jpg'];
    expect(page.foreign.length).toBeGreaterThan(0);
    expect(page.domestic.length).toBeGreaterThan(0);

    const result = await parser.parse(path.join(EXAMPLES_DIR, 'hapoalim-1.jpg'));

    expect(result.metadata.currency).toBe('ILS');
    expect(result.metadata.accountNumber).toBe(FIXTURE.accountNumber);
    expectRows('hapoalim-1.jpg', [...page.foreign, ...page.domestic], result);
  }, 120000);

  it('parses hapoalim-2.jpg (page 1: header + foreign transactions)', async () => {
    const page = FIXTURE.pages['hapoalim-2.jpg'];

    const result = await parser.parse(path.join(EXAMPLES_DIR, 'hapoalim-2.jpg'));

    expect(result.metadata.currency).toBe('ILS');
    expect(result.metadata.accountNumber).toBe(FIXTURE.accountNumber);
    expect(result.metadata.dateTo.toISOString().slice(0, 10)).toBe(isoDate(FIXTURE.billingDate));
    expectRows('hapoalim-2.jpg', page.foreign, result);
  }, 120000);
});
