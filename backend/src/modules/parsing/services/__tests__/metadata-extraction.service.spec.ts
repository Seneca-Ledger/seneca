/// <reference types="vitest/globals" />

import { Test, TestingModule } from '@nestjs/testing';
import {
  ExtractedMetadata,
  HeaderPattern,
  MetadataExtractionService,
} from '../metadata-extraction.service';

function createExtractedMetadataFixture(
  overrides: Partial<ExtractedMetadata> = {},
): ExtractedMetadata {
  return {
    rawHeader: '',
    normalizedHeader: '',
    statementType: 'statement',
    confidence: 0.9,
    extractionMethod: 'hybrid',
    period: {
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-01-31'),
      label: '01.01.2024 - 31.01.2024',
    },
    account: {
      number: 'KZ123456789012345678',
    },
    currency: {
      code: 'KZT',
    },
    institution: {
      name: 'Test Bank',
    },
    additionalInfo: {},
    ...overrides,
  };
}

describe('MetadataExtractionService', () => {
  let service: MetadataExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetadataExtractionService],
    }).compile();

    service = module.get<MetadataExtractionService>(MetadataExtractionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractMetadata', () => {
    it('should extract basic metadata from Russian statement header', async () => {
      const rawText = `
        ВЫПИСКА ПО СЧЕТУ
        АО "Народный Банк Казахстана"
        Счет: KZ123456789012345678
        Период: с 01.01.2024 по 31.01.2024
        Валюта: KZT
      `;

      const result = await service.extractMetadata(rawText, 'ru');

      expect(result).toBeDefined();
      expect(result.rawHeader).toContain('ВЫПИСКА ПО СЧЕТУ');
      expect(result.normalizedHeader).toContain('ВЫПИСКА ПО СЧЕТУ');
      expect(result.statementType).toBe('statement');
      expect(result.institution?.name).toContain('Народный Банк');
      expect(result.account?.number).toBe('KZ123456789012345678');
      expect(result.currency?.code).toBe('KZT');
      expect(result.period?.dateFrom).toBeInstanceOf(Date);
      expect(result.period?.dateTo).toBeInstanceOf(Date);
    });

    it('should extract metadata from English statement header', async () => {
      const rawText = `
        BANK STATEMENT
        JPMorgan Chase Bank
        Account: CH1234567890123456789
        Period: from 01/01/2024 to 31/01/2024
        Currency: USD
      `;

      const result = await service.extractMetadata(rawText, 'en');

      expect(result).toBeDefined();
      expect(result.statementType).toBe('statement');
      expect(result.institution?.name).toContain('JPMorgan Chase');
      expect(result.account?.number).toBe('CH1234567890123456789');
      expect(result.currency?.code).toBe('USD');
    });

    it('should handle empty or null input', async () => {
      const result = await service.extractMetadata('', 'en');

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.statementType).toBe('statement');
    });

    it('should extract account number from different patterns', async () => {
      const rawText = `
        Выписка по счету
        ИИК: KZ987654321012345678
        р/с: 12345678901234567890
      `;

      const result = await service.extractMetadata(rawText, 'ru');

      expect(result.account?.number).toBeDefined();
      expect(result.account?.number).toMatch(/KZ987654321012345678|12345678901234567890/);
    });

    it('should extract currency from symbols and codes', async () => {
      const rawText = `
        Выписка
        Валюта: $
        Сумма: 1500.00 ₽
        Итого: 100.50 EUR
      `;

      const result = await service.extractMetadata(rawText, 'ru');

      expect(result.currency).toBeDefined();
      expect(result.currency?.code).toMatch(/USD|RUB|EUR/);
    });
  });

  describe('extractHeaderInfo', () => {
    it('should extract title and subtitle from header lines', async () => {
      const rawText = `
        БАНКОВСКАЯ ВЫПИСКА ПО СЧЕТУ
        За январь 2024 года
        Данные о транзакциях...
      `;

      const result = await service.extractMetadata(rawText, 'ru');

      expect(result.headerInfo?.title).toContain('БАНКОВСКАЯ ВЫПИСКА');
      expect(result.headerInfo?.subtitle).toContain('За январь');
      expect(result.headerInfo?.documentType).toBe('statement');
      expect(result.headerInfo?.language).toBe('ru');
    });

    it('should detect language from character patterns', async () => {
      const russianText = 'Выписка по счету за период';
      const englishText = 'Bank statement for period';
      const kazakhText = 'Шот кезеңі туралы';

      const ruResult = await service.extractMetadata(russianText, 'ru');
      const enResult = await service.extractMetadata(englishText, 'en');
      const kkResult = await service.extractMetadata(kazakhText, 'kk');

      expect(ruResult.headerInfo?.language).toBe('ru');
      expect(enResult.headerInfo?.language).toBe('en');
      expect(kkResult.headerInfo?.language).toBe('kk');
    });
  });

  describe('createDisplayInfo', () => {
    it('should create formatted display information', async () => {
      const metadata = createExtractedMetadataFixture({
        account: { number: 'KZ123456789012345678', name: 'Текущий счет' },
        institution: { name: 'Народный Банк Казахстана' },
        currency: { code: 'KZT', symbol: '₸' },
        headerInfo: { title: 'Банковская выписка' },
      });

      const displayInfo = service.createDisplayInfo(metadata);

      expect(displayInfo.title).toContain('Банковская выписка');
      expect(displayInfo.accountDisplay).toContain('****5678');
      expect(displayInfo.periodDisplay).toContain('01.01.2024');
      expect(displayInfo.institutionDisplay).toContain('Народный Банк');
      expect(displayInfo.currencyDisplay).toContain('₸');
    });

    it('should mask account numbers for security', () => {
      const metadata = createExtractedMetadataFixture({
        account: { number: 'KZ123456789012345678' },
      });

      const displayInfo = service.createDisplayInfo(metadata);

      expect(displayInfo.accountDisplay).toBe('****5678');
    });
  });

  describe('convertToParsedStatementMetadata', () => {
    it('should convert extracted metadata to ParsedStatementMetadata format', async () => {
      const extractedMetadata = createExtractedMetadataFixture({
        account: { number: 'KZ123456789012345678' },
        period: {
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-01-31'),
          label: 'Январь 2024',
        },
        currency: { code: 'KZT' },
        institution: { name: 'Народный Банк' },
        rawHeader: 'Банковская выписка',
        normalizedHeader: 'Банковская выписка',
        headerInfo: { locale: 'ru' },
      });

      const converted = service.convertToParsedStatementMetadata(extractedMetadata);

      expect(converted.accountNumber).toBe('KZ123456789012345678');
      expect(converted.dateFrom).toBeInstanceOf(Date);
      expect(converted.dateTo).toBeInstanceOf(Date);
      expect(converted.currency).toBe('KZT');
      expect(converted.rawHeader).toBe('Банковская выписка');
      expect(converted.normalizedHeader).toBe('Банковская выписка');
      expect(converted.institution).toBe('Народный Банк');
      expect(converted.locale).toBe('ru');
      expect(converted.headerDisplay).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle malformed dates gracefully', async () => {
      const rawText = `
        Выписка
        Период: с 99.99.9999 по 00.00.0000
      `;

      const result = await service.extractMetadata(rawText, 'ru');

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      // Should not throw exception for invalid dates
    });

    it('should handle missing institution information', async () => {
      const rawText = `
        Выписка по счету
        Счет: 123456789
      `;

      const result = await service.extractMetadata(rawText, 'ru');

      expect(result).toBeDefined();
      expect(result.account?.number).toBe('123456789');
      // Institution should be handled gracefully
    });
  });

  describe('custom patterns and profiles', () => {
    it('should allow adding custom patterns', () => {
      const customPattern: HeaderPattern = {
        type: 'statement_type',
        patterns: [/TEST_PATTERN/gi],
        languages: ['en'],
        priority: 10,
        extractor: (match: RegExpMatchArray) => ({ type: 'statement', source: match[0] }),
      };

      expect(() => service.addCustomPattern(customPattern)).not.toThrow();
    });

    it('should allow adding institution profiles', () => {
      const customProfile = {
        name: 'Test Bank',
        patterns: ['test bank', 'тест банк'],
        defaultCurrency: 'USD',
        country: 'US',
        locale: 'en',
      };

      expect(() => service.addInstitutionProfile(customProfile)).not.toThrow();
    });
  });
});
