import { Workspace } from '@/entities/workspace.entity';
import { Branch } from '@/entities/branch.entity';
import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { Payee } from '@/entities/payee.entity';
import { PayeeAlias } from '@/entities/payee-alias.entity';
import { Category, CategorySource, CategoryType } from '@/entities/category.entity';
import { Transaction, TransactionType } from '@/entities/transaction.entity';
import { Wallet } from '@/entities/wallet.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { ClassificationService } from '@/modules/classification/services/classification.service';
import { fakePayeeHistory } from '../fake-payee-history';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

describe('ClassificationService', () => {
  let testingModule: TestingModule;
  let service: ClassificationService;
  let categoryRepository: Repository<Category>;
  let categorizationRuleRepository: Repository<CategorizationRule>;
  let branchRepository: Repository<Branch>;
  let walletRepository: Repository<Wallet>;
  let auditService: AuditService;

  const mockCategory: Partial<Category> = {
    id: 'cat-1',
    name: 'Groceries',
    type: CategoryType.EXPENSE,
    userId: '1',
  };

  const mockBranch: Partial<Branch> = {
    id: 'branch-1',
    name: 'Main Branch',
    userId: '1',
  };

  const mockWallet: Partial<Wallet> = {
    id: 'wallet-1',
    name: 'Personal Card',
    userId: '1',
  };

  const mockTransaction: Partial<Transaction> = {
    id: 'tx-1',
    counterpartyName: 'Purchase at Supermarket ABC',
    debit: 150,
    credit: 0,
    transactionDate: new Date('2026-01-01'),
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: fakePayeeHistory().repository,
        },
        {
          provide: getRepositoryToken(Payee),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(PayeeAlias),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(Branch),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            // A matched rule's targets are checked through it; here they are the workspace's.
            manager: { getRepository: () => ({ countBy: async ({ id }: any) => id.value.length }) },
          },
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(CategorizationRule),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
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
          provide: AuditService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<ClassificationService>(ClassificationService);
    categoryRepository = testingModule.get<Repository<Category>>(getRepositoryToken(Category));
    categorizationRuleRepository = testingModule.get<Repository<CategorizationRule>>(
      getRepositoryToken(CategorizationRule),
    );
    branchRepository = testingModule.get<Repository<Branch>>(getRepositoryToken(Branch));
    walletRepository = testingModule.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    auditService = testingModule.get<AuditService>(AuditService);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(branchRepository, 'find').mockResolvedValue([]);
    jest.spyOn(walletRepository, 'find').mockResolvedValue([]);
    jest.spyOn(categorizationRuleRepository, 'find').mockResolvedValue([]);
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('classifyTransaction', () => {
    let autoCategorySpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([mockCategory as Category]);
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue({
        ...mockCategory,
        id: 'cat-1',
      } as Category);
      jest.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([]);
      autoCategorySpy = jest
        .spyOn<any, any>(service as any, 'autoClassifyCategory')
        .mockResolvedValue({ categoryId: 'cat-1', source: 'keyword', reason: null });
    });

    it('should determine transaction type from debit', async () => {
      const transaction = { ...mockTransaction, debit: 100, credit: 0 };
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([]);

      const result = await service.classifyTransaction(transaction as Transaction, '1');

      expect(result.transactionType).toBe(TransactionType.EXPENSE);
    });

    it('should determine transaction type from credit', async () => {
      const transaction = { ...mockTransaction, debit: 0, credit: 200 };
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([]);

      const result = await service.classifyTransaction(transaction as Transaction, '1');

      expect(result.transactionType).toBe(TransactionType.INCOME);
    });

    it('should auto-classify category based on description', async () => {
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([mockCategory as Category]);

      const result = await service.classifyTransaction(mockTransaction as Transaction, '1');

      expect(result.categoryId).toBeDefined();
      expect(autoCategorySpy).toHaveBeenCalled();
    });

    it('does not reuse cached classification for temp transactions without id', async () => {
      autoCategorySpy.mockResolvedValueOnce({ categoryId: 'cat-expense', source: 'keyword', reason: null }).mockResolvedValueOnce({ categoryId: 'cat-income', source: 'keyword', reason: null });

      const expenseResult = await service.classifyTransaction(
        {
          ...mockTransaction,
          id: undefined as any,
          debit: 100,
          credit: null,
          paymentPurpose: 'Оплата аренды',
        } as Transaction,
        '1',
      );

      const incomeResult = await service.classifyTransaction(
        {
          ...mockTransaction,
          id: undefined as any,
          debit: null,
          credit: 500,
          paymentPurpose: 'Продажи с Kaspi',
        } as Transaction,
        '1',
      );

      expect(expenseResult.categoryId).toBe('cat-expense');
      expect(incomeResult.categoryId).toBe('cat-income');
      expect(autoCategorySpy).toHaveBeenCalledTimes(2);
    });

    it('should match transactions by keywords', async () => {
      const groceryTransaction = {
        ...mockTransaction,
        description: 'WALMART SUPERCENTER',
      };
      const groceryCategory = {
        ...mockCategory,
        name: 'Groceries',
        keywords: ['walmart', 'supermarket', 'grocery'],
      };

      jest.spyOn(categoryRepository, 'find').mockResolvedValue([groceryCategory as Category]);

      const result = await service.classifyTransaction(groceryTransaction as Transaction, '1');

      expect(result.categoryId).toBeDefined();
    });

    it('should handle transactions without matches', async () => {
      jest.spyOn(categoryRepository, 'find').mockResolvedValue([]);

      const result = await service.classifyTransaction(mockTransaction as Transaction, '1');

      expect(result).toBeDefined();
      expect(result.categoryId).toBeDefined();
    });

    it('should emit audit event when rule matched', async () => {
      jest.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Test Rule',
          conditions: [{ field: 'payment_purpose', operator: 'contains', value: 'Purchase' }],
          result: { categoryId: 'cat-1' },
          priority: 100,
          isActive: true,
        },
      ]);

      const transaction = {
        ...mockTransaction,
        paymentPurpose: 'Purchase at store',
        workspaceId: 'ws-1',
      } as Transaction;

      await service.classifyTransaction(transaction, '1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'apply_rule',
          entityId: 'tx-1',
          meta: expect.objectContaining({ ruleId: 'rule-1' }),
        }),
      );
    });

    it('should respect user-specific categories', async () => {
      await service.classifyTransaction(mockTransaction as Transaction, '1');

      expect(autoCategorySpy).toHaveBeenCalledWith(
        expect.any(Object),
        '1',
        TransactionType.EXPENSE,
        null,
      );
    });

    it('should classify by transaction amount range', async () => {
      const highValueCategory = {
        ...mockCategory,
        name: 'Large Expenses',
        minAmount: 1000,
      };

      jest.spyOn(categoryRepository, 'find').mockResolvedValue([highValueCategory as Category]);

      const highValueTx = { ...mockTransaction, debit: 1500 };

      const result = await service.classifyTransaction(highValueTx as Transaction, '1');

      expect(result.categoryId).toBeDefined();
    });

    it('should handle special characters in description', async () => {
      const specialTx = {
        ...mockTransaction,
        description: 'Purchase@Store#123!',
      };

      jest.spyOn(categoryRepository, 'find').mockResolvedValue([mockCategory as Category]);

      const result = await service.classifyTransaction(specialTx as Transaction, '1');

      expect(result).toBeDefined();
    });
  });

  describe('workspace-scoped classification', () => {
    it('loads user rules scoped to workspace when workspaceId is provided', async () => {
      const findSpy = jest.spyOn(categorizationRuleRepository, 'find').mockResolvedValue([]);
      jest.spyOn(categoryRepository, 'findOne').mockResolvedValue(mockCategory as Category);

      await (service as any).getClassificationRules('1', 'ws-1');

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: '1',
            workspaceId: 'ws-1',
            isActive: true,
          }),
        }),
      );
    });

    it('hands the row to the person a rule names, over the wallet it landed in', async () => {
      // A rule is an instruction; the wallet is only a default.
      jest.spyOn(categorizationRuleRepository, 'find').mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Her Amazon',
          conditions: [
            { field: 'counterparty_name', operator: 'contains', value: 'Supermarket' },
          ],
          result: { ownerMemberId: 'member-partner' },
          priority: 10,
          isActive: true,
        },
      ] as never);
      jest.spyOn(walletRepository, 'find').mockResolvedValue([]);
      jest
        .spyOn(walletRepository, 'findOne')
        .mockImplementation(async (options: Record<string, any>) =>
          options?.select?.ownerMemberId
            ? ({ ownerMemberId: 'member-self' } as Wallet)
            : ({ id: 'wallet-1' } as Wallet),
        );
      jest.spyOn(branchRepository, 'find').mockResolvedValue([]);

      const result = await service.classifyTransaction(
        {
          ...mockTransaction,
          id: undefined,
          workspaceId: 'ws-1',
          counterpartyAccount: 'KZ00',
        } as unknown as Transaction,
        '1',
      );

      expect(result.ownerMemberId).toBe('member-partner');
    });

    it('matches a rule on who owns the row, with "shared" standing for nobody', async () => {
      jest.spyOn(categorizationRuleRepository, 'find').mockResolvedValue([
        {
          id: 'rule-2',
          name: 'Household groceries',
          conditions: [{ field: 'owner', operator: 'equals', value: 'shared' }],
          result: { categoryId: 'cat-household' },
          priority: 10,
          isActive: true,
        },
      ] as never);
      jest.spyOn(walletRepository, 'find').mockResolvedValue([]);
      jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(branchRepository, 'find').mockResolvedValue([]);

      const unclaimed = await service.classifyTransaction(
        { ...mockTransaction, id: undefined, workspaceId: 'ws-1' } as unknown as Transaction,
        '1',
      );
      expect(unclaimed.categoryId).toBe('cat-household');

      const someonesOwn = await service.classifyTransaction(
        {
          ...mockTransaction,
          id: undefined,
          workspaceId: 'ws-1',
          ownerMemberId: 'member-partner',
        } as unknown as Transaction,
        '1',
      );
      expect(someonesOwn.categoryId).not.toBe('cat-household');
    });

    it('starts a new row on whoever owns the wallet it landed in', async () => {
      // Classification is the one place that decides the wallet, so it is also
      // where the person comes from — otherwise every import path would need
      // its own copy of the rule.
      jest.spyOn(walletRepository, 'find').mockResolvedValue([]);
      jest
        .spyOn(walletRepository, 'findOne')
        .mockImplementation(async (options: Record<string, any>) =>
          options?.select?.ownerMemberId
            ? ({ ownerMemberId: 'member-partner' } as Wallet)
            : ({ id: 'wallet-1' } as Wallet),
        );
      jest.spyOn(branchRepository, 'find').mockResolvedValue([]);

      const result = await service.classifyTransaction(
        {
          ...mockTransaction,
          workspaceId: 'ws-1',
          counterpartyAccount: 'KZ00',
        } as Transaction,
        '1',
      );

      expect(result.walletId).toBe('wallet-1');
      expect(result.ownerMemberId).toBe('member-partner');
    });

    it('leaves the row shared when the wallet is shared', async () => {
      jest.spyOn(walletRepository, 'find').mockResolvedValue([]);
      jest
        .spyOn(walletRepository, 'findOne')
        .mockImplementation(async (options: Record<string, any>) =>
          options?.select?.ownerMemberId
            ? ({ ownerMemberId: null } as Wallet)
            : ({ id: 'wallet-1' } as Wallet),
        );
      jest.spyOn(branchRepository, 'find').mockResolvedValue([]);

      const result = await service.classifyTransaction(
        {
          ...mockTransaction,
          workspaceId: 'ws-1',
          counterpartyAccount: 'KZ00',
        } as Transaction,
        '1',
      );

      expect(result.ownerMemberId).toBeNull();
    });

    it('picks wallets and branches of the transaction’s workspace', async () => {
      const walletFind = jest.spyOn(walletRepository, 'find').mockResolvedValue([]);
      const walletFindOne = jest.spyOn(walletRepository, 'findOne').mockResolvedValue(null);
      const branchFind = jest.spyOn(branchRepository, 'find').mockResolvedValue([]);
      const transaction = {
        ...mockTransaction,
        workspaceId: 'ws-1',
        counterpartyAccount: 'KZ00',
      } as Transaction;

      await (service as any).autoDetermineWallet(transaction, '1', 'ws-1');
      await (service as any).autoDetermineBranch(transaction, '1', 'ws-1');

      expect(walletFindOne).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', accountNumber: 'KZ00' },
      });
      expect(walletFind).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1' } });
      expect(branchFind).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: 'ws-1' } }),
      );
    });
  });

  describe('ensureCategory', () => {
    it('creates a workspace parsing category instead of reusing a legacy user category', async () => {
      jest
        .spyOn(categoryRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'legacy-cat',
          name: 'Rent',
          type: CategoryType.EXPENSE,
          userId: '1',
          workspaceId: null,
          source: CategorySource.USER,
        } as Category);

      const createSpy = jest.spyOn(categoryRepository, 'create').mockImplementation(
        (data: Partial<Category>) =>
          ({
            id: 'workspace-cat',
            ...data,
          }) as Category,
      );
      jest.spyOn(categoryRepository, 'save').mockImplementation(async category => category as Category);

      const result = await (service as any).ensureCategory(
        '1',
        'Rent',
        CategoryType.EXPENSE,
        '#123456',
        'ws-1',
      );

      expect(result).toBe('workspace-cat');
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '1',
          workspaceId: 'ws-1',
          name: 'Rent',
          type: CategoryType.EXPENSE,
          isSystem: false,
          color: '#123456',
          source: CategorySource.PARSING,
        }),
      );
    });

    it('takes the category a parallel import created first instead of failing', async () => {
      jest
        .spyOn(categoryRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'created-in-parallel' } as Category);
      jest.spyOn(categoryRepository, 'create').mockImplementation(data => data as Category);
      jest
        .spyOn(categoryRepository, 'save')
        .mockRejectedValue(Object.assign(new Error('duplicate key'), { code: '23505' }));

      const result = await (service as any).ensureCategory(
        '1',
        'Uncategorized',
        CategoryType.EXPENSE,
        undefined,
        'ws-1',
      );

      expect(result).toBe('created-in-parallel');
    });
  });
});
