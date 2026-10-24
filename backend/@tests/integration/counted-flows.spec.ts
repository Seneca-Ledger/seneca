/**
 * Integration test — one rule for income and spending, against a real Postgres.
 *
 * Every figure of money in and out (dashboard, reports, forecast, budgets) must
 * count the same rows: confirmed ones of this workspace, from a statement or not
 * (a cash payment, an approved receipt), never a duplicate, a row on a trashed or
 * failed statement, or a transfer between own accounts. A crypto row counts only
 * when it settles a bill or a receivable: a swap or a move between own wallets is
 * not money earned or spent. Seeding one set of rows and asking each service is
 * the only way to see that they agree; the decisions are made in SQL.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  Category,
  CategoryType,
  CryptoWallet,
  FileType,
  Payable,
  PayableDirection,
  PayablePayment,
  PayableStatus,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Wallet,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { BalanceService } from '../../src/modules/balance/balance.service';
import { BudgetsService } from '../../src/modules/budgets/budgets.service';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { ForecastService } from '../../src/modules/forecast/forecast.service';
import { GoalsService } from '../../src/modules/goals/goals.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { CashFlowMapService } from '../../src/modules/reports/cash-flow-map.service';
import { BudgetVsActualReport } from '../../src/modules/reports/budget-vs-actual.report';
import { HoldingsSnapshotReport } from '../../src/modules/reports/holdings-snapshot.report';
import { ReportsService } from '../../src/modules/reports/reports.service';
import { SpendFlowService } from '../../src/modules/reports/spend-flow.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { TaxReserveService } from '../../src/modules/tax/tax-reserve.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_counted_flows_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded by hand: TypeORM's glob loader bypasses Jest's transform. */
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

const pad = (value: number) => String(value).padStart(2, '0');
const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Every row sits in the middle of last month: inside a month report, and inside
// the forecast's history, which reads whole months before this one.
const now = new Date();
const MONTH_START = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const MONTH_END = new Date(now.getFullYear(), now.getMonth(), 0);
const DAY = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 15));

/** What the seeded rows must add up to, wherever they are summed. */
const INCOME = 1000 + 150 + 40;
const EXPENSE = 200 + 60;

describe('one rule for income and spending (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  let groceriesId: string;
  let salaryId: string;
  let dashboard: DashboardService;
  let cashFlowMap: CashFlowMapService;
  let reports: ReportsService;
  let spendFlow: SpendFlowService;
  let forecast: ForecastService;
  let budgets: BudgetsService;

  const statement = async (status: StatementStatus, deletedAt: Date | null = null) =>
    (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: `${status}.pdf`,
          filePath: `/tmp/${randomUUID()}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status,
          accountNumber: 'DE00 1',
          currency: 'EUR',
          deletedAt,
        }),
      )
    ).id;

  const row = (fields: Partial<Transaction>) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date(DAY),
        counterpartyName: 'Someone',
        paymentPurpose: 'Payment',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        isVerified: true,
        ...fields,
      }),
    );

  const income = (amount: number, fields: Partial<Transaction> = {}) =>
    row({
      transactionType: TransactionType.INCOME,
      amount,
      credit: amount,
      debit: null,
      categoryId: salaryId,
      ...fields,
    });
  const expense = (amount: number, fields: Partial<Transaction> = {}) =>
    row({ amount, debit: amount, credit: null, categoryId: groceriesId, ...fields });

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

    // One currency throughout, so nothing here depends on a rate.
    const rates = {
      getRate: jest.fn(async () => 1),
      getRateOrNull: jest.fn(async () => 1),
      convert: jest.fn(async (amount: number) => amount),
      coverageForWorkspace: jest.fn(async () => []),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        CashFlowMapService,
        ReportsService,
        SpendFlowService,
        ForecastService,
        BudgetsService,
        WorkspaceCurrencyService,
        { provide: ExchangeRatesService, useValue: rates },
        { provide: GoalsService, useValue: { findAll: jest.fn(async () => []) } },
        {
          provide: SubscriptionsService,
          useValue: { getSummary: jest.fn(async () => ({ totalMonthlyCost: 0 })) },
        },
        { provide: TaxReserveService, useValue: { getReserve: jest.fn(async () => null) } },
        { provide: BalanceService, useValue: {} },
        // Template reports this suite does not read.
        { provide: BudgetVsActualReport, useValue: {} },
        { provide: HoldingsSnapshotReport, useValue: {} },
        { provide: AuditService, useValue: { createEvent: jest.fn() } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    dashboard = moduleRef.get(DashboardService);
    cashFlowMap = moduleRef.get(CashFlowMapService);
    reports = moduleRef.get(ReportsService);
    spendFlow = moduleRef.get(SpendFlowService);
    forecast = moduleRef.get(ForecastService);
    budgets = moduleRef.get(BudgetsService);
    txRepo = dataSource.getRepository(Transaction);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Flows WS', currency: 'EUR' })).id;
    const otherWorkspaceId = (await workspaces.save({ name: 'Other WS', currency: 'EUR' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `flows-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Flows Tester',
          workspaceId,
        }),
      )
    ).id;
    const categories = dataSource.getRepository(Category);
    groceriesId = (
      await categories.save({ workspaceId, userId, name: 'Groceries', type: CategoryType.EXPENSE })
    ).id;
    salaryId = (
      await categories.save({ workspaceId, userId, name: 'Salary', type: CategoryType.INCOME })
    ).id;
    const walletId = (
      await dataSource
        .getRepository(Wallet)
        .save({ userId, workspaceId, name: 'Cash', currency: 'EUR' })
    ).id;
    const cryptoWalletId = (
      await dataSource
        .getRepository(CryptoWallet)
        .save({ workspaceId, address: '0xabc', label: 'Ledger' })
    ).id;

    const bank = await statement(StatementStatus.COMPLETED);
    const trashed = await statement(StatementStatus.COMPLETED, new Date());
    const failed = await statement(StatementStatus.ERROR);

    // Counted.
    await income(1000, { statementId: bank });
    await expense(200, { statementId: bank });
    await income(150, { walletId }); // a cash payment: no statement
    await expense(60, { walletId });
    const settling = await income(40, { cryptoWalletId, cryptoAsset: 'USDT' });

    // Not counted.
    await expense(999, { statementId: bank, isVerified: false });
    await income(500, { statementId: trashed });
    await expense(300, { statementId: failed });
    await expense(80, { statementId: bank, isDuplicate: true });
    await expense(500, { statementId: bank, transferPairId: randomUUID() });
    await income(70, { cryptoWalletId, cryptoAsset: 'ETH' }); // a swap leg
    await expense(25, { cryptoWalletId, cryptoAsset: 'USDT' });
    await txRepo.save(
      txRepo.create({
        workspaceId: otherWorkspaceId,
        transactionDate: new Date(DAY),
        counterpartyName: 'Elsewhere',
        paymentPurpose: 'Not ours',
        currency: 'EUR',
        transactionType: TransactionType.INCOME,
        amount: 10_000,
        credit: 10_000,
        isVerified: true,
      }),
    );

    // The crypto income above is what a customer paid a receivable with.
    const receivable = await dataSource.getRepository(Payable).save(
      dataSource.getRepository(Payable).create({
        workspaceId,
        createdById: userId,
        vendor: 'Customer',
        amount: 40,
        paidAmount: 40,
        currency: 'EUR',
        direction: PayableDirection.RECEIVABLE,
        status: PayableStatus.PAID,
        linkedTransactionId: settling.id,
      }),
    );
    await dataSource.getRepository(PayablePayment).save({
      payableId: receivable.id,
      workspaceId,
      amount: 40,
      paidOn: DAY,
      transactionId: settling.id,
    });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const range = { dateFrom: isoDay(MONTH_START), dateTo: isoDay(MONTH_END) };

  it('the dashboard month', async () => {
    const result = await dashboard.getDashboard(userId, workspaceId, 'month', DAY);
    expect(result.snapshot.income30d).toBe(INCOME);
    expect(result.snapshot.expense30d).toBe(EXPENSE);
  });

  it('the dashboard cash flow, day by day', async () => {
    const result = await dashboard.getDashboard(userId, workspaceId, 'month', DAY);
    const sum = (key: 'income' | 'expense') =>
      result.cashFlow.reduce((total, point) => total + point[key], 0);
    expect(sum('income')).toBe(INCOME);
    expect(sum('expense')).toBe(EXPENSE);
  });

  it('the cash flow map', async () => {
    const result = await cashFlowMap.getMap(workspaceId, range, 'en');
    expect(result.income.total).toBe(INCOME);
    expect(result.expense.total).toBe(EXPENSE);
  });

  it('the top categories report', async () => {
    const result = await reports.getTopCategoriesReport(workspaceId, range);
    expect(result.totals.income).toBe(INCOME);
    expect(result.totals.expense).toBe(EXPENSE);
  });

  it('the spend flow', async () => {
    expect((await spendFlow.getSpendFlow(workspaceId, { ...range, type: 'income' })).total).toBe(
      INCOME,
    );
    expect((await spendFlow.getSpendFlow(workspaceId, { ...range, type: 'expense' })).total).toBe(
      EXPENSE,
    );
  });

  it('the forecast history', async () => {
    const result = await forecast.getForecast(workspaceId, { days: 30 });
    expect(result.monthlyIncome).toBe(INCOME);
    expect(result.monthlyExpense).toBe(EXPENSE);
  });

  it('a budget on the spending category', async () => {
    await budgets.create(workspaceId, userId, {
      name: 'Groceries',
      categoryId: groceriesId,
      limitAmount: 1000,
      periodType: 'monthly',
    });
    const [budget] = await budgets.findAll(workspaceId, new Date(DAY));
    expect(budget.spentAmount).toBe(EXPENSE);
  });

  it("the cash flow's budgeted share, within the budget's limit", async () => {
    const budgeted = async () =>
      (await dashboard.getDashboard(userId, workspaceId, 'month', DAY)).cashFlow.reduce(
        (total, point) => total + point.budgeted,
        0,
      );
    // The budget above has room for all of it.
    expect(await budgeted()).toBe(EXPENSE);

    const [budget] = await budgets.findAll(workspaceId, new Date(DAY));
    const limit = EXPENSE - 50;
    await budgets.update(budget.id, workspaceId, userId, { limitAmount: limit });
    expect(await budgeted()).toBe(limit);
  });
});
