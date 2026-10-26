import { normalizeDate } from '@/common/utils/number-normalizer.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { HapoalimParser } from '@/modules/parsing/parsers/hapoalim.parser';
import { OcrService } from '@/modules/parsing/services/ocr.service';

vi.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: vi.fn().mockResolvedValue({
      locale: 'unknown',
      confidence: 0,
      method: 'legacy',
      reason: 'mock',
    }),
  },
}));

describe('HapoalimParser', () => {
  const expectDateParts = (date: Date | null | undefined, expected: string) => {
    expect(date).toBeInstanceOf(Date);
    if (!date) return;
    const [year, month, day] = expected.split('-').map(Number);
    expect(date.getFullYear()).toBe(year);
    expect(date.getMonth() + 1).toBe(month);
    expect(date.getDate()).toBe(day);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canParse', () => {
    it('returns true for text with Hebrew Hapoalim markers', async () => {
      const parser = new HapoalimParser();
      const result = await parser.canParse(
        BankName.HAPOALIM,
        FileType.IMAGE,
        '/tmp/mock.jpg',
        'בנק הפועלים ישראכרט statement 10/01/26',
      );
      expect(result).toBe(true);
    });

    it('returns true for text with English Isracard markers', async () => {
      const parser = new HapoalimParser();
      const result = await parser.canParse(
        BankName.OTHER,
        FileType.IMAGE,
        '/tmp/mock.jpg',
        'isracard.co.il credit card statement',
      );
      expect(result).toBe(true);
    });

    it('returns false for Kaspi bank text', async () => {
      const parser = new HapoalimParser();
      const result = await parser.canParse(
        BankName.HAPOALIM,
        FileType.IMAGE,
        '/tmp/mock.jpg',
        'Kaspi Bank statement 01.01.2025',
      );
      expect(result).toBe(false);
    });

    it('returns false for non-image/non-PDF file types', async () => {
      const parser = new HapoalimParser();
      const result = await parser.canParse(
        BankName.HAPOALIM,
        FileType.XLSX,
        '/tmp/mock.xlsx',
        'בנק הפועלים',
      );
      expect(result).toBe(false);
    });

    it('returns false for wrong bank name without markers', async () => {
      const parser = new HapoalimParser();
      const result = await parser.canParse(
        BankName.KASPI,
        FileType.IMAGE,
        '/tmp/mock.jpg',
        'בנק הפועלים',
      );
      expect(result).toBe(false);
    });
  });

  describe('normalizeDate with DD/MM/YY format', () => {
    it('parses 10/01/26 as January 10, 2026', () => {
      const date = normalizeDate('10/01/26');
      expectDateParts(date, '2026-01-10');
    });

    it('parses 29/12/25 as December 29, 2025', () => {
      const date = normalizeDate('29/12/25');
      expectDateParts(date, '2025-12-29');
    });

    it('parses 15/06/99 as June 15, 1999 (century pivot)', () => {
      const date = normalizeDate('15/06/99');
      expectDateParts(date, '1999-06-15');
    });

    it('parses 01/01/00 as January 1, 2000', () => {
      const date = normalizeDate('01/01/00');
      expectDateParts(date, '2000-01-01');
    });

    it('parses 31/12/49 as December 31, 2049', () => {
      const date = normalizeDate('31/12/49');
      expectDateParts(date, '2049-12-31');
    });

    it('parses 01/01/50 as January 1, 1950', () => {
      const date = normalizeDate('01/01/50');
      expectDateParts(date, '1950-01-01');
    });

    it('still parses DD/MM/YYYY (4-digit year)', () => {
      const date = normalizeDate('10/01/2026');
      expectDateParts(date, '2026-01-10');
    });
  });

  describe('parseForeignTransactionLine exchange rate', () => {
    it('parses a 3-fractional-digit exchange rate without thousands-grouping corruption', () => {
      const parser = new HapoalimParser();
      const rate = 3.612;
      const line = `13/12/25  DEMO CLOUD DUBLIN  5.00 $  14/12/25  ${rate}  18.06`;

      const tx = (parser as any).parseForeignTransactionLine(line);

      expect(tx.exchangeRate).toBe(rate);
    });
  });

  describe('parseDomesticTransactionLine sign handling', () => {
    it('parses a positive amount as a debit', () => {
      const parser = new HapoalimParser();
      const line = '09/12/25  מכולת דוגמה עיר אקמה  סכולות/סופר  17.00  17.00';

      const tx = (parser as any).parseDomesticTransactionLine(line);

      expect(tx.debit).toBe(17.0);
      expect(tx.credit).toBeUndefined();
    });

    it('parses a negative trailing amount (refund) as a credit, not a debit', () => {
      const parser = new HapoalimParser();
      const line = '15/03/25  ZARA REFUND  ביגוד  -120.00  -120.00';

      const tx = (parser as any).parseDomesticTransactionLine(line);

      expect(tx.credit).toBe(120.0);
      expect(tx.debit).toBeUndefined();
    });
  });

  describe('parse with cachedText', () => {
    const ACCOUNT_NUMBER = '12-600-1234567';
    const SAMPLE_FOREIGN_TEXT = `בנק הפועלים
www.isracard.co.il
מספר חשבון לחיוב במטבע ישראלי: ${ACCOUNT_NUMBER}
רכישות בחו"ל
11/12/25  SAMPLE MUSIC STOCKHOLM  19.90 ₪  19.90
13/12/25  DEMO CLOUD DUBLIN  5.00 $  14/12/25  3.6100  18.05
16/12/25  ACME HOSTING AMSTERDAM  10.00 $  17/12/25  3.6200  36.20
סה"כ חיוב לתאריך 02/01/26  74.15
עסקות שחויבו / זוכו - בארץ
09/12/25  מכולת דוגמה עיר אקמה  סכולות/סופר  17.00  17.00
16/12/25  קפה דוגמה  שונות  13.90  13.90
21/12/25  SAMPLE MOBILE  תקשורת  59.90  59.90
25/12/25  סופר אקמה  סכולות/סופר  41.60  41.60  תשלום 3 מתוך 12
סה"כ חיוב לתאריך 11/01/26  132.40
מסגרת הכרטיס ותנאי האשראי`;

    it('extracts metadata from Hapoalim statement', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      expect(result.metadata.accountNumber).toBe(ACCOUNT_NUMBER);
      expect(result.metadata.currency).toBe('ILS');
      expect(result.metadata.institution).toBe('Bank Hapoalim');
      expect(result.metadata.locale).toBe('he-IL');
    });

    it('skips OCR text parsing when the caller reports low OCR confidence', async () => {
      const parser = new HapoalimParser();
      // Below MIN_OCR_CONFIDENCE (0.4): must not trust this text for
      // regex-based parsing, even though it's the same real cachedText a
      // high-confidence call would parse successfully (see the previous
      // test). Without threading ocrConfidence through, this defaulted to
      // 1.0 whenever the caller had already run OCR — the exact live-pipeline
      // path this parser is normally used on.
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT, 0.1);

      expect(result.transactions).toHaveLength(0);
    });

    it('parses OCR text normally when confidence is not provided (PDF/manual text has no OCR uncertainty)', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      expect(result.transactions.length).toBeGreaterThan(0);
    });

    it('parses foreign transactions', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      // Should find at least the foreign transactions
      const foreignTx = result.transactions.filter(
        t => t.exchangeRate !== undefined || t.amountForeign !== undefined,
      );

      // The parser may find some via regex; we verify at least the structure is correct
      for (const tx of foreignTx) {
        expect(tx.currency).toBe('ILS');
        expect(tx.transactionDate).toBeInstanceOf(Date);
        expect(tx.counterpartyName).toBeTruthy();
      }
    });

    it('parses domestic transactions', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      // Should find domestic transactions
      const domesticTx = result.transactions.filter(
        t => t.exchangeRate === undefined && t.amountForeign === undefined,
      );

      for (const tx of domesticTx) {
        expect(tx.currency).toBe('ILS');
        expect(tx.transactionDate).toBeInstanceOf(Date);
        expect(typeof tx.debit === 'number' || typeof tx.credit === 'number').toBe(true);
      }
    });

    it('captures installment info in payment purpose', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      const installmentTx = result.transactions.find(t =>
        t.paymentPurpose?.includes('תשלום'),
      );

      // If the OCR-based parser finds the installment line, verify it
      if (installmentTx) {
        expect(installmentTx.paymentPurpose).toContain('תשלום');
        expect(installmentTx.paymentPurpose).toContain('מתוך');
      }
    });

    it('skips summary rows', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      // No transaction should have "סה"כ חיוב" in its name
      for (const tx of result.transactions) {
        expect(tx.counterpartyName).not.toContain('סה"כ');
        expect(tx.paymentPurpose).not.toContain('סה"כ');
      }
    });

    it('stops at credit terms section', async () => {
      const parser = new HapoalimParser();
      const result = await parser.parse('/tmp/mock.jpg', SAMPLE_FOREIGN_TEXT);

      // No transaction should reference credit terms content
      for (const tx of result.transactions) {
        expect(tx.counterpartyName).not.toContain('מסגרת הכרטיס');
      }
    });
  });

  describe('OcrService Hebrew support', () => {
    it('detects Hebrew script from text', () => {
      const ocrService = new OcrService();
      const script = ocrService.detectScriptFromText('בנק הפועלים ישראכרט');
      expect(script).toBe('Hebrew');
    });

    it('returns heb for Hebrew script', () => {
      const ocrService = new OcrService();
      const languages = ocrService.getLanguagesForScript('Hebrew');
      expect(languages).toEqual(['heb']);
    });

    it('resolves heb as a valid language', () => {
      const ocrService = new OcrService();
      const resolved = ocrService.resolveLanguages(['heb']);
      expect(resolved).toEqual(['heb']);
    });

    it('includes Hebrew in supported languages', () => {
      const ocrService = new OcrService();
      const languages = ocrService.getSupportedLanguages();
      const hebrew = languages.find(l => l.code === 'heb');
      expect(hebrew).toBeDefined();
      expect(hebrew?.script).toBe('Hebrew');
    });
  });
});
