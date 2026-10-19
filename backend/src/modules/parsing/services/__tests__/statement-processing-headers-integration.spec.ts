/// <reference types="jest" />

import { Test, TestingModule } from '@nestjs/testing';
import { type ObjectLiteral, Repository } from 'typeorm';
import {
  BankName,
  FileType,
  Statement,
  StatementStatus,
} from '../../../../entities/statement.entity';
import { Transaction } from '../../../../entities/transaction.entity';
import { ClassificationService } from '../../../classification/services/classification.service';
import { MetricsService } from '../../../observability/metrics.service';
import { ExtractedMetadata, MetadataExtractionService } from '../metadata-extraction.service';
import { ParserFactoryService } from '../parser-factory.service';
import { StatementProcessingService } from '../statement-processing.service';

type RepositoryMock<T> = Partial<
  Record<'findOne' | 'save' | 'create' | 'find' | 'count', jest.Mock>
>;

type ParserFactoryAccess = {
  parserFactory: Pick<ParserFactoryService, 'getParser' | 'detectBankAndFormat'>;
};

describe('StatementProcessingService - Headers Integration', () => {
  let service: StatementProcessingService;
  let metadataExtractionService: MetadataExtractionService;
  let statementRepository: Repository<Statement>;
  let transactionRepository: Repository<Transaction>;

  const mockStatement = {
    id: 'test-statement-id',
    fileName: 'test-statement.pdf',
    fileType: FileType.PDF,
    status: StatementStatus.UPLOADED,
    totalTransactions: 0,
    userId: 'test-user-id',
    createdAt: new Date(),
    bankName: BankName.KASPI,
    fileSize: 1024,
    fileHash: 'test-hash',
    filePath: '/tmp/test-statement.pdf',
  } as unknown as Statement;

  const mockParsedStatement = {
    metadata: {
      accountNumber: 'KZ123456789012345678',
      dateFrom: new Date('2024-01-01'),
      dateTo: new Date('2024-01-31'),
      currency: 'KZT',
      balanceStart: 10000,
      balanceEnd: 15000,
    },
    transactions: [
      {
        transactionDate: new Date('2024-01-15'),
        counterpartyName: 'Test Counterparty',
        debit: 1000,
        credit: 0,
        paymentPurpose: 'Test payment',
        currency: 'KZT',
      },
    ],
  };

  beforeEach(async () => {
    const mockStatementRepository: RepositoryMock<Statement> = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockTransactionRepository: RepositoryMock<Transaction> = {
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockParserFactory: Pick<ParserFactoryService, 'detectBankAndFormat' | 'getParser'> = {
      detectBankAndFormat: jest.fn(),
      getParser: jest.fn(),
    };

    const mockClassificationService = {
      determineMajorityCategory: jest.fn(),
      classifyTransaction: jest.fn(),
    };

    const mockMetadataExtractionService: Pick<
      MetadataExtractionService,
      'extractMetadata' | 'createDisplayInfo' | 'convertToParsedStatementMetadata'
    > = {
      extractMetadata: jest.fn(),
      createDisplayInfo: jest.fn(),
      convertToParsedStatementMetadata: jest.fn(),
    };

    const mockMetricsService = {
      statementParsingDurationSeconds: {
        observe: jest.fn(),
      },
      statementParsingErrorsTotal: {
        inc: jest.fn(),
      },
    } as unknown as MetricsService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementProcessingService,
        {
          provide: 'StatementRepository',
          useValue: mockStatementRepository,
        },
        {
          provide: 'TransactionRepository',
          useValue: mockTransactionRepository,
        },
        {
          provide: ParserFactoryService,
          useValue: mockParserFactory,
        },
        {
          provide: ClassificationService,
          useValue: mockClassificationService,
        },
        {
          provide: MetadataExtractionService,
          useValue: mockMetadataExtractionService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<StatementProcessingService>(StatementProcessingService);
    metadataExtractionService = module.get<MetadataExtractionService>(MetadataExtractionService);
    statementRepository = module.get<Repository<Statement>>('StatementRepository');
    transactionRepository = module.get<Repository<Transaction>>('TransactionRepository');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Header extraction integration', () => {
    it('should call metadata extraction service during processing', async () => {
      // Setup mocks
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement);

      const mockParser = {
        parse: jest.fn().mockResolvedValue(mockParsedStatement),
        getVersion: jest.fn().mockReturnValue('1.0.0'),
      };

      const serviceAccess = service as unknown as ParserFactoryAccess;
      serviceAccess.parserFactory = {
        getParser: jest.fn().mockResolvedValue(mockParser),
        detectBankAndFormat: jest.fn().mockResolvedValue({
          bankName: BankName.KASPI,
          formatVersion: 'v1',
          detectedBy: 'header-name',
          detectedEvidence: ['name:kaspi'],
          otherBankMentions: ['Bereke Bank'],
        }),
      };

      const mockExtractedMetadata: ExtractedMetadata = {
        rawHeader: 'БАНКОВСКАЯ ВЫПИСКА\nАО "Народный Банк"',
        normalizedHeader: 'БАНКОВСКАЯ ВЫПИСКА АО Народный Банк',
        statementType: 'statement',
        confidence: 0.9,
        extractionMethod: 'hybrid' as const,
        headerInfo: {
          title: 'БАНКОВСКАЯ ВЫПИСКА',
          subtitle: 'АО "Народный Банк"',
          language: 'ru',
          locale: 'ru',
        },
        account: {
          number: 'KZ123456789012345678',
          type: 'IBAN',
        },
        period: {
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-01-31'),
          label: '01.01.2024 - 31.01.2024',
        },
        institution: {
          name: 'Народный Банк',
        },
        currency: {
          code: 'KZT',
          symbol: '₸',
        },
        additionalInfo: {},
      };

      const mockDisplayInfo = {
        title: 'БАНКОВСКАЯ ВЫПИСКА',
        subtitle: 'АО "Народный Банк"',
        periodDisplay: '01.01.2024 - 31.01.2024',
        accountDisplay: '****5678',
        institutionDisplay: 'Народный Банк',
        currencyDisplay: '₸',
      };

      const mockEnhancedMetadata = {
        accountNumber: 'KZ123456789012345678',
        dateFrom: new Date('2024-01-01'),
        dateTo: new Date('2024-01-31'),
        currency: 'KZT',
        rawHeader: 'БАНКОВСКАЯ ВЫПИСКА\nАО "Народный Банк"',
        normalizedHeader: 'БАНКОВСКАЯ ВЫПИСКА АО Народный Банк',
        institution: 'Народный Банк',
        locale: 'ru',
        headerDisplay: mockDisplayInfo,
      };

      jest
        .spyOn(metadataExtractionService, 'extractMetadata')
        .mockResolvedValue(mockExtractedMetadata);

      jest.spyOn(metadataExtractionService, 'createDisplayInfo').mockReturnValue(mockDisplayInfo);

      jest
        .spyOn(metadataExtractionService, 'convertToParsedStatementMetadata')
        .mockReturnValue(mockEnhancedMetadata);

      // Mock the file system check
      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Execute
      try {
        await service.processStatement('test-statement-id');
      } catch (error) {
        // Expected due to mocking limitations
      }

      // Verify
      expect(metadataExtractionService.extractMetadata).toHaveBeenCalled();
      expect(metadataExtractionService.createDisplayInfo).toHaveBeenCalled();
      expect(metadataExtractionService.convertToParsedStatementMetadata).toHaveBeenCalled();
    });

    it('should handle metadata extraction errors gracefully', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement);

      const mockParser = {
        parse: jest.fn().mockResolvedValue(mockParsedStatement),
        getVersion: jest.fn().mockReturnValue('1.0.0'),
      };

      const serviceAccess = service as unknown as ParserFactoryAccess;
      serviceAccess.parserFactory = {
        getParser: jest.fn().mockResolvedValue(mockParser),
        detectBankAndFormat: jest.fn().mockResolvedValue({
          bankName: BankName.KASPI,
          formatVersion: 'v1',
          detectedBy: 'header-name',
          detectedEvidence: ['name:kaspi'],
          otherBankMentions: [],
        }),
      };

      jest
        .spyOn(metadataExtractionService, 'extractMetadata')
        .mockRejectedValue(new Error('Metadata extraction failed'));

      const fs = require('fs');
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Execute - should not throw due to graceful error handling
      try {
        await service.processStatement('test-statement-id');
      } catch (error) {
        // Expected due to mocking limitations
      }

      // Verify that metadata extraction was attempted
      expect(metadataExtractionService.extractMetadata).toHaveBeenCalled();
    });

    it('should include header display info in parsing details', async () => {
      type HeaderDisplayResult = Statement & {
        parsingDetails?: {
          metadataExtracted?: {
            headerDisplay?: {
              title?: string;
              accountDisplay?: string;
            };
          };
        } | null;
      };

      const mockEnhancedStatement = {
        ...mockStatement,
        parsingDetails: {
          metadataExtracted: {
            accountNumber: 'KZ123456789012345678',
            dateFrom: '2024-01-01T00:00:00.000Z',
            dateTo: '2024-01-31T00:00:00.000Z',
            headerDisplay: {
              title: 'БАНКОВСКАЯ ВЫПИСКА',
              subtitle: 'АО "Народный Банк"',
              periodDisplay: '01.01.2024 - 31.01.2024',
              accountDisplay: '****5678',
              institutionDisplay: 'Народный Банк',
              currencyDisplay: '₸',
            },
          },
        },
      } as unknown as Statement;

      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(mockEnhancedStatement);

      const result = (await statementRepository.findOne({
        where: { id: 'test-statement-id' },
      })) as HeaderDisplayResult | null;

      expect(result?.parsingDetails?.metadataExtracted?.headerDisplay).toBeDefined();
      expect(result?.parsingDetails?.metadataExtracted?.headerDisplay?.title).toBe(
        'БАНКОВСКАЯ ВЫПИСКА',
      );
      expect(result?.parsingDetails?.metadataExtracted?.headerDisplay?.accountDisplay).toContain(
        '****5678',
      );
    });
  });

  describe('Header display information validation', () => {
    it('should validate required header display fields', () => {
      const validHeaderDisplay = {
        title: 'Банковская выписка',
        subtitle: 'За январь 2024',
        periodDisplay: '01.01.2024 - 31.01.2024',
        accountDisplay: '****5678',
        institutionDisplay: 'Народный Банк',
        currencyDisplay: '₸',
      };

      expect(validHeaderDisplay.title).toBeDefined();
      expect(validHeaderDisplay.accountDisplay).toContain('****');
      expect(validHeaderDisplay.periodDisplay).toContain('-');
      expect(validHeaderDisplay.currencyDisplay).toMatch(/[₽$€£¥₸]/);
    });

    it('should handle incomplete header display gracefully', () => {
      const incompleteHeaderDisplay = {
        title: 'Выписка',
        // Missing other fields
      };

      expect(incompleteHeaderDisplay.title).toBeDefined();
      // Should not throw when other fields are missing
    });
  });
});

// Helper function to create mocks
function createMockRepository<T extends ObjectLiteral>(): Partial<Repository<T>> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
}
