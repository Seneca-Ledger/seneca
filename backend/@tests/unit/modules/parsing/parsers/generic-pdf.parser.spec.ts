import { extractTablesFromPdf, extractTextFromPdf } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { GenericPdfParser } from '@/modules/parsing/parsers/generic-pdf.parser';

jest.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: jest.fn().mockResolvedValue({
      locale: 'unknown',
      confidence: 0,
      method: 'legacy',
      reason: 'mock',
    }),
  },
}));

jest.mock('@/common/utils/pdf-parser.util', () => ({
  extractTextFromPdf: jest.fn(),
  extractTablesFromPdf: jest.fn(),
}));

describe('GenericPdfParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canParse', () => {
    it('accepts any PDF for an unrecognized bank', async () => {
      const parser = new GenericPdfParser();
      const result = await parser.canParse(BankName.OTHER, FileType.PDF, '/tmp/mock.pdf', 'text');

      expect(result).toBe(true);
    });
  });

  describe('parse', () => {
    it('preserves a legitimate zero opening balance instead of dropping it', async () => {
      const parser = new GenericPdfParser();
      const text = ['Statement', 'Остаток на начало 0,00', 'Остаток на конец 500,00'].join('\n');

      (extractTextFromPdf as jest.Mock).mockResolvedValue(text);
      (extractTablesFromPdf as jest.Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.metadata.balanceStart).toBe(0);
      expect(result.metadata.balanceEnd).toBe(500);
    });

    it('does not swallow an unrelated numeric line following the balance into the parsed value', async () => {
      const parser = new GenericPdfParser();
      // "1" directly below the balance, with no letters in between, is the
      // exact shape that used to defeat the old greedy [\d\s,.-]+ capture
      // (it happily spans newlines) — e.g. a lone page number.
      const text = [
        'Statement',
        'Остаток на начало 1 000,00',
        '1',
        'Остаток на конец 500,00',
      ].join('\n');

      (extractTextFromPdf as jest.Mock).mockResolvedValue(text);
      (extractTablesFromPdf as jest.Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.metadata.balanceStart).toBe(1000);
      expect(result.metadata.balanceEnd).toBe(500);
    });
  });
});
