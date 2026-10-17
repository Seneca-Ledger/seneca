/**
 * Integration test — a budget counts spending in its own currency, against a real Postgres.
 *
 * A budget has one currency; the rows it covers can be in any. Summing their
 * amounts as they are read 500 UAH as 500 USD against a 20 USD limit. Each row
 * is converted at the rate of its own day; a row with no rate to be had is left
 * out of the figure and reported, never counted one to one.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  Budget,
  BudgetPeriodType,
  BudgetRolloverMode,
  Category,
  CategoryType,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { BudgetsService } from '../../src/modules/budgets/budgets.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_budget_currencies_${process.pid}`;

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

const now = new Date();
const THIS_MONTH = isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
const LAST_MONTH = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 12));

/** UAH→USD has a rate (a different one last month); XYZ has none anywhere. */
const RATES: Record<string, number> = { 'UAH>USD': 0.024 };
const LAST_MONTH_RATES: Record<string, number> = { 'UAH>USD': 0.025 };

describe('a budget counts spending in its own currency (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  let donateId: string;
  let budgets: BudgetsService;
  let getRateOrNull: jest.Mock;

  const expense = (amount: number, currency: string, day = THIS_MONTH) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date(day),
        counterpartyName: 'LiqPay',
        paymentPurpose: 'Donation',
        currency,
        transactionType: TransactionType.EXPENSE,
        amount,
        debit: amount,
        credit: null,
        isVerified: true,
        categoryId: donateId,
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

    getRateOrNull = jest.fn(async (from: string, to: string, date?: Date | string) => {
      if (from === to) return 1;
      const day = date instanceof Date ? isoDay(date) : String(date).slice(0, 10);
      const table = day < THIS_MONTH ? LAST_MONTH_RATES : RATES;
      return table[`${from}>${to}`] ?? null;
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        BudgetsService,
        WorkspaceCurrencyService,
        { provide: ExchangeRatesService, useValue: { getRateOrNull } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: jest.fn() } },
        { provide: AuditService, useValue: { createEvent: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    budgets = moduleRef.get(BudgetsService);
    txRepo = dataSource.getRepository(Transaction);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Budget WS', currency: 'USD' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `budget-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Budget Tester',
          workspaceId,
        }),
      )
    ).id;
    donateId = (
      await dataSource
        .getRepository(Category)
        .save({ workspaceId, userId, name: 'Donate', type: CategoryType.EXPENSE })
    ).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  afterEach(async () => {
    await txRepo.delete({ workspaceId });
    await dataSource.getRepository(Budget).delete({ workspaceId });
  });

  const budget = (rolloverMode = BudgetRolloverMode.NONE) =>
    dataSource.getRepository(Budget).save({
      workspaceId,
      name: 'Charity',
      categoryId: donateId,
      limitAmount: 20,
      currency: 'USD',
      periodType: BudgetPeriodType.MONTHLY,
      rolloverMode,
      currentPeriodStart: THIS_MONTH,
      createdAt: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    } as Partial<Budget>);

  it('converts 500 UAH to dollars instead of reading it as 500 USD', async () => {
    const { id } = await budget();
    await expense(500, 'UAH');

    const measured = await budgets.findOne(id, workspaceId);

    expect(measured.spentAmount).toBe(12);
    expect(measured.percentUsed).toBe(60);
    expect(measured.unconvertedSpending).toEqual([]);
  });

  it('adds rows in its own currency as they are and converts the rest', async () => {
    const { id } = await budget();
    await expense(5, 'USD');
    await expense(500, 'UAH');

    expect((await budgets.findOne(id, workspaceId)).spentAmount).toBe(17);
  });

  it('leaves a row with no rate out of the figure and says so', async () => {
    const { id } = await budget();
    await expense(5, 'USD');
    await expense(100, 'XYZ');
    await expense(50, 'XYZ');

    const measured = await budgets.findOne(id, workspaceId);

    expect(measured.spentAmount).toBe(5);
    expect(measured.unconvertedSpending).toEqual([{ currency: 'XYZ', amount: 150 }]);
  });

  it("converts earlier periods for rollover at their own day's rate", async () => {
    const { id } = await budget(BudgetRolloverMode.CARRY);
    // 400 UAH last month at 0.025 = 10 USD: 10 of 20 left over and carried in.
    await expense(400, 'UAH', LAST_MONTH);

    const measured = await budgets.findOne(id, workspaceId);

    expect(measured.carriedAmount).toBe(10);
    expect(measured.availableAmount).toBe(30);
  });

  it('names the spending a mid-month start leaves out instead of showing a bare 0', async () => {
    // Only Date is faked: the database driver still needs real timers.
    jest.useFakeTimers({
      now: new Date(now.getFullYear(), now.getMonth(), 20, 12),
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'queueMicrotask',
        'hrtime',
        'performance',
      ],
    });
    try {
      const day = (date: number) => isoDay(new Date(now.getFullYear(), now.getMonth(), date));
      const { id } = await budget();
      await dataSource.getRepository(Budget).update({ id }, { startsOn: day(16) });
      await expense(8.9, 'USD', day(5));
      await expense(400, 'UAH', day(5));
      await expense(3, 'USD', day(18));

      const measured = await budgets.findOne(id, workspaceId);

      expect(measured.spentAmount).toBe(3);
      expect(measured.beforeStartSpending).toEqual(
        expect.arrayContaining([
          { currency: 'USD', amount: 8.9 },
          { currency: 'UAH', amount: 400 },
        ]),
      );
      expect(measured.beforeStartSpending).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('reports nothing left out when the budget has no start date', async () => {
    const { id } = await budget();
    await expense(5, 'USD');

    expect((await budgets.findOne(id, workspaceId)).beforeStartSpending).toEqual([]);
  });
});
