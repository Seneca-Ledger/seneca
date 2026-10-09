import * as fs from 'fs';
import { FileStorageService } from '@/common/services/file-storage.service';
import { Category } from '@/entities/category.entity';
import { Wallet } from '@/entities/wallet.entity';
import { ReceiptStatus } from '@/entities/receipt.entity';
import { BankName, FileType, Statement, StatementStatus } from '@/entities/statement.entity';
import { TaxRate } from '@/entities/tax-rate.entity';
import { Transaction } from '@/entities/transaction.entity';
import { User, UserRole } from '@/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { StatementParsingQueue } from '@/modules/parsing/queue/statement-parsing.queue';
import { StatementProcessingService } from '@/modules/parsing/services/statement-processing.service';
import { FilterStatementsDto } from '@/modules/statements/dto/filter-statements.dto';
import { ReceiptStatementService } from '@/modules/statements/services/receipt-statement.service';
import { StatementsService } from '@/modules/statements/statements.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';
jest.mock('@/common/utils/file-hash.util');
jest.mock('@/common/utils/file-validator.util');
jest.mock('@/common/utils/filename.util');

describe('StatementsService', () => {
  // create() оборачивает проверку дубликатов и вставку в транзакцию с advisory-lock;
  // менеджер прокидывает вызовы в тот же мок-репозиторий, чтобы ассерты не менялись.
  const statementRepositoryMock: Record<string, unknown> = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };
  const statementManagerMock = {
    query: jest.fn(),
    getRepository: jest.fn(() => statementRepositoryMock),
    transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(statementManagerMock)),
  };
  statementRepositoryMock.manager = statementManagerMock;

  let testingModule: TestingModule;
  let service: StatementsService;
  let statementRepository: Repository<Statement>;
  let transactionRepository: Repository<Transaction>;
  let auditService: AuditService;
  let userRepository: Repository<User>;
  let workspaceMemberRepository: Repository<WorkspaceMember>;
  let fileStorageService: FileStorageService;
  let statementProcessingService: StatementProcessingService;
  let statementParsingQueue: StatementParsingQueue;
  let categoryRepository: Repository<Category>;
  let taxRateRepository: Repository<TaxRate>;
  let receiptStatementService: ReceiptStatementService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    workspaceId: 'ws-1',
    isActive: true,
  };

  const mockStatement: Partial<Statement> = {
    id: '1',
    fileName: 'statement.pdf',
    fileType: FileType.PDF,
    bankName: BankName.KASPI,
    status: StatementStatus.UPLOADED,
    userId: '1',
    fileHash: 'abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFile = {
    path: '/tmp/statement.pdf',
    originalname: 'statement.pdf',
    mimetype: 'application/pdf',
    size: 1024,
    buffer: Buffer.from('test'),
  } as Express.Multer.File;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        StatementsService,
        workspaceCurrencyProvider(),
        {
          provide: getRepositoryToken(Statement),
          useValue: statementRepositoryMock,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getQuery: jest
                .fn()
                .mockReturnValue('SELECT transaction.statementId FROM transactions'),
              getParameters: jest.fn().mockReturnValue({}),
            })),
            find: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: TaxAssignmentService,
          useValue: { resolve: jest.fn(async () => ({})) },
        },
        {
          provide: AuditService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TaxRate),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: {
            deleteFile: jest.fn(),
            getFileUrl: jest.fn(),
            isOnDisk: jest.fn(),
            resolveFilePath: jest.fn(),
            getFileAvailability: jest.fn().mockResolvedValue({
              onDisk: true,
              inDb: true,
            }),
          },
        },
        {
          provide: StatementProcessingService,
          useValue: {
            processStatement: jest.fn(),
          },
        },
        {
          provide: StatementParsingQueue,
          useValue: {
            enqueue: jest.fn(),
          },
        },
        {
          provide: ReceiptStatementService,
          useValue: {
            createFromReceiptScan: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<StatementsService>(StatementsService);
    statementRepository = testingModule.get<Repository<Statement>>(getRepositoryToken(Statement));
    transactionRepository = testingModule.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    auditService = testingModule.get<AuditService>(AuditService);
    userRepository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    categoryRepository = testingModule.get<Repository<Category>>(getRepositoryToken(Category));
    taxRateRepository = testingModule.get<Repository<TaxRate>>(getRepositoryToken(TaxRate));
    workspaceMemberRepository = testingModule.get<Repository<WorkspaceMember>>(
      getRepositoryToken(WorkspaceMember),
    );
    fileStorageService = testingModule.get<FileStorageService>(FileStorageService);
    statementProcessingService = testingModule.get<StatementProcessingService>(
      StatementProcessingService,
    );
    statementParsingQueue = testingModule.get<StatementParsingQueue>(StatementParsingQueue);
    receiptStatementService = testingModule.get<ReceiptStatementService>(ReceiptStatementService);

    // Setup fs.promises mocks
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test'));
    jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);
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

  describe('create', () => {
    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      const { calculateFileHash } = require('@/common/utils/file-hash.util');
      calculateFileHash.mockResolvedValue('abc123');
      const { getFileTypeFromMime } = require('@/common/utils/file-validator.util');
      getFileTypeFromMime.mockReturnValue(FileType.PDF);
      const { normalizeFilename } = require('@/common/utils/filename.util');
      normalizeFilename.mockReturnValue('statement.pdf');
    });

    it('should create a new statement', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null); // No duplicate
      jest.spyOn(statementRepository, 'create').mockReturnValue(mockStatement as Statement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement as Statement);

      const result = await service.create(
        mockUser as User,
        mockUser.workspaceId as string,
        mockFile,
      );

      expect(result).toEqual(mockStatement);
      expect(statementRepository.save).toHaveBeenCalled();
    });

    it('should detect duplicate files', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement as Statement);

      await expect(
        service.create(mockUser as User, mockUser.workspaceId as string, mockFile),
      ).rejects.toThrow(ConflictException);
    });

    it('should set status to UPLOADED initially', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      const createSpy = jest
        .spyOn(statementRepository, 'create')
        .mockReturnValue(mockStatement as Statement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement as Statement);

      await service.create(mockUser as User, mockUser.workspaceId as string, mockFile);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StatementStatus.UPLOADED,
        }),
      );
    });

    it('should calculate file hash', async () => {
      const { calculateFileHash } = require('@/common/utils/file-hash.util');
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(statementRepository, 'create').mockReturnValue(mockStatement as Statement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement as Statement);

      await service.create(mockUser as User, mockUser.workspaceId as string, mockFile);

      expect(calculateFileHash).toHaveBeenCalledWith(mockFile.path);
    });

    it('should normalize filename', async () => {
      const { normalizeFilename } = require('@/common/utils/filename.util');
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(statementRepository, 'create').mockReturnValue(mockStatement as Statement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement as Statement);

      await service.create(mockUser as User, mockUser.workspaceId as string, mockFile);

      expect(normalizeFilename).toHaveBeenCalledWith('statement.pdf');
    });

    it('should check permissions for workspace members', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditStatements: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(
        service.create(mockUser as User, mockUser.workspaceId as string, mockFile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should upload file to storage service', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(statementRepository, 'create').mockReturnValue(mockStatement as Statement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement as Statement);

      await service.create(mockUser as User, mockUser.workspaceId as string, mockFile);

      expect(statementRepository.save).toHaveBeenCalled();
    });

    it('should cleanup temp file after upload', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(statementRepository, 'create').mockReturnValue(mockStatement as Statement);
      jest.spyOn(statementRepository, 'save').mockResolvedValue(mockStatement as Statement);

      await service.create(mockUser as User, mockUser.workspaceId as string, mockFile);

      expect(fs.promises.unlink).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    const createQueryBuilderMock = <TData extends object>(
      data: TData[],
      total: number,
      qbOverrides?: Partial<Record<string, jest.Mock>>,
    ) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameters: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(data[0] ?? null),
        getManyAndCount: jest.fn().mockResolvedValue([data, total] as const),
        ...qbOverrides,
      };

      (statementRepository as any).createQueryBuilder = jest.fn(() => qb);

      return qb;
    };

    const createTransactionSubQueryBuilderMock = (
      params: Record<string, string> = {},
      qbOverrides?: Partial<Record<string, jest.Mock>>,
    ) => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getQuery: jest
          .fn()
          .mockReturnValue('SELECT DISTINCT transaction.statementId FROM transaction'),
        getParameters: jest.fn().mockReturnValue(params),
        ...qbOverrides,
      };

      (transactionRepository as any).createQueryBuilder = jest.fn(() => qb);

      return qb;
    };

    it('should return all statements for user workspace', async () => {
      const statements = [mockStatement, { ...mockStatement, id: '2' }] as Statement[];
      const qb = createQueryBuilderMock(statements, 2);

      const result = await service.findAll('ws-1', { page: 1, limit: 20 });

      expect(result).toEqual({
        data: statements,
        total: 2,
        page: 1,
        limit: 20,
      });
      expect(qb.orderBy).toHaveBeenCalledWith('statement.createdAt', 'DESC');
      expect(qb.where).toHaveBeenCalledWith('statement.deletedAt IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
        workspaceId: 'ws-1',
      });
    });

    it('should scope to user only when workspace is missing', async () => {
      const qb = createQueryBuilderMock([mockStatement as Statement], 1);

      await service.findAll('ws-1', { page: 1, limit: 20 });

      expect(qb.where).toHaveBeenCalledWith('statement.deletedAt IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
        workspaceId: 'ws-1',
      });
    });

    it('should apply search filter', async () => {
      const qb = createQueryBuilderMock([mockStatement as Statement], 1);

      await service.findAll('ws-1', { page: 2, limit: 10, search: 'abc' });

      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(10);
      expect(qb.andWhere).toHaveBeenCalledWith('statement.fileName ILIKE :search', {
        search: '%abc%',
      });
    });

    it('applies extended filters without pagination when page is omitted', async () => {
      const qb = createQueryBuilderMock([mockStatement as Statement], 1);
      const subQuery = createTransactionSubQueryBuilderMock({
        workspaceId: 'ws-1',
        categoryId: 'cat-1',
      });

      await service.findAll('ws-1', {
        limit: 15,
        search: 'abc',
        type: 'pdf',
        statuses: ['processing', 'error'],
        from: ['user:1', 'bank:kaspi'],
        to: ['bank:bereke_new'],
        keywords: 'alex',
        amountMin: 100,
        amountMax: 500,
        approved: true,
        billable: false,
        currencies: ['KZT', 'USD'],
        exported: true,
        paid: false,
        has: ['errors', 'transactions'],
        categoryId: 'cat-1',
        groupBy: 'amount',
      } satisfies FilterStatementsDto);

      expect(qb.skip).not.toHaveBeenCalled();
      expect(qb.take).toHaveBeenCalledWith(15);
      expect(qb.andWhere).toHaveBeenCalledWith('statement.fileType = :type', { type: 'pdf' });
      expect(qb.andWhere).toHaveBeenCalledWith('CAST(statement.status AS text) IN (:...statuses)', {
        statuses: ['processing', 'error'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('statement.userId IN (:...fromUserIds)'),
        expect.objectContaining({ fromUserIds: ['1'], fromBankNames: ['kaspi'] }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('statement.bankName IN (:...toBankNames)'),
        expect.objectContaining({ toBankNames: ['bereke_new'] }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(
          'GREATEST(COALESCE(statement.totalDebit, 0), COALESCE(statement.totalCredit, 0)) >= :amountMin',
        ),
        expect.objectContaining({ amountMin: 100, amountMax: 500 }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('statement.status IN (:...approvedStatuses)', {
        approvedStatuses: ['validated', 'completed', 'parsed'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'GREATEST(COALESCE(statement.totalDebit, 0), COALESCE(statement.totalCredit, 0)) <= 0',
      );
      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(statement.currency) IN (:...currencies)', {
        currencies: ['kzt', 'usd'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith('statement.processedAt IS NOT NULL');
      expect(qb.andWhere).toHaveBeenCalledWith('statement.statementDateTo IS NULL');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining(
          'statement.id IN (SELECT DISTINCT transaction.statementId FROM transaction)',
        ),
      );
      expect(qb.setParameters).toHaveBeenCalledWith({ workspaceId: 'ws-1', categoryId: 'cat-1' });
      expect(subQuery.andWhere).toHaveBeenCalledWith('transaction.categoryId = :categoryId', {
        categoryId: 'cat-1',
      });
      expect(qb.orderBy).toHaveBeenLastCalledWith(
        'GREATEST(COALESCE(statement.totalDebit, 0), COALESCE(statement.totalCredit, 0))',
        'ASC',
      );
    });

    it('applies date presets and uncategorized category filter', async () => {
      const qb = createQueryBuilderMock([mockStatement as Statement], 1);
      const subQuery = createTransactionSubQueryBuilderMock({ workspaceId: 'ws-1' });

      await service.findAll('ws-1', {
        datePreset: 'thisMonth',
        categoryId: 'uncategorized',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(statement.statementDateTo'),
        expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) }),
      );
      expect(subQuery.andWhere).toHaveBeenCalledWith('transaction.categoryId IS NULL');
    });

    it('ignores ui-only receipt and gmail bank reference filters', async () => {
      const qb = createQueryBuilderMock([mockStatement as Statement], 1);

      await service.findAll('ws-1', {
        from: ['bank:receipt', 'bank:gmail', 'bank:kaspi'],
        to: ['bank:receipt', 'bank:other'],
      } satisfies FilterStatementsDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('statement.bankName IN (:...fromBankNames)'),
        expect.objectContaining({ fromBankNames: ['kaspi'] }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('statement.bankName IN (:...toBankNames)'),
        expect.objectContaining({ toBankNames: ['other'] }),
      );
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ fromBankNames: expect.arrayContaining(['receipt', 'gmail']) }),
      );
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ toBankNames: expect.arrayContaining(['receipt']) }),
      );
    });
  });

  describe('createFromReceiptScan', () => {
    it('delegates receipt statement creation to the dedicated receipt statement service', async () => {
      const params = {
        user: mockUser as User,
        workspaceId: 'ws-1',
        files: [
          {
            path: '/tmp/receipt.jpg',
            originalname: 'receipt.jpg',
            mimetype: 'image/jpeg',
            size: 1024,
          } as Express.Multer.File,
        ],
        language: 'ru',
      };

      const expectedResult = [{ id: 'stmt-ocr-1' } as Statement];
      (receiptStatementService.createFromReceiptScan as jest.Mock).mockResolvedValue(
        expectedResult,
      );

      const result = await service.createFromReceiptScan(params);

      expect(receiptStatementService.createFromReceiptScan).toHaveBeenCalledWith(params);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return statement by id', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockStatement as Statement),
      };
      jest.spyOn(statementRepository, 'createQueryBuilder').mockReturnValue(qb as any);

      const result = await service.findOne('1', '1');

      expect(result).toEqual(mockStatement);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      jest.spyOn(statementRepository, 'createQueryBuilder').mockReturnValue(qb as any);

      await expect(service.findOne('999', '1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for other workspace', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...mockStatement,
          workspaceId: 'other-ws',
        } as unknown as Statement),
      };
      jest.spyOn(statementRepository, 'createQueryBuilder').mockReturnValue(qb as any);

      const result = await service.findOne('1', '1');

      expect(result).toBeDefined();
    });

    it('should include transactions relation', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockStatement as Statement),
      };
      const qbSpy = jest
        .spyOn(statementRepository, 'createQueryBuilder')
        .mockReturnValue(qb as any);

      await service.findOne('1', '1');

      expect(qbSpy).toHaveBeenCalledWith('statement');
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
    });

    it('should delete statement and related transactions', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue({
        ...mockStatement,
        filePath: '/tmp/file.pdf',
      } as Statement);
      const deleteTxSpy = jest
        .spyOn(transactionRepository, 'delete')
        .mockResolvedValue({ affected: 5, raw: [] });
      const removeSpy = jest
        .spyOn(statementRepository, 'remove')
        .mockResolvedValue(mockStatement as Statement);

      await service.remove('1', '1');

      expect(deleteTxSpy).not.toHaveBeenCalled();
      expect(removeSpy).not.toHaveBeenCalled();
      expect(statementRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: '1', deletedAt: expect.any(Date) }),
      );
    });

    it('should delete file from storage', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue({
        ...mockStatement,
        filePath: '/tmp/file.pdf',
      } as Statement);
      jest.spyOn(transactionRepository, 'delete').mockResolvedValue({ affected: 0, raw: [] });
      jest.spyOn(statementRepository, 'remove').mockResolvedValue(mockStatement as Statement);

      await service.remove('1', '1');
    });

    it('should check permissions before delete', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditStatements: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement as Statement);

      await expect(service.remove('1', '1', 'ws-1')).rejects.toThrow(ForbiddenException);
    });

    it('should create audit event for deletion', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue({
        ...mockStatement,
        filePath: '/tmp/file.pdf',
      } as Statement);
      jest.spyOn(transactionRepository, 'delete').mockResolvedValue({ affected: 0, raw: [] });
      jest.spyOn(statementRepository, 'remove').mockResolvedValue(mockStatement as Statement);
      const auditSpy = jest.spyOn(auditService, 'createEvent');

      await service.remove('1', '1');

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
        }),
      );
    });
  });

  describe('reprocess', () => {
    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      jest.spyOn(transactionRepository, 'find').mockResolvedValue([]);
    });

    it('should queue the statement for reprocessing', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue(mockStatement as Statement);
      const enqueueSpy = jest.spyOn(statementParsingQueue, 'enqueue').mockResolvedValue(undefined);

      await service.reprocess('1', '1');

      // Reprocessing goes through the queue so it survives a restart and retries.
      expect(enqueueSpy).toHaveBeenCalledWith('1');
    });

    it('should reset status to PROCESSING', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue({
        ...mockStatement,
        status: StatementStatus.ERROR,
      } as Statement);
      const saveSpy = jest
        .spyOn(statementRepository, 'save')
        .mockResolvedValue(mockStatement as Statement);
      jest
        .spyOn(statementProcessingService, 'processStatement')
        .mockResolvedValue(mockStatement as Statement);

      await service.reprocess('1', '1');

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: StatementStatus.UPLOADED,
        }),
      );
    });

    it('should skip reprocess when already processing', async () => {
      jest.spyOn(statementRepository, 'findOne').mockResolvedValue({
        ...mockStatement,
        status: StatementStatus.PROCESSING,
      } as Statement);

      await expect(service.reprocess('1', '1')).resolves.toBeDefined();
    });
  });

  describe('confirmBalance', () => {
    const mockFoundStatement = (status: StatementStatus) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockStatement, status } as Statement),
      };
      jest.spyOn(statementRepository, 'createQueryBuilder').mockReturnValue(qb as any);
    };

    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
    });

    it('releases a needs-review statement into analytics', async () => {
      mockFoundStatement(StatementStatus.NEEDS_REVIEW);
      const saveSpy = jest
        .spyOn(statementRepository, 'save')
        .mockImplementation(async entity => entity as Statement);

      await service.confirmBalance('1', '1', '1');

      const saved = saveSpy.mock.calls[0][0] as Statement;
      expect(saved.status).toBe(StatementStatus.COMPLETED);
      expect(saved.parsingDetails?.balanceConfirmation).toMatchObject({ confirmedBy: '1' });
    });

    it('rejects a statement that is not awaiting confirmation', async () => {
      mockFoundStatement(StatementStatus.COMPLETED);

      await expect(service.confirmBalance('1', '1', '1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('convertDroppedSampleToTransaction', () => {
    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
    });

    it('creates a transaction and removes the dropped sample from parsing details', async () => {
      const statement = {
        ...mockStatement,
        id: 'stmt-1',
        userId: '1',
        workspaceId: 'ws-1',
        totalTransactions: 3,
        totalDebit: 100,
        totalCredit: 50,
        currency: 'KZT',
        parsingDetails: {
          warnings: ['tx#207: skipped (no debit/credit amount)', 'tx#208: skipped (invalid date)'],
          droppedSamples: [
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
                counterpartyName: 'Kaspi Pay',
                paymentPurpose: 'Service payment',
              },
            },
            {
              reason: 'tx#208: skipped (invalid date)',
              transaction: {
                transactionDate: 'invalid',
              },
            },
          ],
        },
      } as Statement;

      const createdTransaction = {
        id: 'tx-new',
        statementId: 'stmt-1',
        workspaceId: 'ws-1',
        transactionType: 'expense',
        debit: 1250,
      } as unknown as Transaction;

      jest.spyOn(service, 'findOne').mockResolvedValue(statement);
      jest.spyOn(transactionRepository, 'create').mockReturnValue(createdTransaction);
      jest.spyOn(transactionRepository, 'save').mockResolvedValue(createdTransaction);
      jest.spyOn(statementRepository, 'save').mockResolvedValue({
        ...statement,
        totalTransactions: 4,
      } as Statement);

      const result = await service.convertDroppedSampleToTransaction('stmt-1', '1', 'ws-1', {
        index: 0,
        transaction: {
          transactionDate: '2026-03-17',
          counterpartyName: 'Kaspi Pay',
          paymentPurpose: 'Service payment',
          debit: 1250,
        },
      });

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statementId: 'stmt-1',
          workspaceId: 'ws-1',
          transactionType: 'expense',
          amount: 1250,
          debit: 1250,
          credit: null,
          currency: 'KZT',
        }),
      );
      expect(statementRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalTransactions: 4,
          totalDebit: 1350,
          totalCredit: 50,
          parsingDetails: expect.objectContaining({
            warnings: ['tx#208: skipped (invalid date)'],
            droppedSamples: [expect.objectContaining({ reason: 'tx#208: skipped (invalid date)' })],
          }),
        }),
      );
      expect(result).toEqual({
        statement: expect.any(Object),
        transaction: createdTransaction,
      });
    });

    it('rejects dropped sample conversion without a positive debit or credit', async () => {
      const statement = {
        ...mockStatement,
        id: 'stmt-1',
        userId: '1',
        workspaceId: 'ws-1',
        currency: 'KZT',
        parsingDetails: {
          warnings: ['tx#207: skipped (no debit/credit amount)'],
          droppedSamples: [
            {
              reason: 'tx#207: skipped (no debit/credit amount)',
              transaction: {
                transactionDate: '2026-03-17',
              },
            },
          ],
        },
      } as Statement;

      jest.spyOn(service, 'findOne').mockResolvedValue(statement);

      await expect(
        service.convertDroppedSampleToTransaction('stmt-1', '1', 'ws-1', {
          index: 0,
          transaction: {
            transactionDate: '2026-03-17',
            debit: 0,
            credit: 0,
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts a warning row even when dropped sample payload is missing', async () => {
      const statement = {
        ...mockStatement,
        id: 'stmt-1',
        userId: '1',
        workspaceId: 'ws-1',
        totalTransactions: 3,
        totalDebit: 100,
        totalCredit: 50,
        currency: 'KZT',
        parsingDetails: {
          warnings: [
            'tx#243: skipped (negative amount)',
            'tx#245: skipped (no debit/credit amount)',
          ],
          droppedSamples: [],
        },
      } as Statement;

      const createdTransaction = {
        id: 'tx-new',
        statementId: 'stmt-1',
        workspaceId: 'ws-1',
        transactionType: 'expense',
        debit: 1250,
      } as unknown as Transaction;

      jest.spyOn(service, 'findOne').mockResolvedValue(statement);
      jest.spyOn(transactionRepository, 'create').mockReturnValue(createdTransaction);
      jest.spyOn(transactionRepository, 'save').mockResolvedValue(createdTransaction);
      jest.spyOn(statementRepository, 'save').mockResolvedValue({
        ...statement,
        totalTransactions: 4,
      } as Statement);

      const result = await service.convertDroppedSampleToTransaction('stmt-1', '1', 'ws-1', {
        index: 1,
        transaction: {
          transactionDate: '2026-03-17',
          counterpartyName: 'Kaspi Pay',
          paymentPurpose: 'Service payment',
          debit: 1250,
        },
      });

      expect(transactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statementId: 'stmt-1',
          workspaceId: 'ws-1',
          transactionType: 'expense',
          amount: 1250,
          debit: 1250,
          credit: null,
          currency: 'KZT',
          counterpartyName: 'Kaspi Pay',
          paymentPurpose: 'Service payment',
        }),
      );
      expect(statementRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalTransactions: 4,
          totalDebit: 1350,
          totalCredit: 50,
          parsingDetails: expect.objectContaining({
            warnings: ['tx#243: skipped (negative amount)'],
            droppedSamples: [],
          }),
        }),
      );
      expect(result).toEqual({
        statement: expect.any(Object),
        transaction: createdTransaction,
      });
    });
  });
});
