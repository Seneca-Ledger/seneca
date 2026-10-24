import { Branch } from '@/entities/branch.entity';
import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { Category, CategoryType } from '@/entities/category.entity';
import { Payee, PayeeMode } from '@/entities/payee.entity';
import { PayeeAlias } from '@/entities/payee-alias.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '@/entities/transaction.entity';
import { Wallet } from '@/entities/wallet.entity';
import { Workspace } from '@/entities/workspace.entity';
import { AuditService } from '@/modules/audit/audit.service';
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
  let aliases: { findOne: jest.Mock };

  /** The descriptors this workspace already knows, by payee key. */
  const KNOWN_KEYS: Record<string, string> = {
    'rewe sagt danke berlin de': 'payee-rewe',
    'rewe sagt danke': 'payee-rewe',
  };

  /** Newest first, the way the query returns them. */
  const build = async (newestFirst: string[], instruction: Partial<Payee> | null = null) => {
    query = new FakeTransactionQuery(newestFirst.map(categoryId => ({ categoryId })));
    aliases = {
      findOne: jest.fn(async ({ where }: { where: { payeeKey: string } }) =>
        KNOWN_KEYS[where.payeeKey] ? { payeeId: KNOWN_KEYS[where.payeeKey] } : null,
      ),
    };
    const payees = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'payee-rewe'
          ? {
              id: 'payee-rewe',
              name: 'REWE',
              mode: instruction?.mode ?? PayeeMode.AUTO,
              categoryId: instruction?.categoryId ?? null,
            }
          : null,
      ),
    };

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
        { provide: getRepositoryToken(Payee), useValue: payees },
        { provide: getRepositoryToken(PayeeAlias), useValue: aliases },
        { provide: getRepositoryToken(Branch), useValue: { find: async () => [] } },
        {
          provide: getRepositoryToken(Wallet),
          useValue: {
            find: async () => [],
            findOne: async () => null,
            // A matched rule's targets are checked through it; here they are the workspace's.
            manager: { getRepository: () => ({ countBy: async ({ id }: any) => id.value.length }) },
          },
        },
        {
          provide: getRepositoryToken(CategorizationRule),
          useValue: { find: async () => [], update: async () => undefined },
        },
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
      mode: PayeeMode.ALWAYS,
      categoryId: 'dining',
    });

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categoryId).toBe('dining');
    expect(result.categorySource).toBe(TransactionCategorySource.LEARNED);
  });

  it('leaves a payee the user excluded uncategorised', async () => {
    await build(['groceries', 'groceries', 'groceries'], { mode: PayeeMode.NEVER });

    const result = await classify('REWE SAGT DANKE 6334');

    expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
  });

  it('reads only rows a person decided, so its own guesses cannot teach it', async () => {
    await build(['groceries']);

    await classify('REWE SAGT DANKE 6334');

    const where = query.conditions.join(' ');
    // The payee's rows, whatever descriptor each came in with: merging payees merges history.
    expect(where).toContain('transaction.payeeId = :payeeId');
    // Approved in Review, or a category picked by hand on a row still waiting.
    expect(where).toContain("(transaction.isVerified = true OR transaction.categorySource = 'manual')");
    // The importer's fallback and "Uncategorized" are not a decision about the payee.
    expect(where).toContain("transaction.categorySource <> 'default'");
    expect(where).toContain('LOWER(fallback.name) = LOWER(:uncategorizedName)');
    // Split parts describe the lines of one purchase, not the payee.
    expect(where).toContain('transaction.splitGroupId IS NULL');
  });

  it('has no history for a descriptor this workspace has never seen', async () => {
    await build(['groceries', 'groceries', 'groceries']);

    const result = await classify('EDEKA CITY MARKT 4411');

    expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
    expect(query.conditions).toHaveLength(0);
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

  describe('a payee outside a statement import (scans, emailed invoices)', () => {
    const suggest = (counterpartyName: string) =>
      service.suggestForPayee({
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        counterpartyName,
        transactionType: TransactionType.EXPENSE,
        amount: 20,
      });

    it('answers from the payee history, like a bank row', async () => {
      await build(['groceries', 'groceries']);

      await expect(suggest('REWE SAGT DANKE 6334')).resolves.toEqual({
        categoryId: 'groceries',
        source: TransactionCategorySource.HISTORY,
        reason: 'REWE',
      });
    });

    it('lets a rule the user wrote win', async () => {
      await build(['groceries']);
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

      await expect(suggest('REWE SAGT DANKE 6334')).resolves.toMatchObject({
        categoryId: 'dining',
        source: TransactionCategorySource.RULE,
      });
    });

    it('leaves a new payee for the user instead of filing it as Uncategorized', async () => {
      await build([]);

      await expect(suggest('Railway Corporation')).resolves.toBeNull();
    });
  });
});
