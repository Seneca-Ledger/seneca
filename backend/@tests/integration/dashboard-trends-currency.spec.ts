/**
 * Integration test — the dashboard's Trends tab in one currency, against a real Postgres.
 *
 * A workspace keeps money in more than one currency (a dollar account, a sale
 * paid in shekels). The Trends tab sums income, spending, categories and days;
 * every amount must be converted into the workspace currency first, as the
 * cash flow chart above it does, or a ₪3,500 sale reads as $3,500 and the
 * cards beside the chart disagree with it.
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
import { ReportsService } from '../../src/modules/reports/reports.service';
import { SpendFlowService } from '../../src/modules/reports/spend-flow.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { TaxReserveService } from '../../src/modules/tax/tax-reserve.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_trends_currency_${process.pid}`;

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

// A whole past month: no forecast, nothing cut at today.
const now = new Date();
const MONTH = `${now.getFullYear() - 1}-03`;
const DAY_ONE = `${MONTH}-04`;
const DAY_TWO = `${MONTH}-16`;

/** One shekel is 0.3 dollars. */
const ILS_TO_USD = 0.3;

describe('dashboard trends in the workspace currency (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  let servicesId: string;
  let dashboard: DashboardService;

  const row = (fields: Partial<Transaction>) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date(DAY_ONE),
        counterpartyName: 'Someone',
        paymentPurpose: 'Payment',
        currency: 'USD',
        transactionType: TransactionType.EXPENSE,
        isVerified: true,
        ...fields,
      }),
    );

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

    const rateOf = (from: string, to: string) =>
      from === to ? 1 : from === 'ILS' && to === 'USD' ? ILS_TO_USD : Number.NaN;
    const rates = {
      getRate: jest.fn(async (from: string, to: string) => rateOf(from, to)),
      getRateOrNull: jest.fn(async (from: string, to: string) => rateOf(from, to)),
      convert: jest.fn(async (amount: number, from: string, to: string) => amount * rateOf(from, to)),
      coverageForWorkspace: jest.fn(async () => []),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
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
    txRepo = dataSource.getRepository(Transaction);

    workspaceId = (
      await dataSource.getRepository(Workspace).save({ name: 'Dollars WS', currency: 'USD' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `trends-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Trends Tester',
          workspaceId,
        }),
      )
    ).id;
    servicesId = (
      await dataSource
        .getRepository(Category)
        .save({ workspaceId, userId, name: 'Services', type: CategoryType.EXPENSE })
    ).id;

    // Dollars.
    await row({ transactionType: TransactionType.INCOME, amount: 800, credit: 800, debit: null, counterpartyName: 'Client' });
    await row({ amount: 25, debit: 25, credit: null, categoryId: servicesId });
    // Shekels: a sale paid in hand and a receipt in the same category.
    await row({
      transactionDate: new Date(DAY_TWO),
      transactionType: TransactionType.INCOME,
      currency: 'ILS',
      amount: 3500,
      credit: 3500,
      debit: null,
      counterpartyName: 'Client',
    });
    await row({ currency: 'ILS', amount: 290, debit: 290, credit: null, categoryId: servicesId });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const INCOME = 800 + 3500 * ILS_TO_USD;
  const EXPENSE = 25 + 290 * ILS_TO_USD;

  it('sums the month in dollars, as the cash flow chart does', async () => {
    const trends = await dashboard.getTrends(workspaceId, 30, MONTH);
    const cashFlow = await dashboard.getMonthlyCashFlow(workspaceId, '12m', MONTH);
    const month = cashFlow.points.find(point => point.month === MONTH);

    expect(trends.sources.statements.income).toBeCloseTo(INCOME, 2);
    expect(trends.sources.statements.expense).toBeCloseTo(EXPENSE, 2);
    expect(month).toMatchObject({ income: INCOME, expense: EXPENSE });
  });

  it('converts each day', async () => {
    const trends = await dashboard.getTrends(workspaceId, 30, MONTH);
    const day = (date: string) => trends.dailyTrend.find(point => point.date === date);

    expect(day(DAY_ONE)).toMatchObject({ income: 800 });
    expect(day(DAY_ONE)?.expense).toBeCloseTo(EXPENSE, 2);
    expect(day(DAY_TWO)?.income).toBeCloseTo(3500 * ILS_TO_USD, 2);
  });

  it('adds a category spent in two currencies once, in dollars', async () => {
    const trends = await dashboard.getTrends(workspaceId, 30, MONTH);

    expect(trends.categories).toHaveLength(1);
    expect(trends.categories[0]).toMatchObject({ name: 'Services', count: 2 });
    expect(trends.categories[0].amount).toBeCloseTo(EXPENSE, 2);
  });

  it('adds a payer paid in two currencies once, in dollars', async () => {
    const trends = await dashboard.getTrends(workspaceId, 30, MONTH);

    expect(trends.counterparties).toHaveLength(1);
    expect(trends.counterparties[0]).toMatchObject({ name: 'Client', count: 2 });
    expect(trends.counterparties[0].amount).toBeCloseTo(INCOME, 2);
  });
});
