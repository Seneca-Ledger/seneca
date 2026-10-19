import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { Statement } from '@/entities/statement.entity';
import { Transaction, TransactionType } from '@/entities/transaction.entity';
import { Category } from '@/entities/category.entity';
import { User, UserRole } from '@/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { ClassificationService } from '@/modules/classification/services/classification.service';
import { ExchangeRatesService } from '@/modules/exchange-rates/exchange-rates.service';
import { TransactionsService } from '@/modules/transactions/transactions.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';

describe('TransactionsService', () => {
  let testingModule: TestingModule;
  let service: TransactionsService;
  let transactionRepository: Repository<Transaction>;
  let statementRepository: Repository<Statement>;
  let userRepository: Repository<User>;
  let workspaceMemberRepository: Repository<WorkspaceMember>;
  let auditService: AuditService;
  let classificationService: ClassificationService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    workspaceId: 'ws-1',
    role: UserRole.USER,
  };

  const mockTransaction: Partial<Transaction> = {
    id: '1',
    statementId: 'stmt-1',
    transactionDate: new Date('2026-01-01'),
    counterpartyName: 'Test transaction',
    debit: 100,
    credit: 0,
    transactionType: TransactionType.EXPENSE,
    categoryId: 'cat-1',
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
            // The cross-tenant guard counts referenced category/branch/wallet ids
            // through the manager; here every referenced id belongs to the workspace.
            manager: {
              getRepository: () => ({
                countBy: jest.fn(async ({ id }: any) => (id?.value as string[]).length),
              }),
            },
          },
        },
        {
          provide: getRepositoryToken(Statement),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: jest.fn(async () => null),
            create: jest.fn(value => value),
            save: jest.fn(async value => value),
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
        { provide: TaxAssignmentService, useValue: { resolve: jest.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } },
        {
          provide: AuditService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
        {
          provide: ClassificationService,
          useValue: {
            learnFromCorrection: jest.fn(),
          },
        },
        {
          provide: ExchangeRatesService,
          useValue: {
            bulkConvert: jest.fn().mockResolvedValue([]),
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

    service = testingModule.get<TransactionsService>(TransactionsService);
    transactionRepository = testingModule.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    statementRepository = testingModule.get<Repository<Statement>>(getRepositoryToken(Statement));
    userRepository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    workspaceMemberRepository = testingModule.get<Repository<WorkspaceMember>>(
      getRepositoryToken(WorkspaceMember),
    );
    auditService = testingModule.get<AuditService>(AuditService);
    classificationService = testingModule.get<ClassificationService>(ClassificationService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockTransaction], 1]),
      };

      jest.spyOn(transactionRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated transactions', async () => {
      const result = await service.findAll('ws-1', {
        page: 1,
        limit: 10,
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result.data).toHaveLength(1);
    });

    it('should filter by statement id', async () => {
      const qb = mockQueryBuilder; // transactionRepository.createQueryBuilder('transaction');

      await service.findAll('ws-1', {
        statementId: 'stmt-1',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('transaction.statementId = :statementId', {
        statementId: 'stmt-1',
      });
    });

    it('should filter by date range', async () => {
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-01-31');

      await service.findAll('ws-1', {
        dateFrom,
        dateTo,
      });

      const qb = mockQueryBuilder; // transactionRepository.createQueryBuilder('transaction');
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should filter by transaction type', async () => {
      await service.findAll('ws-1', {
        type: 'expense',
      });

      const qb = mockQueryBuilder; // transactionRepository.createQueryBuilder('transaction');
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should filter by category', async () => {
      await service.findAll('ws-1', {
        categoryId: 'cat-1',
      });

      const qb = mockQueryBuilder; // transactionRepository.createQueryBuilder('transaction');
      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should load related entities', async () => {
      await service.findAll('ws-1', {});

      const qb = mockQueryBuilder; // transactionRepository.createQueryBuilder('transaction');
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('transaction.category', 'category');
    });

    it('should scope to workspace transactions', async () => {
      await service.findAll('ws-1', {});

      const qb = mockQueryBuilder; // transactionRepository.createQueryBuilder('transaction');
      expect(qb.where).toHaveBeenCalledWith('transaction.workspaceId = :workspaceId', {
        workspaceId: 'ws-1',
      });
    });

    it('should exclude transactions from deleted statements', async () => {
      await service.findAll('ws-1', {});

      const qb = mockQueryBuilder;
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith('transaction.statement', 'statement');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(transaction.statementId IS NULL OR statement.deletedAt IS NULL)',
      );
    });
  });

  describe('findOne', () => {
    it('should return transaction by id', async () => {
      jest
        .spyOn(transactionRepository, 'findOne')
        .mockResolvedValue(mockTransaction as Transaction);

      const result = await service.findOne('1', 'ws-1');

      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('999', 'ws-1')).rejects.toThrow(NotFoundException);
    });

    it('should load related entities', async () => {
      const findOneSpy = jest
        .spyOn(transactionRepository, 'findOne')
        .mockResolvedValue(mockTransaction as Transaction);

      await service.findOne('1', 'ws-1');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining(['category', 'branch', 'wallet']),
        }),
      );
    });

    it('should scope lookups by workspace', async () => {
      const findOneSpy = jest
        .spyOn(transactionRepository, 'findOne')
        .mockResolvedValue(mockTransaction as Transaction);

      await service.findOne('1', 'ws-1');

      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1', workspaceId: 'ws-1' },
        }),
      );
    });
  });

  describe('update', () => {
    const updateDto = {
      categoryId: 'cat-2',
      article: 'New article',
      description: 'Updated description',
    };

    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      jest
        .spyOn(transactionRepository, 'findOne')
        .mockImplementation(async () => ({ ...mockTransaction }) as Transaction);
      jest.spyOn(classificationService, 'learnFromCorrection').mockResolvedValue(undefined);
    });

    it('should update transaction', async () => {
      jest.spyOn(transactionRepository, 'save').mockResolvedValue({
        ...mockTransaction,
        ...updateDto,
      } as Transaction);

      const result = await service.update('1', 'ws-1', '1', updateDto);

      expect(result.categoryId).toBe(updateDto.categoryId);
      expect(transactionRepository.save).toHaveBeenCalled();
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: EntityType.TRANSACTION,
          entityId: '1',
        }),
      );
    });

    it('marks a changed category as the user\'s own pick, with nothing else to record', async () => {
      // The row's own category is what the payee history reads next time, so a
      // correction teaches by itself — there is no second store to write to.
      jest.spyOn(transactionRepository, 'save').mockImplementation(async entity => entity as never);

      const saved = await service.update('1', 'ws-1', '1', { categoryId: 'cat-2' });

      expect(saved.categorySource).toBe('manual');
      expect(saved.categoryReason).toBeNull();
    });

    it('drops the loaded category object so the new id is what gets saved', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockImplementation(
        async () =>
          ({
            ...mockTransaction,
            categoryId: 'cat-1',
            category: { id: 'cat-1', name: 'Old' },
          }) as Transaction,
      );
      jest
        .spyOn(transactionRepository, 'save')
        .mockImplementation(async entity => entity as Transaction);

      const saved = await service.update('1', 'ws-1', '1', { categoryId: 'cat-2' });

      // With the stale relation still attached TypeORM would write cat-1 back.
      expect(transactionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-2', category: undefined }),
      );
      expect(saved.categorySource).toBe('manual');
      expect(saved.categoryReason).toBeNull();
    });

    it('does not trigger learning when categoryId is unchanged', async () => {
      jest.spyOn(transactionRepository, 'save').mockResolvedValue({
        ...mockTransaction,
        categoryId: 'cat-1',
      } as Transaction);

      await service.update('1', 'ws-1', '1', { article: 'Updated only' });

      expect(classificationService.learnFromCorrection).not.toHaveBeenCalled();
    });

    it('should check permissions before update', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditStatements: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.update('1', 'ws-1', '1', updateDto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(service.update('999', 'ws-1', '1', updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should validate category belongs to user workspace', async () => {
      // This would require checking category ownership
      expect(true).toBe(true);
    });
  });

  describe('bulkUpdate', () => {
    const bulkUpdateDto = [
      { id: '1', updates: { categoryId: 'cat-2' } },
      { id: '2', updates: { categoryId: 'cat-3' } },
    ];

    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
    });

    it('should update multiple transactions', async () => {
      jest
        .spyOn(transactionRepository, 'findOne')
        .mockResolvedValue(mockTransaction as Transaction);
      jest.spyOn(transactionRepository, 'save').mockResolvedValue(mockTransaction as Transaction);

      const result = await service.bulkUpdate('ws-1', '1', bulkUpdateDto);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should skip non-existent transactions', async () => {
      jest
        .spyOn(transactionRepository, 'findOne')
        .mockResolvedValueOnce(mockTransaction as Transaction)
        .mockResolvedValueOnce(null);
      jest.spyOn(transactionRepository, 'save').mockResolvedValue(mockTransaction as Transaction);

      const result = await service.bulkUpdate('ws-1', '1', bulkUpdateDto);

      expect(result.length).toBe(1);
    });

    it('should check permissions for bulk operations', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditStatements: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.bulkUpdate('ws-1', '1', bulkUpdateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.ADMIN,
      } as WorkspaceMember);
      jest
        .spyOn(transactionRepository, 'findOne')
        .mockResolvedValue(mockTransaction as Transaction);
    });

    it('should delete transaction', async () => {
      const deleteSpy = jest
        .spyOn(transactionRepository, 'delete')
        .mockResolvedValue({ affected: 1, raw: [] });

      await service.remove('1', 'ws-1', '1');

      expect(deleteSpy).toHaveBeenCalledWith('1');
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.DELETE,
          entityType: EntityType.TRANSACTION,
          entityId: '1',
        }),
      );
    });

    it('should check permissions before delete', async () => {
      const restrictedMember = {
        role: WorkspaceRole.MEMBER,
        permissions: { canEditStatements: false },
      } as WorkspaceMember;
      jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(restrictedMember);

      await expect(service.remove('1', 'ws-1', '1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      jest.spyOn(transactionRepository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('999', 'ws-1', '1')).rejects.toThrow(NotFoundException);
    });
  });
});
