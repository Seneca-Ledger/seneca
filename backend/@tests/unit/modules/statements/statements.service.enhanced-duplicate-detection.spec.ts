import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileStorageService } from '../../../../src/common/services/file-storage.service';
import { Statement } from '../../../../src/entities/statement.entity';
import { Transaction } from '../../../../src/entities/transaction.entity';
import { User } from '../../../../src/entities/user.entity';
import { WorkspaceMember } from '../../../../src/entities/workspace-member.entity';
import { Category } from '../../../../src/entities/category.entity';
import { TaxRate } from '../../../../src/entities/tax-rate.entity';
import { Wallet } from '../../../../src/entities/wallet.entity';
import { AuditService } from '../../../../src/modules/audit/audit.service';
import { StatementParsingQueue } from '../../../../src/modules/parsing/queue/statement-parsing.queue';
import { StatementProcessingService } from '../../../../src/modules/parsing/services/statement-processing.service';
import { ReceiptStatementService } from '../../../../src/modules/statements/services/receipt-statement.service';
import { StatementsService } from '../../../../src/modules/statements/statements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

// Mock the file hash calculation
jest.mock('../../../../src/common/utils/file-hash.util', () => ({
  calculateFileHash: jest.fn().mockResolvedValue('mock-file-hash-123'),
}));

jest.mock('../../../../src/common/utils/filename.util', () => ({
  normalizeFilename: jest.fn(name => name),
}));

describe('StatementsService - Enhanced Duplicate Detection', () => {
  let service: StatementsService;
  let statementRepository: Repository<Statement>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  } as User;

  const mockWorkspaceId = 'workspace-123';

  const mockFile = {
    originalname: 'test-statement.pdf',
    path: '/tmp/test-statement.pdf',
    size: 102400, // 100KB
    mimetype: 'application/pdf',
  } as Express.Multer.File;

  // create() оборачивает проверку дубликатов и вставку в транзакцию с advisory-lock;
  // менеджер прокидывает вызовы в тот же мок-репозиторий, чтобы ассерты не менялись.
  const mockStatementRepository: Record<string, jest.Mock | unknown> = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const mockManager = {
    query: jest.fn(),
    getRepository: jest.fn(() => mockStatementRepository),
    transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(mockManager)),
  };
  mockStatementRepository.manager = mockManager;

  const mockRepositories = {
    statement: mockStatementRepository,
    transaction: {},
    auditService: { createEvent: jest.fn() },
    user: {},
    category: {},
    taxRate: {},
    workspaceMember: { findOne: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatementsService,
        workspaceCurrencyProvider(),
        {
          provide: getRepositoryToken(Statement),
          useValue: mockRepositories.statement,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepositories.transaction,
        },
        {
          provide: TaxAssignmentService,
          useValue: { resolve: jest.fn(async () => ({})) },
        },
        {
          provide: AuditService,
          useValue: mockRepositories.auditService,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockRepositories.user,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockRepositories.category,
        },
        {
          provide: getRepositoryToken(TaxRate),
          useValue: mockRepositories.taxRate,
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: mockRepositories.workspaceMember,
        },
        {
          provide: FileStorageService,
          useValue: { getFileAvailability: jest.fn() },
        },
        {
          provide: StatementProcessingService,
          useValue: { processStatement: jest.fn() },
        },
        {
          provide: StatementParsingQueue,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: ReceiptStatementService,
          useValue: { createFromReceiptScan: jest.fn() },
        },
        {
          provide: 'CACHE_MANAGER',
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StatementsService>(StatementsService);
    statementRepository = module.get<Repository<Statement>>(getRepositoryToken(Statement));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create - hash-based duplicate detection', () => {
    it('should throw ConflictException with duplicateStatementId when exact hash match exists', async () => {
      const existingStatement = {
        id: 'existing-statement-id',
        fileHash: 'mock-file-hash-123',
        workspaceId: mockWorkspaceId,
      };

      mockRepositories.statement.findOne.mockResolvedValue(existingStatement);
      mockRepositories.workspaceMember.findOne.mockResolvedValue(null); // No workspace restrictions

      await expect(
        service.create(mockUser, mockWorkspaceId, mockFile, undefined, undefined, false),
      ).rejects.toThrow(ConflictException);

      try {
        await service.create(
          mockUser,
          mockWorkspaceId,
          mockFile,
          undefined,
          undefined,
          false,
        );
      } catch (error) {
        expect(error.response).toMatchObject({
          code: 'STATEMENT_DUPLICATE_FILE',
          duplicateStatementId: 'existing-statement-id',
        });
      }
    });

    it('should allow duplicate when allowDuplicates is true', async () => {
      const existingStatement = {
        id: 'existing-statement-id',
        fileHash: 'mock-file-hash-123',
      };

      mockRepositories.statement.findOne.mockResolvedValue(existingStatement);
      mockRepositories.workspaceMember.findOne.mockResolvedValue(null);

      // Mock createQueryBuilder for near-duplicate check
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRepositories.statement.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockRepositories.statement.create.mockReturnValue({
        id: 'new-statement-id',
        userId: mockUser.id,
        workspaceId: mockWorkspaceId,
      });

      mockRepositories.statement.save.mockResolvedValue({
        id: 'new-statement-id',
      });

      const result = await service.create(
        mockUser,
        mockWorkspaceId,
        mockFile,
        undefined,
        undefined,
        true, // allowDuplicates
      );

      expect(result).toBeDefined();
      expect(mockRepositories.statement.create).toHaveBeenCalled();
    });
  });

  describe('create - near-duplicate detection (name, size, time)', () => {
    it('should throw ConflictException when near-duplicate found within 5 minutes', async () => {
      // No hash duplicate
      mockRepositories.statement.findOne.mockResolvedValue(null);
      mockRepositories.workspaceMember.findOne.mockResolvedValue(null);

      const recentStatement = {
        id: 'recent-statement-id',
        fileName: 'test-statement.pdf',
        fileSize: 102400,
        createdAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        workspaceId: mockWorkspaceId,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([recentStatement]),
      };

      mockRepositories.statement.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await expect(
        service.create(mockUser, mockWorkspaceId, mockFile, undefined, undefined, false),
      ).rejects.toThrow(ConflictException);

      try {
        await service.create(
          mockUser,
          mockWorkspaceId,
          mockFile,
          undefined,
          undefined,
          false,
        );
      } catch (error) {
        expect(error.response).toMatchObject({
          code: 'STATEMENT_DUPLICATE_RECENT',
          duplicateStatementId: 'recent-statement-id',
        });
      }
    });

    it('should allow upload when similar file was uploaded more than 5 minutes ago', async () => {
      mockRepositories.statement.findOne.mockResolvedValue(null);
      mockRepositories.workspaceMember.findOne.mockResolvedValue(null);

      const oldStatement = {
        id: 'old-statement-id',
        fileName: 'test-statement.pdf',
        fileSize: 102400,
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        workspaceId: mockWorkspaceId,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // No recent duplicates
      };

      mockRepositories.statement.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockRepositories.statement.create.mockReturnValue({
        id: 'new-statement-id',
        userId: mockUser.id,
        workspaceId: mockWorkspaceId,
      });

      mockRepositories.statement.save.mockResolvedValue({
        id: 'new-statement-id',
      });

      const result = await service.create(
        mockUser,
        mockWorkspaceId,
        mockFile,
        undefined,
        undefined,
        false,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('new-statement-id');
    });

    it('should verify query checks correct time window', async () => {
      mockRepositories.statement.findOne.mockResolvedValue(null);
      mockRepositories.workspaceMember.findOne.mockResolvedValue(null);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockRepositories.statement.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockRepositories.statement.create.mockReturnValue({ id: 'new-id' });
      mockRepositories.statement.save.mockResolvedValue({ id: 'new-id' });

      await service.create(
        mockUser,
        mockWorkspaceId,
        mockFile,
        undefined,
        undefined,
        false,
      );

      // Verify the query builder was called with correct parameters
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
        workspaceId: mockWorkspaceId,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('statement.fileName = :fileName', {
        fileName: mockFile.originalname,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('statement.fileSize = :fileSize', {
        fileSize: mockFile.size,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'statement.createdAt >= :fiveMinutesAgo',
        { fiveMinutesAgo: expect.any(Date) },
      );

      // Verify the time is approximately 5 minutes ago
      const fiveMinutesAgoCall = mockQueryBuilder.andWhere.mock.calls.find(
        call => call[0] === 'statement.createdAt >= :fiveMinutesAgo',
      );
      const fiveMinutesAgoDate = fiveMinutesAgoCall[1].fiveMinutesAgo;
      const expectedTime = Date.now() - 5 * 60 * 1000;
      expect(Math.abs(fiveMinutesAgoDate.getTime() - expectedTime)).toBeLessThan(1000);
    });
  });
});
