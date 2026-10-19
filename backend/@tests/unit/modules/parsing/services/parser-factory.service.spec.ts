import { extractTextFromPdf } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { BerekeNewParser } from '@/modules/parsing/parsers/bereke-new.parser';
import { BerekeOldParser } from '@/modules/parsing/parsers/bereke-old.parser';
import { GenericPdfParser } from '@/modules/parsing/parsers/generic-pdf.parser';
import { HapoalimParser } from '@/modules/parsing/parsers/hapoalim.parser';
import { KaspiParser } from '@/modules/parsing/parsers/kaspi.parser';
import { ParserFactoryService } from '@/modules/parsing/services/parser-factory.service';
import { Test, type TestingModule } from '@nestjs/testing';

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
  extractTextFromPdf: jest.fn().mockResolvedValue('kaspi bank statement'),
}));

describe('ParserFactoryService', () => {
  let testingModule: TestingModule;
  let service: ParserFactoryService;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [ParserFactoryService],
    }).compile();

    service = testingModule.get<ParserFactoryService>(ParserFactoryService);

    // Avoid real file I/O inside parsers. ExcelParser/CsvParser are
    // deliberately NOT mocked here: their real canParse is a pure
    // `fileType === X` check with no I/O, and leaving it real is what lets
    // the fallback-loop tests below actually exercise (and catch a
    // regression in) the Bereke `instanceof` guards instead of trivially
    // passing because every parser was forced to return false.
    jest.spyOn(BerekeNewParser.prototype, 'canParse').mockResolvedValue(false);
    jest.spyOn(BerekeOldParser.prototype, 'canParse').mockResolvedValue(false);
    jest.spyOn(KaspiParser.prototype, 'canParse').mockResolvedValue(false);
    jest.spyOn(HapoalimParser.prototype, 'canParse').mockResolvedValue(false);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getParser', () => {
    it('returns null when no parser can parse', async () => {
      const parser = await service.getParser(BankName.KASPI, FileType.PDF, '/tmp/mock.pdf');

      expect(parser).toBeNull();
    });

    it('returns first parser that can parse', async () => {
      jest.spyOn(KaspiParser.prototype, 'canParse').mockResolvedValue(true);

      const parser = await service.getParser(BankName.KASPI, FileType.PDF, '/tmp/mock.pdf');

      expect(parser).toBeInstanceOf(KaspiParser);
    });

    it('forwards cachedText into parser canParse', async () => {
      const cachedText = 'kaspi bank statement';
      const canParseSpy = jest.spyOn(KaspiParser.prototype, 'canParse').mockResolvedValue(true);

      const parser = await service.getParser(
        BankName.KASPI,
        FileType.PDF,
        '/tmp/mock.pdf',
        cachedText,
      );

      expect(parser).toBeInstanceOf(KaspiParser);
      expect(canParseSpy).toHaveBeenCalledWith(
        BankName.KASPI,
        FileType.PDF,
        '/tmp/mock.pdf',
        cachedText,
      );

      canParseSpy.mockRestore();
    });
  });

  describe('detectBankAndFormat', () => {
    it('detects Kaspi bank from PDF content', async () => {
      const result = await service.detectBankAndFormat('/tmp/mock.pdf', FileType.PDF);
      expect(result.bankName).toBe(BankName.KASPI);
    });

    it('uses cached text for PDF detection', async () => {
      const result = await service.detectBankAndFormat(
        '/tmp/mock.pdf',
        FileType.PDF,
        'kaspi bank statement',
      );

      expect(extractTextFromPdf).not.toHaveBeenCalled();
      expect(result.bankName).toBe(BankName.KASPI);
    });

    it('falls back to OTHER for non-PDF files', async () => {
      const result = await service.detectBankAndFormat('/tmp/mock.xlsx', FileType.XLSX);
      // ExcelParser/CsvParser's canParse ignores the bankName argument, so an
      // unguarded loop over every registered parser would have them "match"
      // the BEREKE_NEW/BEREKE_OLD probes and mislabel any generic XLSX/CSV.
      expect(result.bankName).toBe(BankName.OTHER);
    });

    it('does not mislabel a generic CSV as Bereke Bank', async () => {
      const result = await service.detectBankAndFormat('/tmp/mock.csv', FileType.CSV);
      expect(result.bankName).toBe(BankName.OTHER);
    });

    it('detects Bereke by header name even when body mentions Kaspi', async () => {
      (extractTextFromPdf as jest.Mock).mockResolvedValueOnce(
        [
          'Statement for account',
          'Bereke Bank',
          'Some header info',
          '01.01.2024 1000',
          'Payment to KASPI BANK for services',
        ].join('\n'),
      );

      const result = await service.detectBankAndFormat('/tmp/mock.pdf', FileType.PDF);

      expect(result.bankName).toBe(BankName.BEREKE_NEW);
      expect(result.detectedBy).toBe('header-name');
      expect(result.otherBankMentions).toContain('Kaspi Bank');
    });

    it('prefers first header match and records ambiguity when both banks appear', async () => {
      (extractTextFromPdf as jest.Mock).mockResolvedValueOnce(
        ['Kaspi Bank and Bereke Bank', 'Header line continues', '01.01.2024 2000'].join('\n'),
      );

      const result = await service.detectBankAndFormat('/tmp/mock.pdf', FileType.PDF);

      expect(result.bankName).toBe(BankName.KASPI);
      expect(result.detectedBy).toBe('header-name');
      expect(result.detectedEvidence).toEqual(
        expect.arrayContaining(['name:kaspi', 'name:bereke', 'ambiguous:header-both']),
      );
      expect(result.otherBankMentions).toContain('Bereke Bank');
    });

    it('falls back to header BIC when header lacks bank names', async () => {
      (extractTextFromPdf as jest.Mock).mockResolvedValueOnce(
        ['Statement header without bank name', 'BIC: BRKEKZKA', '01.01.2024 1000'].join('\n'),
      );

      const result = await service.detectBankAndFormat('/tmp/mock.pdf', FileType.PDF);

      expect(result.bankName).toBe(BankName.BEREKE_NEW);
      expect(result.detectedBy).toBe('header-bic');
      expect(result.detectedEvidence).toEqual(expect.arrayContaining(['bic:brkekzka']));
    });
  });

  it('initializes all required parsers', () => {
    const parserNames = service.parsers.map(p => p.constructor.name);
    expect(parserNames).toEqual([
      'BerekeNewParser',
      'BerekeOldParser',
      'KaspiParser',
      'HapoalimParser',
      'GenericPdfParser',
      'ExcelParser',
      'CsvParser',
      'DocxParser',
      'OfxParser',
      'QifParser',
      'Camt053Parser',
      'Mt940Parser',
    ]);
  });
});
