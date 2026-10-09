import { Branch } from '@/entities/branch.entity';
import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { Category, CategoryType } from '@/entities/category.entity';
import { PayeeOverride, PayeeOverrideMode } from '@/entities/payee-override.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import { Wallet } from '@/entities/wallet.entity';
import { Workspace } from '@/entities/workspace.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { ClassificationService } from '@/modules/classification/services/classification.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

const WORKSPACE_ID = 'ws-1';
const USER_ID = 'user-1';

const CATEGORIES = [
  { id: 'groceries', name: 'Groceries', type: CategoryType.EXPENSE, isEnabled: true },
  { id: 'gifts', name: 'Gifts', type: CategoryType.EXPENSE, isEnabled: true },
  { id: 'dining', name: 'Dining', type: CategoryType.EXPENSE, isEnabled: true },
  { id: 'uncategorized', name: 'Uncategorized', type: CategoryType.EXPENSE, isEnabled: true },
] as Category[];

/**
 * Records what the history query asked for, and answers with the rows the test
 * set up. Oldest-first is the matcher's contract, so the query has to hand
 * back the newest rows and the service has to turn them around.
 */
class FakeTransactionQuery {
  readonly conditions: string[] = [];
  constructor(private readonly rows: Array<Partial<Transaction>>) {}
  where(condition: string): this {
    this.conditions.push(condition);
    return this;
  }
  andWhere(condition: string): this {
    this.conditions.push(condition);
    return this;
  }
  orderBy(): this {
    return this;
  }
  addOrderBy(): this {
    return this;
  }
  select(): this {
    return this;
  }
  limit(): this {
    return this;
  }
  take(): this {
    return this;
  }
  async getMany(): Promise<Array<Partial<Transaction>>> {
    return this.rows;
  }
}

describe('categorising from what this payee was filed as before', () => {
  let testingModule: TestingModule;
  let service: ClassificationService;
  let query: FakeTransactionQuery;
  let overrides: { findOne: jest.Mock };

  /** Newest first, the way the query returns them. */
  const build = async (newestFirst: string[], override: Partial<PayeeOverride> | null = null) => {
    query = new FakeTransactionQuery(newestFirst.map(categoryId => ({ categoryId })));
    overrides = { findOne: jest.fn(async () => override) };

    testingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: async ({ where }: { where: { name?: string } }) =>
              CATEGORIES.find(category => category.name === where.name) ?? null,
            create: (input: Partial<Category>) => input,
            save: async (input: Category) => input,
            find: async () => CATEGORIES,
          },
        },
        { provide: getRepositoryToken(Transaction), useValue: { createQueryBuilder: () => query } },
        { provide: getRepositoryToken(PayeeOverride), useValue: overrides },
        { provide: getRepositoryToken(Branch), useValue: { find: async () => [] } },
        {
          provide: getRepositoryToken(Wallet),
          useValue: { find: async () => [], findOne: async () => null },
        },
        { provide: getRepositoryToken(CategorizationRule), useValue: { find: async () => [] } },
        { provide: getRepositoryToken(Workspace), useValue: { findOne: async () => null } },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: async () => undefined,
            set: async () => undefined,
            del: async () => undefined,
          },
        },
        { provide: AuditService, useValue: { createEvent: jest.fn() } },
        {
          provide: CategoriesService,
          useValue: {
            findAll: async (_ws: string, type: CategoryType) =>
              CATEGORIES.filter(category => category.type === type),
          },
        },
      ],
    }).compile();

    service = testingModule.get(ClassificationService);
  };

  const classify = (counterpartyName: string) =>
    service.classifyTransaction(
      {
        counterpartyName,
        paymentPurpose: '',
        debit: 20,
        credit: null,
        amount: 20,
        transactionDate: new Date('2026-10-06'),
        workspaceId: WORKSPACE_ID,
      } as unknown as Transaction,
      USER_ID,
    );

  afterEach(async () => {
    await testingModule?.close();
  });

  it('files a new row the way the payee was filed before', async () => {
    await build(['groceries', 'groceries', 'groceries']);

    const result = await classify('REWE SAGT DANKE 6334 //BERLIN/DE');

    expect(result.categoryId).toBe('groceries');
    expect(result.categorySource).toBe(TransactionCategorySource.HISTORY);
  });

  it('recognises the payee through the terminal number the bank changes every time', async () => {
    await build(['groceries', 'groceries', 'groceries']);

    const result = await classify('REWE SAGT DANKE 1182 //BERLIN/DE');

    expect(result.categoryId).toBe('groceries');
  });

  it("keeps the established category when one odd purchase interrupts it", async () => {
    // Newest first: the gift card is the most recent of the four.
    await build(['gifts', 'groceries', 'groceries', 'groceries']);

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categoryId).toBe('groceries');
  });

  it('moves to the new category once two of the three most recent agree', async () => {
    await build(['gifts', 'gifts', 'groceries', 'groceries', 'groceries']);

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categoryId).toBe('gifts');
  });

  it('uses the category pinned to this payee over its history', async () => {
    await build(['groceries', 'groceries', 'groceries'], {
      mode: PayeeOverrideMode.ALWAYS,
      categoryId: 'dining',
    });

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categoryId).toBe('dining');
    expect(result.categorySource).toBe(TransactionCategorySource.LEARNED);
  });

  it('leaves a payee the user excluded uncategorised', async () => {
    await build(['groceries', 'groceries', 'groceries'], { mode: PayeeOverrideMode.NEVER });

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
  });

  it('reads only rows a person confirmed, so its own guesses cannot teach it', async () => {
    await build(['groceries']);

    await classify('REWE SAGT DANKE 6334');

    expect(query.conditions.join(' ')).toContain('isVerified = true');
  });

  it('abstains when the descriptor holds no name to key on', async () => {
    await build(['groceries', 'groceries', 'groceries']);

    const result = await classify('1234567');

    expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
  });

  it('still lets a rule the user wrote win over the payee history', async () => {
    await build(['groceries', 'groceries', 'groceries']);
    const rules = testingModule.get<{ find: () => Promise<CategorizationRule[]> }>(
      getRepositoryToken(CategorizationRule),
    );
    rules.find = async () =>
      [
        {
          id: 'rule-1',
          name: 'Always dining',
          conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'REWE' }],
          result: { categoryId: 'dining' },
          priority: 50,
          isActive: true,
        },
      ] as unknown as CategorizationRule[];

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categorySource).toBe(TransactionCategorySource.RULE);
    expect(result.categoryId).toBe('dining');
  });

  it('keeps the transaction type it read off the amount columns', async () => {
    await build(['groceries']);

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.transactionType).toBe(TransactionType.EXPENSE);
  });
});
