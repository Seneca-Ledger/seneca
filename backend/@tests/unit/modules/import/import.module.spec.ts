import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportSession } from '../../../../src/entities/import-session.entity';
import { ImportConfigService } from '../../../../src/modules/import/config/import.config';

describe('ImportModule', () => {
  let module: TestingModule;
  let configService: ImportConfigService;
  let repository: Repository<ImportSession>;

  const mockRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        ImportConfigService,
        {
          provide: getRepositoryToken(ImportSession),
          useValue: mockRepository,
        },
      ],
    }).compile();

    configService = module.get<ImportConfigService>(ImportConfigService);
    repository = module.get<Repository<ImportSession>>(getRepositoryToken(ImportSession));
  });

  afterEach(async () => {
    await module.close();
    jest.clearAllMocks();
  });

  describe('Module Registration', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should provide ImportConfigService', () => {
      expect(configService).toBeDefined();
      expect(configService).toBeInstanceOf(ImportConfigService);
    });

    it('should provide ImportSession repository', () => {
      expect(repository).toBeDefined();
    });
  });

  describe('Module Exports', () => {
    it('should export ImportConfigService for use in other modules', async () => {
      const consumerModule = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [
          ImportConfigService,
          {
            provide: getRepositoryToken(ImportSession),
            useValue: {},
          },
          {
            provide: 'TestConsumer',
            useFactory: (config: ImportConfigService) => ({ config }),
            inject: [ImportConfigService],
          },
        ],
      }).compile();

      const testConsumer = consumerModule.get('TestConsumer');
      expect(testConsumer.config).toBeDefined();
      expect(testConsumer.config).toBeInstanceOf(ImportConfigService);

      await consumerModule.close();
    });
  });
});
