/**
 * Integration test — reports read from the journal, on a hand-computed book:
 *
 *   2026-01-05  Dr Bank 1000        / Cr Opening balances 1000
 *   2026-02-10  Dr Bank 119         / Cr Sales 100, Cr VAT payable 19
 *   2026-03-15  Dr Rent 50          / Cr Bank 50
 *   2026-03-20  Dr Rent 30          / Cr Bank 30      (reversed on 2026-03-21)
 *
 * Real services and migrations on a scratch database; entries go through the
 * manual journal, so what is reported is what the workflow books.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

import * as entityIndex from '../../src/entities';
import { LedgerAccountType, Transaction, TransactionType, User, Workspace } from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LEDGER_ACCOUNT_CODES } from '../../src/modules/ledger/ledger-default-accounts';
import { LedgerEntriesService } from '../../src/modules/ledger/ledger-entries.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { LedgerReportsService } from '../../src/modules/ledger/ledger-reports.service';
import { LedgerSyncService } from '../../src/modules/ledger/ledger-sync.service';
import { LedgerSyncQueue } from '../../src/modules/ledger/queue/ledger-sync.queue';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_ledger_reports_${process.pid}`;

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

async function httpError(promise: Promise<unknown>): Promise<{ status: number; code?: string }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), code: (error.getResponse() as { code?: string }).code };
    }
    throw error;
  }
  throw new Error('expected the call to fail');
}

describe('ledger reports (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let reports: LedgerReportsService;
  let workspaceId: string;
  const ids: Record<string, string> = {};

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        LedgerReportsService,
        LedgerSyncService,
        LedgerEntriesService,
        LedgerPostingService,
        LedgerAccountsService,
        { provide: LedgerSyncQueue, useValue: { enqueue: jest.fn() } },
        { provide: AuditService, useValue: { createEvent: jest.fn().mockResolvedValue(undefined) } },
        { provide: ExchangeRatesService, useValue: { getRateQuote: jest.fn().mockResolvedValue(null) } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    reports = moduleRef.get(LedgerReportsService);
    const entries = moduleRef.get(LedgerEntriesService);
    const accounts = moduleRef.get(LedgerAccountsService);

    workspaceId = (
      await dataSource
        .getRepository(Workspace)
        .save({ name: 'Reports WS', currency: 'EUR', ledgerBaseCurrency: 'EUR' })
    ).id;
    const userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `reports-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Reporter',
          workspaceId,
        }),
      )
    ).id;

    const system = await accounts.systemAccountIds(workspaceId);
    ids.opening = system[LEDGER_ACCOUNT_CODES.OPENING_BALANCE];
    ids.vat = system[LEDGER_ACCOUNT_CODES.VAT_PAYABLE];
    ids.assets = system[LEDGER_ACCOUNT_CODES.ASSETS];
    ids.bank = (
      await accounts.create(workspaceId, {
        code: 'BANK',
        name: 'Bank',
        accountType: LedgerAccountType.ASSET,
        parentId: system[LEDGER_ACCOUNT_CODES.CASH],
      })
    ).id;
    ids.sales = (
      await accounts.create(workspaceId, {
        code: 'SALES',
        name: 'Sales',
        accountType: LedgerAccountType.INCOME,
        parentId: system[LEDGER_ACCOUNT_CODES.INCOME],
      })
    ).id;
    ids.rent = (
      await accounts.create(workspaceId, {
        code: 'RENT',
        name: 'Rent',
        accountType: LedgerAccountType.EXPENSE,
        parentId: system[LEDGER_ACCOUNT_CODES.EXPENSES],
      })
    ).id;

    const book = async (entryDate: string, lines: Array<[string, 'debit' | 'credit', string]>) => {
      const draft = await entries.createDraft(workspaceId, userId, {
        entryDate,
        lines: lines.map(([accountId, side, amount]) => ({ accountId, side, amount })),
      });
      return entries.post(workspaceId, draft.id, userId);
    };
    await book('2026-01-05', [
      [ids.bank, 'debit', '1000.00'],
      [ids.opening, 'credit', '1000.00'],
    ]);
    await book('2026-02-10', [
      [ids.bank, 'debit', '119.00'],
      [ids.sales, 'credit', '100.00'],
      [ids.vat, 'credit', '19.00'],
    ]);
    await book('2026-03-15', [
      [ids.rent, 'debit', '50.00'],
      [ids.bank, 'credit', '50.00'],
    ]);
    const mistake = await book('2026-03-20', [
      [ids.rent, 'debit', '30.00'],
      [ids.bank, 'credit', '30.00'],
    ]);
    await entries.reverse(workspaceId, mistake.id, userId, { date: '2026-03-21' });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('builds a trial balance whose columns tie out, with headers summing their accounts', async () => {
    const tb = await reports.trialBalance(workspaceId, { dateFrom: '2026-02-01', dateTo: '2026-03-31' });
    const row = (code: string) => tb.rows.find(r => r.code === code);

    expect(row('BANK')).toMatchObject({
      openingDebit: '1000.00',
      debit: '149.00',
      credit: '80.00',
      closingDebit: '1069.00',
      closingCredit: '0.00',
    });
    expect(row('RENT')).toMatchObject({ debit: '80.00', credit: '30.00', closingDebit: '50.00' });
    expect(row(LEDGER_ACCOUNT_CODES.OPENING_BALANCE)).toMatchObject({
      openingCredit: '1000.00',
      closingCredit: '1000.00',
    });
    expect(row('ASSETS')).toMatchObject({ openingDebit: '1000.00', closingDebit: '1069.00', isPostable: false });

    expect(tb.totals).toEqual({
      openingDebit: '1000.00',
      openingCredit: '1000.00',
      debit: '229.00',
      credit: '229.00',
      closingDebit: '1119.00',
      closingCredit: '1119.00',
    });
    expect(tb.balanced).toBe(true);
    expect(tb.freshness).toEqual({ upToDate: true, pendingTransactions: 0, failingTransactions: 0 });

    // Untouched accounts are left out; a header stays only above activity.
    expect(row(LEDGER_ACCOUNT_CODES.FX_GAIN)).toBeUndefined();
    expect(tb.rows.findIndex(r => r.code === 'ASSETS')).toBeLessThan(tb.rows.findIndex(r => r.code === 'BANK'));
  });

  it('reports profit and loss for a period', async () => {
    const pnl = await reports.profitAndLoss(workspaceId, { dateFrom: '2026-01-01', dateTo: '2026-03-31' });
    expect(pnl.totals).toEqual({ income: '100.00', expenses: '50.00', netIncome: '50.00' });
    expect(pnl.income.find(r => r.code === 'SALES')?.amount).toBe('100.00');
    expect(pnl.expenses.find(r => r.code === LEDGER_ACCOUNT_CODES.EXPENSES)?.amount).toBe('50.00');

    const february = await reports.profitAndLoss(workspaceId, { dateFrom: '2026-02-01', dateTo: '2026-02-28' });
    expect(february.totals).toEqual({ income: '100.00', expenses: '0.00', netIncome: '100.00' });
  });

  it('builds a balance sheet where assets equal liabilities plus equity', async () => {
    const end = await reports.balanceSheet(workspaceId, { date: '2026-03-31' });
    expect(end.totals).toEqual({
      assets: '1069.00',
      liabilities: '19.00',
      equity: '1050.00',
      liabilitiesAndEquity: '1069.00',
    });
    expect(end.unclosedEarnings).toBe('50.00');
    expect(end.balanced).toBe(true);

    const january = await reports.balanceSheet(workspaceId, { date: '2026-01-31' });
    expect(january.totals).toMatchObject({ assets: '1000.00', equity: '1000.00' });
    expect(january.balanced).toBe(true);
  });

  it('lists an account card with a running balance that survives pagination', async () => {
    const card = await reports.accountLedger(workspaceId, ids.bank, {
      dateFrom: '2026-02-01',
      dateTo: '2026-03-31',
    });
    expect(card).toMatchObject({ openingBalance: '1000.00', closingBalance: '1069.00', total: 4 });
    expect(card.lines.map(line => [line.entryDate, line.side, line.amount, line.runningBalance])).toEqual([
      ['2026-02-10', 'debit', '119.00', '1119.00'],
      ['2026-03-15', 'credit', '50.00', '1069.00'],
      ['2026-03-20', 'credit', '30.00', '1039.00'],
      ['2026-03-21', 'debit', '30.00', '1069.00'],
    ]);

    const second = await reports.accountLedger(workspaceId, ids.bank, {
      dateFrom: '2026-02-01',
      dateTo: '2026-03-31',
      page: 2,
      limit: 2,
    });
    expect(second.lines.map(line => line.runningBalance)).toEqual(['1039.00', '1069.00']);
    expect(second).toMatchObject({ page: 2, totalPages: 2 });

    // A credit-normal account reads positive.
    const sales = await reports.accountLedger(workspaceId, ids.sales, { dateFrom: '2026-01-01', dateTo: '2026-12-31' });
    expect(sales.closingBalance).toBe('100.00');
  });

  it('refuses while transactions wait to be booked, unless asked for a stale report', async () => {
    const pending = await dataSource.getRepository(Transaction).save(
      dataSource.getRepository(Transaction).create({
        workspaceId,
        transactionDate: new Date('2026-03-30'),
        counterpartyName: 'Late',
        paymentPurpose: 'Not yet booked',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        amount: 5,
        debit: 5,
      }),
    );
    expect(await httpError(reports.trialBalance(workspaceId, {}))).toEqual({
      status: 409,
      code: 'LEDGER_NOT_UP_TO_DATE',
    });
    const stale = await reports.balanceSheet(workspaceId, { date: '2026-03-31' }, { allowStale: true });
    expect(stale.freshness).toEqual({ upToDate: false, pendingTransactions: 1, failingTransactions: 0 });
    await dataSource.getRepository(Transaction).delete(pending.id);
  });

  it('refuses a workspace without the ledger, and another workspace account', async () => {
    const off = (await dataSource.getRepository(Workspace).save({ name: 'Off', currency: 'USD' })).id;
    expect(await httpError(reports.profitAndLoss(off, {}))).toEqual({ status: 409, code: 'LEDGER_DISABLED' });

    const other = (
      await dataSource
        .getRepository(Workspace)
        .save({ name: 'Other', currency: 'EUR', ledgerBaseCurrency: 'EUR' })
    ).id;
    expect(await httpError(reports.accountLedger(other, ids.bank, {}))).toEqual({
      status: 404,
      code: 'LEDGER_ACCOUNT_NOT_FOUND',
    });
  });
});
