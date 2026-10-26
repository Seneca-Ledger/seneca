import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ImportConfigService } from '../../../../../src/modules/import/config/import.config';

describe('ImportConfigService', () => {
  let service: ImportConfigService;
  let configService: ConfigService;

  const createConfigService = (overrides: Record<string, string> = {}) => {
    return {
      get: vi.fn((key: string) => overrides[key] || null),
    } as unknown as ConfigService;
  };

  describe('Default Configuration', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService(),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);
      configService = module.get<ConfigService>(ConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should load default values when env vars are not set', () => {
      const config = service.getConfig();
      expect(config.dedupDateToleranceDays).toBe(3);
      expect(config.dedupAmountTolerancePercent).toBe(2);
      expect(config.dedupTextSimilarityThreshold).toBe(0.75);
      expect(config.importAutoCommit).toBe(false);
      expect(config.importMaxRetries).toBe(3);
      expect(config.importRetryBackoffBaseMs).toBe(30000);
      expect(config.importConflictAutoResolveThreshold).toBe(0.95);
    });

    it('should provide getter methods for all config values', () => {
      expect(service.getDedupDateToleranceDays()).toBe(3);
      expect(service.getDedupAmountTolerancePercent()).toBe(2);
      expect(service.getDedupTextSimilarityThreshold()).toBe(0.75);
      expect(service.isAutoCommitEnabled()).toBe(false);
      expect(service.getMaxRetries()).toBe(3);
      expect(service.getRetryBackoffBaseMs()).toBe(30000);
      expect(service.getConflictAutoResolveThreshold()).toBe(0.95);
    });

    it('should return immutable config object', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();
      expect(config1).toBe(config2); // Same reference
    });
  });

  describe('Custom Configuration', () => {
    it('should load custom values from environment variables', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              DEDUP_DATE_TOLERANCE_DAYS: '7',
              DEDUP_AMOUNT_TOLERANCE_PERCENT: '5',
              DEDUP_TEXT_SIMILARITY_THRESHOLD: '0.85',
              IMPORT_AUTO_COMMIT: 'true',
              IMPORT_MAX_RETRIES: '5',
              IMPORT_RETRY_BACKOFF_BASE_MS: '60000',
              IMPORT_CONFLICT_AUTO_RESOLVE_THRESHOLD: '0.9',
            }),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);

      expect(service.getDedupDateToleranceDays()).toBe(7);
      expect(service.getDedupAmountTolerancePercent()).toBe(5);
      expect(service.getDedupTextSimilarityThreshold()).toBe(0.85);
      expect(service.isAutoCommitEnabled()).toBe(true);
      expect(service.getMaxRetries()).toBe(5);
      expect(service.getRetryBackoffBaseMs()).toBe(60000);
      expect(service.getConflictAutoResolveThreshold()).toBe(0.9);
    });

    it('should handle boolean values correctly', async () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'TRUE', expected: true },
        { input: 'True', expected: true },
        { input: 'false', expected: false },
        { input: 'FALSE', expected: false },
        { input: 'False', expected: false },
        { input: '0', expected: false },
        { input: '1', expected: false },
        { input: 'yes', expected: false },
      ];

      for (const testCase of testCases) {
        const module: TestingModule = await Test.createTestingModule({
          providers: [
            ImportConfigService,
            {
              provide: ConfigService,
              useValue: createConfigService({
                IMPORT_AUTO_COMMIT: testCase.input,
              }),
            },
          ],
        }).compile();

        const testService = module.get<ImportConfigService>(ImportConfigService);
        expect(testService.isAutoCommitEnabled()).toBe(testCase.expected);
      }
    });

    it('should handle decimal values correctly', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              DEDUP_TEXT_SIMILARITY_THRESHOLD: '0.8',
              IMPORT_CONFLICT_AUTO_RESOLVE_THRESHOLD: '0.99',
            }),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);

      expect(service.getDedupTextSimilarityThreshold()).toBe(0.8);
      expect(service.getConflictAutoResolveThreshold()).toBe(0.99);
    });

    it('should use defaults for invalid number values', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              DEDUP_DATE_TOLERANCE_DAYS: 'invalid',
              IMPORT_MAX_RETRIES: 'not-a-number',
            }),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);

      expect(service.getDedupDateToleranceDays()).toBe(3);
      expect(service.getMaxRetries()).toBe(3);
    });
  });

  describe('Validation', () => {
    it('should reject date tolerance days below minimum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            DEDUP_DATE_TOLERANCE_DAYS: '-1',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject date tolerance days above maximum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            DEDUP_DATE_TOLERANCE_DAYS: '31',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject amount tolerance percent below minimum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            DEDUP_AMOUNT_TOLERANCE_PERCENT: '-1',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject amount tolerance percent above maximum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            DEDUP_AMOUNT_TOLERANCE_PERCENT: '101',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject text similarity threshold below minimum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            DEDUP_TEXT_SIMILARITY_THRESHOLD: '-0.1',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject text similarity threshold above maximum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            DEDUP_TEXT_SIMILARITY_THRESHOLD: '1.1',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject max retries below minimum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            IMPORT_MAX_RETRIES: '0',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject max retries above maximum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            IMPORT_MAX_RETRIES: '11',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject backoff base ms below minimum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            IMPORT_RETRY_BACKOFF_BASE_MS: '999',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject backoff base ms above maximum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            IMPORT_RETRY_BACKOFF_BASE_MS: '300001',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject conflict auto-resolve threshold below minimum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            IMPORT_CONFLICT_AUTO_RESOLVE_THRESHOLD: '-0.1',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should reject conflict auto-resolve threshold above maximum', async () => {
      expect(() => {
        new ImportConfigService(
          createConfigService({
            IMPORT_CONFLICT_AUTO_RESOLVE_THRESHOLD: '1.1',
          }),
        );
      }).toThrow('Import configuration validation failed');
    });

    it('should accept boundary values', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              DEDUP_DATE_TOLERANCE_DAYS: '0',
              DEDUP_AMOUNT_TOLERANCE_PERCENT: '0',
              DEDUP_TEXT_SIMILARITY_THRESHOLD: '0',
              IMPORT_MAX_RETRIES: '1',
              IMPORT_RETRY_BACKOFF_BASE_MS: '1000',
              IMPORT_CONFLICT_AUTO_RESOLVE_THRESHOLD: '0',
            }),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);

      expect(service.getDedupDateToleranceDays()).toBe(0);
      expect(service.getDedupAmountTolerancePercent()).toBe(0);
      expect(service.getDedupTextSimilarityThreshold()).toBe(0);
      expect(service.getMaxRetries()).toBe(1);
      expect(service.getRetryBackoffBaseMs()).toBe(1000);
      expect(service.getConflictAutoResolveThreshold()).toBe(0);
    });

    it('should accept maximum boundary values', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              DEDUP_DATE_TOLERANCE_DAYS: '30',
              DEDUP_AMOUNT_TOLERANCE_PERCENT: '100',
              DEDUP_TEXT_SIMILARITY_THRESHOLD: '1',
              IMPORT_MAX_RETRIES: '10',
              IMPORT_RETRY_BACKOFF_BASE_MS: '300000',
              IMPORT_CONFLICT_AUTO_RESOLVE_THRESHOLD: '1',
            }),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);

      expect(service.getDedupDateToleranceDays()).toBe(30);
      expect(service.getDedupAmountTolerancePercent()).toBe(100);
      expect(service.getDedupTextSimilarityThreshold()).toBe(1);
      expect(service.getMaxRetries()).toBe(10);
      expect(service.getRetryBackoffBaseMs()).toBe(300000);
      expect(service.getConflictAutoResolveThreshold()).toBe(1);
    });
  });

  describe('Retry Backoff Calculation', () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              IMPORT_RETRY_BACKOFF_BASE_MS: '1000',
            }),
          },
        ],
      }).compile();

      service = module.get<ImportConfigService>(ImportConfigService);
    });

    it('should calculate exponential backoff correctly', () => {
      expect(service.calculateRetryBackoff(0)).toBe(1000); // 1000 * 2^0
      expect(service.calculateRetryBackoff(1)).toBe(2000); // 1000 * 2^1
      expect(service.calculateRetryBackoff(2)).toBe(4000); // 1000 * 2^2
      expect(service.calculateRetryBackoff(3)).toBe(8000); // 1000 * 2^3
      expect(service.calculateRetryBackoff(4)).toBe(16000); // 1000 * 2^4
    });

    it('should use configured base delay', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService({
              IMPORT_RETRY_BACKOFF_BASE_MS: '30000',
            }),
          },
        ],
      }).compile();

      const customService = module.get<ImportConfigService>(ImportConfigService);

      expect(customService.calculateRetryBackoff(0)).toBe(30000); // 30000 * 2^0
      expect(customService.calculateRetryBackoff(1)).toBe(60000); // 30000 * 2^1
      expect(customService.calculateRetryBackoff(2)).toBe(120000); // 30000 * 2^2
    });
  });

  describe('Integration with NestJS', () => {
    it('should be injectable in a module', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService(),
          },
        ],
      }).compile();

      const importConfigService = module.get<ImportConfigService>(ImportConfigService);
      expect(importConfigService).toBeDefined();
      expect(importConfigService).toBeInstanceOf(ImportConfigService);
    });

    it('should share singleton instance', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ImportConfigService,
          {
            provide: ConfigService,
            useValue: createConfigService(),
          },
        ],
      }).compile();

      const service1 = module.get<ImportConfigService>(ImportConfigService);
      const service2 = module.get<ImportConfigService>(ImportConfigService);
      expect(service1).toBe(service2);
    });
  });
});
