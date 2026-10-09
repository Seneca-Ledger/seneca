/**
 * Integration test — the money invariant behind split transactions.
 *
 * `TransactionsService.split()` mutates the original row into part 0 and inserts
 * N-1 siblings sharing a `split_group_id`. There is no parent row. The whole
 * feature rests on one claim: because the parts sum to the original amount and
 * inherit `statement_id`, NO money aggregate anywhere changes — which is why
 * balance, dashboard, reports and budgets needed zero changes.
 *
 * Unit tests with mocked repositories cannot prove that claim: the failure mode
 * is a real SQL aggregate double-counting or dropping rows. So this test runs the
 * real services against a real Postgres schema built by the real migrations.
 * Nothing that touches money is mocked — only the non-DB collaborators
 * (audit sink, cache, notifications, FX, classification), and every amount here
 * is KZT so the FX stub is never consulted for a conversion.
 *
 * The database is a scratch database created next to DATABASE_URL and dropped
 * afterwards, so the developer's dev data is never touched.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, type TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  Budget,
  BudgetPeriodType,
  Category,
  CategoryType,
  FileType,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Wallet,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { BalanceService } from '../../src/modules/balance/balance.service';
import { BudgetsService } from '../../src/modules/budgets/budgets.service';
import { ClassificationService } from '../../src/modules/classification/services/classification.service';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { TransactionsService } from '../../src/modules/transactions/transactions.service';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_split_invariant_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

/** Entity classes only — the barrel also re-exports enums, which are plain objects. */
const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/**
 * The real migrations, loaded by hand rather than by glob: TypeORM's glob loader
 * bypasses Jest's transform, so a `src/migrations/*.ts` pattern cannot be required
 * from inside a Jest worker.
 */
function loadMigrations(): Function[] {
  const dir = path.resolve(__dirname, '../../src/migrations');
  return fs
    .readdirSync(dir)
    .filter(file => file.endsWith('.ts'))
    .sort()
    .flatMap(file =>
      Object.values(require(path.join(dir, file))).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

/** Numbers come back from `decimal` columns as strings; normalise before comparing. */
const num = (value: unknown): number => Number(value);

describe('split() preserves every money aggregate (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let moduleRef: TestingModule;

  let transactionsService: TransactionsService;
  let balanceService: BalanceService;
  let dashboardService: DashboardService;
  let budgetsService: BudgetsService;
  let reportsService: ReportsService;

  let txRepo: Repository<Transaction>;

  let workspaceId: string;
  let userId: string;
  let statementId: string;
  let foodCategoryId: string;
  let travelCategoryId: string;
  let targetTransactionId: string;

  // Everything is dated inside the current calendar month: BudgetsService computes
  // a MONTHLY budget's period from `new Date()`, so transactions outside it would
  // score zero spending and the budget assertions would be vacuous.
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const txDate = new Date(today.getFullYear(), today.getMonth(), Math.min(today.getDate(), 28));
  const windowStart = monthStart;
  const windowEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const isoDay = (date: Date) => date.toISOString().slice(0, 10);

  /** Aggregates read straight out of the real services, in one shot. */
  type Capture = {
    balanceSheet: unknown;
    snapshot: unknown;
    budgetSpendTotal: number;
    budgetSpendByCategory: Record<string, number>;
    reportTotals: { income: number; expense: number; net: number };
    reportCategories: Array<{ name: string; amount: number }>;
  };

  async function capture(): Promise<Capture> {
    const balanceSheet = await balanceService.getBalanceSheet(workspaceId, isoDay(windowEnd));
    // getSnapshot is private but is the exact unit of money the dashboard renders;
    // reaching it directly keeps the assertion on numbers rather than on the whole
    // dashboard payload, which carries ids and timestamps that legitimately move.
    const snapshot = await (
      dashboardService as unknown as {
        getSnapshot: (w: string, since: Date, end: Date) => Promise<unknown>;
      }
    ).getSnapshot(workspaceId, windowStart, windowEnd);

    const budgets = await budgetsService.findAll(workspaceId);
    const budgetSpendByCategory: Record<string, number> = {};
    let budgetSpendTotal = 0;
    for (const budget of budgets) {
      budgetSpendByCategory[budget.name] = budget.spentAmount;
      budgetSpendTotal += budget.spentAmount;
    }

    const report = await reportsService.getTopCategoriesReport(workspaceId, {
      dateFrom: isoDay(windowStart),
      dateTo: isoDay(windowEnd),
    } as never);

    return {
      balanceSheet,
      snapshot,
      budgetSpendTotal: Math.round(budgetSpendTotal * 100) / 100,
      budgetSpendByCategory,
      reportTotals: {
        income: report.totals.income,
        expense: report.totals.expense,
        net: report.totals.net,
      },
      reportCategories: report.categories
        .map(category => ({ name: category.name, amount: category.amount }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  beforeAll(async () => {
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.query(`CREATE DATABASE ${SCRATCH_DB}`);
    await admin.end();

    dataSource = new DataSource({
      type: 'postgres',
      url: scratchUrl(SCRATCH_DB),
      entities: ENTITIES,
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const auditStub = { createEvent: jest.fn().mockResolvedValue(undefined) };
    const cacheStub = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };
    // Single-currency fixture: every row is KZT, so getRate is never reached.
    // Made to throw rather than return 1 so a silent conversion cannot hide here.
    const exchangeStub = {
      getRate: jest.fn(() => {
        throw new Error('unexpected FX conversion in a single-currency fixture');
      }),
      // The dashboard lists currencies without a rate; a KZT-only fixture has none.
      coverageForWorkspace: jest.fn(async () => []),
    };

    moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        BalanceService,
        DashboardService,
        BudgetsService,
        WorkspaceCurrencyService,
        ReportsService,
        { provide: TaxAssignmentService, useValue: { resolve: jest.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } },
        { provide: AuditService, useValue: auditStub },
        { provide: CACHE_MANAGER, useValue: cacheStub },
        { provide: ExchangeRatesService, useValue: exchangeStub },
        { provide: ClassificationService, useValue: {} },
        { provide: NotificationsService, useValue: { create: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();

    transactionsService = moduleRef.get(TransactionsService);
    balanceService = moduleRef.get(BalanceService);
    dashboardService = moduleRef.get(DashboardService);
    budgetsService = moduleRef.get(BudgetsService);
    reportsService = moduleRef.get(ReportsService);
    txRepo = dataSource.getRepository(Transaction);

    // ---- seed --------------------------------------------------------------
    const workspace = await dataSource
      .getRepository(Workspace)
      .save(dataSource.getRepository(Workspace).create({ name: 'Split WS', currency: 'KZT' }));
    workspaceId = workspace.id;

    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `split-${randomUUID()}@example.com`,
        passwordHash: 'x',
        name: 'Split Tester',
        workspaceId,
      }),
    );
    userId = user.id;

    await dataSource.getRepository(Workspace).update(workspaceId, { ownerId: userId });
    await dataSource.getRepository(WorkspaceMember).save(
      dataSource
        .getRepository(WorkspaceMember)
        .create({ workspaceId, userId, role: WorkspaceRole.OWNER }),
    );

    const wallet = await dataSource.getRepository(Wallet).save(
      dataSource.getRepository(Wallet).create({
        userId,
        workspaceId,
        name: 'Main',
        currency: 'KZT',
        initialBalance: 100000,
        isActive: true,
      }),
    );

    const statement = await dataSource.getRepository(Statement).save(
      dataSource.getRepository(Statement).create({
        userId,
        workspaceId,
        fileName: 'split.pdf',
        filePath: '/tmp/split.pdf',
        fileType: FileType.PDF,
        fileSize: 1,
        fileHash: randomUUID(),
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        currency: 'KZT',
        totalTransactions: 4,
      }),
    );
    statementId = statement.id;

    const categoryRepo = dataSource.getRepository(Category);
    const food = await categoryRepo.save(
      categoryRepo.create({ workspaceId, userId, name: 'Food', type: CategoryType.EXPENSE }),
    );
    const travel = await categoryRepo.save(
      categoryRepo.create({ workspaceId, userId, name: 'Travel', type: CategoryType.EXPENSE }),
    );
    foodCategoryId = food.id;
    travelCategoryId = travel.id;

    const expense = (
      amount: number,
      categoryId: string | null,
      counterparty: string,
    ): Partial<Transaction> => ({
      workspaceId,
      statementId,
      walletId: wallet.id,
      transactionDate: txDate,
      counterpartyName: counterparty,
      paymentPurpose: counterparty,
      transactionType: TransactionType.EXPENSE,
      amount,
      debit: amount,
      credit: null,
      currency: 'KZT',
      // Only confirmed rows count in any aggregate.
      isVerified: true,
      categoryId,
    });

    const target = await txRepo.save(txRepo.create(expense(12000, foodCategoryId, 'Grocer')));
    targetTransactionId = target.id;
    await txRepo.save(txRepo.create(expense(3000, travelCategoryId, 'Taxi')));
    await txRepo.save(txRepo.create(expense(500, null, 'Kiosk')));
    await txRepo.save(
      txRepo.create({
        workspaceId,
        statementId,
        walletId: wallet.id,
        transactionDate: txDate,
        counterpartyName: 'Employer',
        paymentPurpose: 'Salary',
        transactionType: TransactionType.INCOME,
        amount: 50000,
        debit: null,
        credit: 50000,
        currency: 'KZT',
        isVerified: true,
      }),
    );

    const budgetRepo = dataSource.getRepository(Budget);
    await budgetRepo.save(
      budgetRepo.create({
        workspaceId,
        categoryId: foodCategoryId,
        name: 'Food budget',
        limitAmount: 40000,
        currency: 'KZT',
        periodType: BudgetPeriodType.MONTHLY,
        currentPeriodStart: monthStart,
        createdById: userId,
      }),
    );
    await budgetRepo.save(
      budgetRepo.create({
        workspaceId,
        categoryId: travelCategoryId,
        name: 'Travel budget',
        limitAmount: 40000,
        currency: 'KZT',
        periodType: BudgetPeriodType.MONTHLY,
        currentPeriodStart: monthStart,
        createdById: userId,
      }),
    );
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('leaves balance, dashboard, budgets and reports totals identical across a split', async () => {
    const before = await capture();
    const rowCountBefore = await txRepo.count({ where: { workspaceId } });

    // Sanity: the fixture must actually put money where the assertions look, or a
    // passing test below would prove nothing.
    expect(before.budgetSpendTotal).toBe(15000);
    expect(before.reportTotals.expense).toBe(15500);
    expect(before.reportTotals.income).toBe(50000);

    const parts = await transactionsService.split(targetTransactionId, workspaceId, userId, {
      parts: [
        { amount: 8000, categoryId: foodCategoryId },
        { amount: 4000, categoryId: travelCategoryId },
      ],
    });
    expect(parts).toHaveLength(2);

    const after = await capture();

    // Whole-object equality: the point is to catch an aggregate nobody thought of,
    // not the three numbers we happened to predict.
    expect(after.balanceSheet).toEqual(before.balanceSheet);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.reportTotals).toEqual(before.reportTotals);
    expect(after.budgetSpendTotal).toBe(before.budgetSpendTotal);

    // The split moved money between categories, so the breakdowns MUST differ —
    // otherwise the split silently did nothing and the equalities above are trivial.
    expect(after.budgetSpendByCategory).toEqual({
      'Food budget': 8000, // the 12000 Food charge is now only its 8000 part
      'Travel budget': 7000, // the untouched 3000 Taxi plus the 4000 part
    });
    expect(after.budgetSpendByCategory).not.toEqual(before.budgetSpendByCategory);
    expect(after.reportCategories).not.toEqual(before.reportCategories);

    // One extra row exists, and it is the sibling.
    expect(await txRepo.count({ where: { workspaceId } })).toBe(rowCountBefore + 1);
  });

  it('gives every split part a non-null statementId so the dashboard innerJoin still sees it', async () => {
    // DashboardService joins `innerJoin('t.statement', 's')`. A part with a NULL
    // statement_id would vanish from every dashboard figure while still showing up
    // in reports, which leftJoin. This is the trap that check exists for.
    const group = await transactionsService.getSplitParts(targetTransactionId, workspaceId);
    expect(group).toHaveLength(2);
    for (const part of group) {
      expect(part.statementId).toBe(statementId);
      expect(part.splitGroupId).toEqual(expect.any(String));
    }
  });

  it('restores the exact pre-split row and every aggregate on unsplit', async () => {
    // Fresh group so this case does not depend on the ordering of the ones above.
    const original = await txRepo.findOneByOrFail({
      workspaceId,
      counterpartyName: 'Taxi',
    });
    const beforeRow = {
      amount: num(original.amount),
      debit: num(original.debit),
      credit: original.credit,
      transactionType: original.transactionType,
    };
    const before = await capture();
    const rowCountBefore = await txRepo.count({ where: { workspaceId } });

    // No per-part categoryId: unsplit's survivor keeps part 0's category, which is
    // a documented one-way loss when part 0 was re-categorised. Letting both parts
    // inherit the row's own category keeps this case about the money, which IS
    // meant to round-trip exactly.
    await transactionsService.split(original.id, workspaceId, userId, {
      parts: [{ amount: 1000 }, { amount: 2000 }],
    });
    await transactionsService.unsplit(original.id, workspaceId, userId);

    const restored = await txRepo.findOneByOrFail({ id: original.id });
    expect({
      amount: num(restored.amount),
      debit: num(restored.debit),
      credit: restored.credit,
      transactionType: restored.transactionType,
    }).toEqual(beforeRow);
    expect(restored.splitGroupId).toBeNull();
    expect(restored.splitIndex).toBeNull();

    expect(await txRepo.count({ where: { workspaceId } })).toBe(rowCountBefore);

    const after = await capture();
    expect(after.balanceSheet).toEqual(before.balanceSheet);
    expect(after.snapshot).toEqual(before.snapshot);
    expect(after.reportTotals).toEqual(before.reportTotals);
    expect(after.budgetSpendTotal).toBe(before.budgetSpendTotal);
    // Round trip: the per-category breakdown comes back too, because unsplit's
    // survivor is part 0, which kept the original category here.
    expect(after.budgetSpendByCategory).toEqual(before.budgetSpendByCategory);
  });
});
