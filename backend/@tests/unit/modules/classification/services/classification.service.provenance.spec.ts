import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Branch } from '../../../../../src/entities/branch.entity';
import { CategorizationRule } from '../../../../../src/entities/categorization-rule.entity';
import { Category } from '../../../../../src/entities/category.entity';
import { PayeeOverride } from '../../../../../src/entities/payee-override.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../../../../src/entities/transaction.entity';
import { Wallet } from '../../../../../src/entities/wallet.entity';
import { Workspace } from '../../../../../src/entities/workspace.entity';
import { ApplicationSettingsService } from '../../../../../src/modules/application-settings/application-settings.service';
import { AuditService } from '../../../../../src/modules/audit/audit.service';
import { CategoriesService } from '../../../../../src/modules/categories/categories.service';
import { ClassificationService } from '../../../../../src/modules/classification/services/classification.service';

/**
 * Where a category came from, and the switches that decide which steps may run:
 * the behaviour Monarch and Copilot users complained about in 2026 — a model
 * that overrides rules and no way to turn it off.
 */
describe('ClassificationService provenance and switches', () => {
  let service: ClassificationService;
  let module: TestingModule;

  const payeeHistory = {
    rows: [] as Array<{ categoryId: string }>,
    seen: [] as string[],
  };
  const transactionRepository = {
    createQueryBuilder: jest.fn(() => {
      const builder = {
        select: () => builder,
        where: (condition: string) => {
          payeeHistory.seen.push(condition);
          return builder;
        },
        andWhere: (condition: string) => {
          payeeHistory.seen.push(condition);
          return builder;
        },
        orderBy: () => builder,
        addOrderBy: () => builder,
        take: () => builder,
        getMany: async () => payeeHistory.rows,
      };
      return builder;
    }),
  };
  const overrideRepository = { findOne: jest.fn(async () => null) };
  const workspaceRepository = { findOne: jest.fn() };
  const ruleRepository = { find: jest.fn(async () => []) };
  const categoryRepository = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    create: jest.fn(),
    save: jest.fn(),
  };
  const cache = { get: jest.fn(async () => undefined), set: jest.fn(), del: jest.fn() };
  const applicationSettings = { getAiSettingsForWorkspaceId: jest.fn(async () => null) };
  const categoriesService = { findAll: jest.fn(async () => []) };

  const tx = (overrides: Partial<Transaction> = {}): Transaction =>
    ({
      id: undefined,
      workspaceId: 'ws-1',
      counterpartyName: 'Magnum',
      paymentPurpose: 'Groceries',
      debit: 100,
      credit: null,
      amount: 100,
      transactionType: TransactionType.EXPENSE,
      ...overrides,
    }) as Transaction;

  function settings(processing: Record<string, unknown>) {
    workspaceRepository.findOne.mockResolvedValue({ id: 'ws-1', settings: { processing } });
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(PayeeOverride), useValue: overrideRepository },
        { provide: getRepositoryToken(Branch), useValue: { find: jest.fn(async () => []) } },
        {
          provide: getRepositoryToken(Wallet),
          useValue: { find: jest.fn(async () => []), findOne: jest.fn(async () => null) },
        },
        { provide: getRepositoryToken(CategorizationRule), useValue: ruleRepository },
        { provide: getRepositoryToken(Workspace), useValue: workspaceRepository },
        { provide: CACHE_MANAGER, useValue: cache },
        { provide: AuditService, useValue: { createEvent: jest.fn() } },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: ApplicationSettingsService, useValue: applicationSettings },
      ],
    }).compile();
    service = module.get(ClassificationService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(undefined);
    categoriesService.findAll.mockResolvedValue([]);
    ruleRepository.find.mockResolvedValue([]);
    payeeHistory.rows = [];
    payeeHistory.seen = [];
    overrideRepository.findOne.mockResolvedValue(null);
    settings({});
  });

  describe('category source', () => {
    it('names the rule that matched', async () => {
      jest.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Magnum is groceries',
          priority: 500,
          isActive: true,
          conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'magnum' }],
          result: { categoryId: 'cat-groceries' },
        },
      ]);

      const result = await service.classifyTransaction(tx(), 'u1');

      expect(result).toMatchObject({
        categoryId: 'cat-groceries',
        categorySource: TransactionCategorySource.RULE,
        categoryReason: 'Magnum is groceries',
      });
    });

    it('marks the uncategorised fallback as default so the model may still step in', async () => {
      jest.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([]);
      jest.spyOn(service, 'ensureCategory').mockResolvedValue('cat-none');

      const result = await service.classifyTransaction(tx({ counterpartyName: 'Zzz' }), 'u1');

      expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
      expect(result.categoryReason).toBeNull();
    });

    it('names the payee whose history decided it', async () => {
      jest.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([]);
      payeeHistory.rows = [{ categoryId: 'cat-groceries' }];

      const result = await service.classifyTransaction(tx(), 'u1');

      expect(result).toMatchObject({
        categoryId: 'cat-groceries',
        categorySource: TransactionCategorySource.HISTORY,
        categoryReason: 'Magnum',
      });
    });
  });

  describe('switches', () => {
    it('skips the model entirely when AI categorisation is off', async () => {
      settings({ aiCategorization: false });

      const result = await service.classifyTransactionsBatch(
        [
          {
            index: 0,
            counterpartyName: 'Magnum',
            paymentPurpose: 'Groceries',
            transactionType: TransactionType.EXPENSE,
          },
        ],
        'ws-1',
        'u1',
      );

      expect(result.size).toBe(0);
      expect(applicationSettings.getAiSettingsForWorkspaceId).not.toHaveBeenCalled();
    });

    it('does not read the payee history when learning is off', async () => {
      settings({ merchantLearning: false });
      payeeHistory.rows = [{ categoryId: 'cat-groceries' }];
      jest.spyOn<any, any>(service as any, 'getClassificationRules').mockResolvedValue([]);
      jest.spyOn(service, 'ensureCategory').mockResolvedValue('cat-none');

      const result = await service.classifyTransaction(tx(), 'u1');

      expect(transactionRepository.createQueryBuilder).not.toHaveBeenCalled();
      expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
    });
  });
});
