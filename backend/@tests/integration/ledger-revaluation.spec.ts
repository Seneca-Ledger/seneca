/**
 * Integration test — revaluing foreign-currency balances, against a real
 * Postgres.
 *
 * What a revaluation books follows from the balances the database holds, and
 * its base-only lines are something the CHECK constraints and the balance
 * trigger have to accept for a revaluation and refuse for anything else; only
 * a database shows both. Scratch database, real migrations, real services;
 * the queue, the audit sink and exchange rates are stubbed.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  Category,
  CategoryType,
  FileType,
  JournalEntrySource,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LEDGER_ACCOUNT_CODES } from '../../src/modules/ledger/ledger-default-accounts';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { LedgerReportsService } from '../../src/modules/ledger/ledger-reports.service';
import { LedgerRevaluationService } from '../../src/modules/ledger/ledger-revaluation.service';
import { LedgerSyncService } from '../../src/modules/ledger/ledger-sync.service';
import { LedgerSyncQueue } from '../../src/modules/ledger/queue/ledger-sync.queue';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_ledger_revaluation_${process.pid}`;

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

/** USD -> EUR by day; later days not listed use the latest earlier one. */
const USD_EUR: Record<string, number> = {
  '2026-01-10': 0.9,
  '2026-01-15': 0.9,
  '2026-01-31': 0.95,
  '2026-02-28': 0.92,
};

describe('ledger FX revaluation (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let revaluation: LedgerRevaluationService;
  let sync: LedgerSyncService;
  let posting: LedgerPostingService;
  let reports: LedgerReportsService;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  let statementId: string;
  let salesId: string;
  let system: Record<string, string>;

  const query = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    dataSource.query(sql, params) as Promise<T[]>;

  const income = (amount: number, date: string) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        statementId,
        transactionDate: new Date(date),
        counterpartyName: 'Client',
        paymentPurpose: 'Invoice',
        currency: 'USD',
        transactionType: TransactionType.INCOME,
        categoryId: salesId,
        amount,
        credit: amount,
        isVerified: true,
      }),
    );

  /** The USD cash account's balance in USD and in EUR. */
  async function usdCash(): Promise<{ doc: string; base: string }> {
    const [row] = await query<{ doc: string; base: string }>(
      `SELECT sum(l."debit" - l."credit")::numeric(15,2)::text AS "doc",
              sum(l."base_debit" - l."base_credit")::numeric(15,2)::text AS "base"
         FROM "journal_lines" l
         JOIN "journal_entries" e ON e."id" = l."entry_id"
         JOIN "ledger_accounts" a ON a."id" = l."account_id"
        WHERE e."workspace_id" = $1 AND e."status" <> 'draft' AND a."currency" = 'USD'`,
      [workspaceId],
    );
    return row;
  }

  const entryCount = async () =>
    (await query<{ n: number }>(
      `SELECT count(*)::int AS "n" FROM "journal_entries" WHERE "workspace_id" = $1`,
      [workspaceId],
    ))[0].n;

  async function errorOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      const http = error as HttpException;
      return { status: http.getStatus(), code: (http.getResponse() as { code?: string }).code };
    }
    return null;
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        LedgerRevaluationService,
        LedgerSyncService,
        LedgerPostingService,
        LedgerAccountsService,
        LedgerReportsService,
        { provide: LedgerSyncQueue, useValue: { enqueue: jest.fn() } },
        { provide: AuditService, useValue: { createEvent: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: ExchangeRatesService,
          useValue: {
            getRateQuote: jest.fn(async (from: string, to: string, date: string) => {
              const known = Object.keys(USD_EUR).filter(day => day <= date).sort();
              const day = known[known.length - 1];
              return from === 'USD' && to === 'EUR' && day
                ? { rate: USD_EUR[day], rateDate: day, stale: day !== date }
                : null;
            }),
          },
        },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    revaluation = moduleRef.get(LedgerRevaluationService);
    sync = moduleRef.get(LedgerSyncService);
    posting = moduleRef.get(LedgerPostingService);
    reports = moduleRef.get(LedgerReportsService);
    txRepo = dataSource.getRepository(Transaction);

    workspaceId = (
      await dataSource
        .getRepository(Workspace)
        .save({ name: 'FX WS', currency: 'EUR', ledgerBaseCurrency: 'EUR' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `fx-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'FX Tester',
          workspaceId,
        }),
      )
    ).id;
    statementId = (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'usd.pdf',
          filePath: '/tmp/usd.pdf',
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          accountNumber: 'US00 1',
          currency: 'USD',
        }),
      )
    ).id;
    salesId = (
      await dataSource
        .getRepository(Category)
        .save({ workspaceId, userId, name: 'Sales', type: CategoryType.INCOME })
    ).id;

    await income(1000, '2026-01-10');
    await sync.syncWorkspace(workspaceId);
    system = await moduleRef.get(LedgerAccountsService).systemAccountIds(workspaceId);
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('books the gain on a stronger foreign currency, and nothing else moves', async () => {
    expect(await usdCash()).toEqual({ doc: '1000.00', base: '900.00' });

    const result = await revaluation.revalue(workspaceId, userId, '2026-01-31');

    expect(result).toMatchObject({
      status: 'posted',
      revaluation: { entryDate: '2026-01-31', gain: '50.00', loss: '0.00' },
    });
    expect(await usdCash()).toEqual({ doc: '1000.00', base: '950.00' });
    const pnl = await reports.profitAndLoss(workspaceId, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(pnl.income).toContainEqual(
      expect.objectContaining({ code: LEDGER_ACCOUNT_CODES.FX_GAIN, amount: '50.00' }),
    );
    expect(pnl.totals.netIncome).toBe('950.00');
    const trial = await reports.trialBalance(workspaceId, { dateTo: '2026-01-31' });
    expect(trial.balanced).toBe(true);
  });

  it('books nothing when the same day is revalued again', async () => {
    const before = await entryCount();
    await expect(revaluation.revalue(workspaceId, userId, '2026-01-31')).resolves.toMatchObject({
      status: 'unchanged',
    });
    expect(await entryCount()).toBe(before);
  });

  it('refuses a day before the latest revaluation, and a day to come', async () => {
    expect(await errorOf(revaluation.revalue(workspaceId, userId, '2026-01-20'))).toEqual({
      status: 409,
      code: 'LEDGER_REVALUATION_BACKDATED',
    });
    expect(await errorOf(revaluation.revalue(workspaceId, userId, '2999-01-01'))).toEqual({
      status: 400,
      code: 'LEDGER_REVALUATION_FUTURE',
    });
  });

  it('flags the revaluation stale when a movement lands before it, and redoing it catches up', async () => {
    expect((await sync.integrity(workspaceId)).lastRevaluation).toMatchObject({
      date: '2026-01-31',
      stale: false,
    });

    await income(200, '2026-01-15');
    expect(
      await errorOf(revaluation.revalue(workspaceId, userId, '2026-01-31')),
    ).toEqual({ status: 409, code: 'LEDGER_NOT_UP_TO_DATE' });
    await sync.syncWorkspace(workspaceId);
    expect((await sync.integrity(workspaceId)).lastRevaluation).toMatchObject({ stale: true });

    await expect(revaluation.revalue(workspaceId, userId, '2026-01-31')).resolves.toMatchObject({
      status: 'posted',
      revaluation: { gain: '60.00' },
    });
    expect(await usdCash()).toEqual({ doc: '1200.00', base: '1140.00' });
    expect((await sync.integrity(workspaceId)).lastRevaluation).toMatchObject({ stale: false });
    expect(await revaluation.list(workspaceId)).toHaveLength(1);
  });

  it('books a loss when the currency weakens the next month, cumulatively', async () => {
    const result = await revaluation.revalue(workspaceId, userId, '2026-02-28');

    // 1,200 USD from 0.95 to 0.92.
    expect(result).toMatchObject({ status: 'posted', revaluation: { gain: '0.00', loss: '36.00' } });
    expect(await usdCash()).toEqual({ doc: '1200.00', base: '1104.00' });
    expect((await revaluation.list(workspaceId)).map(item => item.entryDate)).toEqual([
      '2026-02-28',
      '2026-01-31',
    ]);
  });

  it('leaves uncategorised amounts on SUSPENSE at their historical rate', async () => {
    const before = await revaluation.list(workspaceId);
    const uncategorised = await income(100, '2026-02-10');
    await txRepo.update(uncategorised.id, { categoryId: null });
    await sync.syncWorkspace(workspaceId);

    // USD cash is revalued; SUSPENSE, which holds the other side, is not. The
    // day's entry is replaced, so it carries the whole loss since January:
    // 36.00 on the earlier 1,200 USD and 3.00 on the new 100 USD.
    const result = await revaluation.revalue(workspaceId, userId, '2026-02-28');
    expect(result).toMatchObject({ status: 'posted', revaluation: { gain: '0.00', loss: '39.00' } });
    const suspense = await query<{ n: number }>(
      `SELECT count(*)::int AS "n" FROM "journal_lines" l
         JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE e."workspace_id" = $1 AND e."source" = 'fx_revaluation' AND l."account_id" = $2`,
      [workspaceId, system[LEDGER_ACCOUNT_CODES.SUSPENSE]],
    );
    expect(suspense[0].n).toBe(0);
    expect((await revaluation.list(workspaceId)).length).toBe(before.length);
  });

  it('refuses a line with no amount anywhere but in a revaluation', async () => {
    const [usdAccount] = await query<{ id: string }>(
      `SELECT "id" FROM "ledger_accounts" WHERE "workspace_id" = $1 AND "currency" = 'USD'`,
      [workspaceId],
    );
    const lines = [
      { accountId: usdAccount.id, side: 'debit' as const, amountMinor: 0, currency: 'USD', baseMinor: 100, fxRate: 1 },
      {
        accountId: system[LEDGER_ACCOUNT_CODES.FX_GAIN],
        side: 'credit' as const,
        amountMinor: 100,
        currency: 'EUR',
        baseMinor: 100,
        fxRate: 1,
      },
    ];
    await expect(
      dataSource.transaction(manager =>
        posting.book(manager, {
          workspaceId,
          entryDate: '2026-03-01',
          baseCurrency: 'EUR',
          memo: 'Sneaky',
          source: JournalEntrySource.MANUAL,
          lines,
        }),
      ),
    ).rejects.toThrow(/no amount outside a revaluation/);
  });

  it('keeps every booked entry balanced', async () => {
    expect((await sync.integrity(workspaceId)).unbalancedEntries).toBe(0);
  });
});
