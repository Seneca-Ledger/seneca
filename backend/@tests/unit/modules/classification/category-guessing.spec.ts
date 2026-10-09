import { Branch } from '@/entities/branch.entity';
import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { Category, CategoryType } from '@/entities/category.entity';
import { PayeeOverride } from '@/entities/payee-override.entity';
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
import { fakePayeeHistory } from './fake-payee-history';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

/**
 * The engine must never guess a category from the text of a bank descriptor.
 * Every string below contains a category name as a substring or a prefix and
 * means something else entirely; a guess here is worse than no category at all,
 * because a wrong category lands in budgets and fires a false overspend alert.
 */
const WORD_COLLISIONS = [
  'ENTERPRISE RENT-A-CAR 4471',
  'TRAVELODGE LONDON',
  'SALESFORCE.COM INC',
  'DELTA INTERNET DELTA.COM ATLANTA',
  'RENTOKIL INITIAL PLC',
  'MATERIALSCIENCE GMBH',
  'PAYPAL *TAXESFREE',
  'SERVICEPLAN WERBUNG GMBH',
];

const WORKSPACE_ID = 'ws-1';
const USER_ID = 'user-1';

/** The English default category set a workspace is seeded with. */
const WORKSPACE_CATEGORY_NAMES = [
  'Advertising',
  'Equipment',
  'Insurance',
  'Interest',
  'Maintenance and repairs',
  'Materials',
  'Meals and entertainment',
  'Office supplies',
  'Payroll',
  'Professional services',
  'Rent',
  'Services',
  'Taxes',
  'Travel',
  'Utilities',
  'Vehicle expenses',
];

/**
 * An in-memory stand-in for the category table: the behaviour under test is
 * "does the engine invent a category", so creation has to be real, not a spy.
 */
class FakeCategoryRepository {
  readonly rows: Category[] = [];
  private sequence = 0;

  seed(names: string[], type: CategoryType): void {
    for (const name of names) {
      this.rows.push({
        id: `seeded-${(this.sequence += 1)}`,
        name,
        type,
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
        isEnabled: true,
      } as Category);
    }
  }

  async findOne({ where }: { where: Partial<Category> }): Promise<Category | null> {
    return (
      this.rows.find(row =>
        Object.entries(where).every(([key, value]) => row[key as keyof Category] === value),
      ) ?? null
    );
  }

  create(input: Partial<Category>): Category {
    return { ...input, id: `created-${(this.sequence += 1)}` } as Category;
  }

  async save(category: Category): Promise<Category> {
    if (!this.rows.some(row => row.id === category.id)) {
      this.rows.push(category);
    }
    return category;
  }

  async find(): Promise<Category[]> {
    return this.rows;
  }
}

describe('category guessing', () => {
  let testingModule: TestingModule;
  let service: ClassificationService;
  let categories: FakeCategoryRepository;

  const expenseTransaction = (counterpartyName: string): Transaction =>
    ({
      id: undefined,
      counterpartyName,
      paymentPurpose: '',
      debit: 42,
      credit: null,
      amount: 42,
      transactionDate: new Date('2026-10-05'),
      workspaceId: WORKSPACE_ID,
    }) as unknown as Transaction;

  beforeEach(async () => {
    categories = new FakeCategoryRepository();
    categories.seed(WORKSPACE_CATEGORY_NAMES, CategoryType.EXPENSE);

    testingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: getRepositoryToken(Category), useValue: categories },
        { provide: getRepositoryToken(Transaction), useValue: fakePayeeHistory().repository },
        { provide: getRepositoryToken(PayeeOverride), useValue: { findOne: async () => null } },
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
            findAll: async (_workspaceId: string, type: CategoryType) =>
              categories.rows.filter(row => row.type === type),
          },
        },
      ],
    }).compile();

    service = testingModule.get(ClassificationService);
  });

  afterEach(async () => {
    await testingModule.close();
  });

  it.each(WORD_COLLISIONS)('abstains on %s instead of guessing from the text', async descriptor => {
    const result = await service.classifyTransaction(expenseTransaction(descriptor), USER_ID);

    expect(result.categorySource).toBe(TransactionCategorySource.DEFAULT);
  });

  it('creates no category of its own while classifying', async () => {
    const before = categories.rows.length;

    await service.classifyTransaction(expenseTransaction('EDEKA CITY MARKT HAMBURG'), USER_ID);

    const invented = categories.rows
      .slice(before)
      .filter(row => row.type === CategoryType.EXPENSE || row.type === CategoryType.INCOME)
      .filter(row => !/^uncategoriz/i.test(row.name));

    expect(invented.map(row => row.name)).toEqual([]);
  });

  it('still honours a rule the user wrote against the raw descriptor', async () => {
    const rent = categories.rows.find(row => row.name === 'Rent');
    const rules = testingModule.get<{ find: () => Promise<CategorizationRule[]> }>(
      getRepositoryToken(CategorizationRule),
    );
    rules.find = async () =>
      [
        {
          id: 'rule-1',
          name: 'Office rent',
          conditions: [
            { field: 'counterparty_name', operator: 'contains', value: 'ENTERPRISE RENT-A-CAR' },
          ],
          result: { categoryId: rent?.id },
          priority: 100,
          isActive: true,
        },
      ] as unknown as CategorizationRule[];

    const result = await service.classifyTransaction(
      expenseTransaction('ENTERPRISE RENT-A-CAR 4471'),
      USER_ID,
    );

    expect(result.categorySource).toBe(TransactionCategorySource.RULE);
    expect(result.categoryId).toBe(rent?.id);
  });

  it('keeps the transaction type it derives from the amount columns', async () => {
    const result = await service.classifyTransaction(
      expenseTransaction('TRAVELODGE LONDON'),
      USER_ID,
    );

    expect(result.transactionType).toBe(TransactionType.EXPENSE);
  });
});
