/**
 * Integration test — keeping the ledger in step with its sources.
 *
 * Dirty flags are set by database triggers, so only a real database can show
 * which writes set them; the sync service is then run directly (the BullMQ
 * worker is a thin wrapper around it). Scratch database, real migrations;
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
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Wallet,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { LedgerSyncService } from '../../src/modules/ledger/ledger-sync.service';
import { LedgerSyncQueue } from '../../src/modules/ledger/queue/ledger-sync.queue';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_ledger_sync_${process.pid}`;

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

describe('ledger sync (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let sync: LedgerSyncService;
  let txRepo: Repository<Transaction>;
  const queue = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const rates: Record<string, number> = { USD: 0.9 };

  let workspaceId: string;
  let userId: string;
  let statementId: string;
  let foodId: string;
  let parentId: string;

  const query = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    dataSource.query(sql, params) as Promise<T[]>;

  async function flags(id: string) {
    const [row] = await query<{
      ledger_dirty: boolean;
      ledger_error: string | null;
      ledger_attempted_at: Date | null;
      ledger_posted_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT "ledger_dirty", "ledger_error", "ledger_attempted_at", "ledger_posted_at", "updated_at"
         FROM "transactions" WHERE "id" = $1`,
      [id],
    );
    return row;
  }

  async function insertTransaction(fields: Partial<Transaction>): Promise<string> {
    const saved = await txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date('2026-05-10'),
        counterpartyName: 'Shop',
        paymentPurpose: 'Purchase',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        categoryId: foodId,
        statementId,
        // Booked rows are confirmed ones; a test about unconfirmed rows overrides it.
        isVerified: true,
        ...fields,
      }),
    );
    return saved.id;
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
        LedgerSyncService,
        LedgerPostingService,
        LedgerAccountsService,
        { provide: LedgerSyncQueue, useValue: queue },
        { provide: AuditService, useValue: { createEvent: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: ExchangeRatesService,
          useValue: {
            getRateQuote: jest.fn(async (from: string, to: string, date: string) =>
              to === 'EUR' && rates[from] !== undefined
                ? { rate: rates[from], rateDate: date, stale: false }
                : null,
            ),
          },
        },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    sync = moduleRef.get(LedgerSyncService);
    txRepo = dataSource.getRepository(Transaction);

    workspaceId = (await dataSource.getRepository(Workspace).save({ name: 'Sync WS', currency: 'USD' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `sync-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Sync Tester',
          workspaceId,
        }),
      )
    ).id;
    statementId = (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'may.pdf',
          filePath: '/tmp/may.pdf',
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          accountNumber: 'DE00 1111 2222',
          currency: 'EUR',
          balanceStart: 1000,
          balanceEnd: 1000 - 100 - 25.5,
          statementDateFrom: new Date('2026-05-01'),
          statementDateTo: new Date('2026-05-31'),
        }),
      )
    ).id;
    const categories = dataSource.getRepository(Category);
    parentId = (await categories.save({ workspaceId, userId, name: 'Living', type: CategoryType.EXPENSE })).id;
    foodId = (await categories.save({ workspaceId, userId, name: 'Food', type: CategoryType.EXPENSE })).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  let first: string;
  let second: string;

  it('queues every new transaction, and posts nothing while the ledger is off', async () => {
    first = await insertTransaction({ amount: 100, debit: 100 });
    second = await insertTransaction({ amount: 25.5, debit: 25.5 });
    expect((await flags(first)).ledger_dirty).toBe(true);

    const report = await sync.syncWorkspace(workspaceId);
    expect(report).toMatchObject({ enabled: false, processed: 0 });
    expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);
    expect(await sync.getSettings(workspaceId)).toMatchObject({
      enabled: false,
      suggestedBaseCurrency: 'EUR',
      pendingTransactions: 2,
    });
  });

  it('books the whole history once enabled, opening balance included, and reconciles to the statement', async () => {
    const settings = await sync.enable(workspaceId, userId, 'eur');
    expect(settings).toMatchObject({ baseCurrency: 'EUR', enabled: true });
    expect(queue.enqueue).toHaveBeenCalledWith(workspaceId);
    expect(await sync.workspacesNeedingSync()).toContain(workspaceId);

    const report = await sync.syncWorkspace(workspaceId);
    expect(report).toMatchObject({ processed: 2, failed: 0, openingBalances: 1 });

    const posted = await flags(first);
    expect(posted.ledger_dirty).toBe(false);
    expect(posted.ledger_posted_at).not.toBeNull();

    const integrity = await sync.integrity(workspaceId);
    expect(integrity).toMatchObject({
      pendingTransactions: 0,
      failingTransactions: 0,
      orphanEntries: 0,
      unbalancedEntries: 0,
      upToDate: true,
    });
    expect(integrity.cashAccounts).toEqual([
      expect.objectContaining({
        ledgerBalance: '874.50',
        statementBalance: '874.50',
        difference: '0.00',
        hasOpeningBalance: true,
      }),
    ]);
    expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);
  });

  it('posting does not touch the transaction updated_at', async () => {
    const before = (await flags(second)).updated_at;
    await txRepo.update(second, { amount: 26, debit: 26 });
    const edited = (await flags(second)).updated_at;
    await sync.syncWorkspace(workspaceId);
    expect((await flags(second)).updated_at).toEqual(edited);
    expect(edited).not.toEqual(before);
  });

  it('re-queues a row only when a fact of its entry changes', async () => {
    await txRepo.update(first, { comments: 'note to self' });
    expect((await flags(first)).ledger_dirty).toBe(false);

    await dataSource.query(`UPDATE "transactions" SET "amount" = 101, "debit" = 101 WHERE "id" = $1`, [first]);
    expect((await flags(first)).ledger_dirty).toBe(true);
    await sync.syncWorkspace(workspaceId);
    expect((await flags(first)).ledger_dirty).toBe(false);
  });

  it('books a row only while it is confirmed, re-queueing it when that changes', async () => {
    const liveEntries = async () =>
      (
        await query<{ count: number }>(
          `SELECT count(*)::int AS "count" FROM "journal_entries"
            WHERE "source_transaction_id" = $1 AND "status" = 'posted' AND "reversal_of_id" IS NULL`,
          [first],
        )
      )[0].count;
    expect(await liveEntries()).toBe(1);

    await dataSource.query(`UPDATE "transactions" SET "is_verified" = false WHERE "id" = $1`, [first]);
    expect((await flags(first)).ledger_dirty).toBe(true);
    await sync.syncWorkspace(workspaceId);
    expect(await liveEntries()).toBe(0);

    await dataSource.query(`UPDATE "transactions" SET "is_verified" = true WHERE "id" = $1`, [first]);
    expect((await flags(first)).ledger_dirty).toBe(true);
    await sync.syncWorkspace(workspaceId);
    expect(await liveEntries()).toBe(1);
  });

  it('re-queues the rows of a statement that is trashed, and of a category that moves', async () => {
    await dataSource.getRepository(Statement).update(statementId, { deletedAt: new Date() });
    expect((await flags(first)).ledger_dirty).toBe(true);
    expect((await flags(second)).ledger_dirty).toBe(true);
    await sync.syncWorkspace(workspaceId);
    // Trashed with its opening balance: the bank account is back to zero in the ledger.
    const trashed = await sync.integrity(workspaceId);
    expect(trashed.cashAccounts.map(account => account.ledgerBalance)).toEqual(['0.00']);

    await dataSource.getRepository(Statement).update(statementId, { deletedAt: null });
    await sync.syncWorkspace(workspaceId);
    const restored = await sync.integrity(workspaceId);
    // 1000 opening, less the two rows as edited above (101 and 26).
    expect(restored.cashAccounts[0]).toMatchObject({ ledgerBalance: '873.00', hasOpeningBalance: true });

    await dataSource.getRepository(Category).update(foodId, { parentId });
    expect((await flags(first)).ledger_dirty).toBe(true);
    await sync.syncWorkspace(workspaceId);
    expect((await flags(first)).ledger_dirty).toBe(false);
  });

  it('re-queues rows whose category is deleted (a foreign-key write no subscriber sees)', async () => {
    const doomed = await dataSource.getRepository(Category).save({
      workspaceId,
      userId,
      name: 'Doomed',
      type: CategoryType.EXPENSE,
    });
    const onDoomed = await insertTransaction({ amount: 5, debit: 5, categoryId: doomed.id });
    await sync.syncWorkspace(workspaceId);
    expect((await flags(onDoomed)).ledger_dirty).toBe(false);

    await dataSource.getRepository(Category).delete(doomed.id);
    expect((await flags(onDoomed)).ledger_dirty).toBe(true);
    await sync.syncWorkspace(workspaceId);
    expect((await flags(onDoomed)).ledger_dirty).toBe(false);
  });

  it('records a failing row, leaves it alone for a while, and retries once its facts change', async () => {
    const lira = await insertTransaction({ amount: 50, debit: 50, currency: 'TRY', statementId: null });
    const report = await sync.syncWorkspace(workspaceId);
    expect(report.failed).toBe(1);

    const failed = await flags(lira);
    expect(failed.ledger_dirty).toBe(true);
    expect(failed.ledger_error).toMatch(/^FX_RATE_MISSING/);

    // Within the pause the row is not retried, and does not keep the workspace in the sweep.
    expect((await sync.syncWorkspace(workspaceId)).failed).toBe(0);
    expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);
    const integrity = await sync.integrity(workspaceId);
    expect(integrity).toMatchObject({ failingTransactions: 1, upToDate: false });
    expect(integrity.failures[0]).toMatchObject({ transactionId: lira });

    // Fixing the row clears the error through the trigger and it books.
    await txRepo.update(lira, { currency: 'USD' });
    expect((await flags(lira)).ledger_error).toBeNull();
    expect((await sync.syncWorkspace(workspaceId)).processed).toBe(1);
    expect((await flags(lira)).ledger_dirty).toBe(false);
  });

  it('reverses the entry of a deleted transaction', async () => {
    const [{ id: entryId }] = await query<{ id: string }>(
      `SELECT "id" FROM "journal_entries"
        WHERE "source_transaction_id" = $1 AND "status" = 'posted' AND "reversal_of_id" IS NULL`,
      [second],
    );
    await txRepo.delete(second);
    expect((await sync.integrity(workspaceId)).orphanEntries).toBe(1);
    expect(await sync.workspacesNeedingSync()).toContain(workspaceId);

    const report = await sync.syncWorkspace(workspaceId);
    expect(report.orphansReversed).toBe(1);
    const [original] = await query<{ status: string }>(
      `SELECT "status" FROM "journal_entries" WHERE "id" = $1`,
      [entryId],
    );
    expect(original.status).toBe('reversed');
    expect((await sync.integrity(workspaceId)).orphanEntries).toBe(0);
  });

  it('fixes the base currency once entries exist', async () => {
    await expect(sync.enable(workspaceId, userId, 'EUR')).resolves.toMatchObject({ baseCurrency: 'EUR' });
    let status: number | undefined;
    let code: string | undefined;
    try {
      await sync.enable(workspaceId, userId, 'USD');
    } catch (error) {
      status = (error as HttpException).getStatus();
      code = ((error as HttpException).getResponse() as { code: string }).code;
    }
    expect({ status, code }).toEqual({ status: 409, code: 'LEDGER_BASE_CURRENCY_LOCKED' });

    // A workspace with nothing booked may still change its mind.
    const fresh = (await dataSource.getRepository(Workspace).save({ name: 'Fresh WS', currency: 'USD' })).id;
    await sync.enable(fresh, userId, 'EUR');
    await expect(sync.enable(fresh, userId, 'USD')).resolves.toMatchObject({ baseCurrency: 'USD' });
  });

  describe('wallet opening balances', () => {
    /** The live opening entry on a wallet's cash account. */
    const walletOpening = (walletId: string) =>
      query<{ entry_date: string; base_debit: string; base_credit: string }>(
        `SELECT e."entry_date"::text AS "entry_date", l."base_debit", l."base_credit"
           FROM "journal_entries" e
           JOIN "journal_lines" l ON l."entry_id" = e."id"
           JOIN "ledger_accounts" a ON a."id" = l."account_id"
          WHERE a."wallet_id" = $1 AND e."source" = 'opening_balance'
            AND e."status" = 'posted' AND e."reversal_of_id" IS NULL`,
        [walletId],
      );
    const walletRecon = async (walletId: string) => {
      const [account] = await query<{ id: string }>(
        `SELECT "id" FROM "ledger_accounts" WHERE "wallet_id" = $1`,
        [walletId],
      );
      return (await sync.integrity(workspaceId)).cashAccounts.find(
        cash => cash.accountId === account?.id,
      );
    };

    let walletId: string;

    it('books the opening balance, dated by the first movement, and reconciles the wallet', async () => {
      const wallets = dataSource.getRepository(Wallet);
      walletId = (
        await wallets.save(
          wallets.create({ userId, workspaceId, name: 'Cash box', currency: 'EUR', initialBalance: 300 }),
        )
      ).id;
      expect(await sync.workspacesNeedingSync()).toContain(workspaceId);
      await insertTransaction({
        amount: 40,
        debit: 40,
        statementId: null,
        walletId,
        transactionDate: new Date('2026-04-02'),
      });

      const report = await sync.syncWorkspace(workspaceId);

      expect(report.openingBalances).toBe(1);
      expect(await walletOpening(walletId)).toEqual([
        { entry_date: '2026-04-02', base_debit: '300.00', base_credit: '0.00' },
      ]);
      expect(await walletRecon(walletId)).toMatchObject({
        ledgerBalance: '260.00',
        statementBalance: '260.00',
        difference: '0.00',
        hasOpeningBalance: true,
      });
      expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);
    });

    it('re-books it when the opening balance changes, and only then', async () => {
      const wallets = dataSource.getRepository(Wallet);
      await wallets.update(walletId, { name: 'Till' });
      expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);

      await wallets.update(walletId, { initialBalance: 350 });
      expect(await sync.workspacesNeedingSync()).toContain(workspaceId);
      expect((await sync.syncWorkspace(workspaceId)).openingBalances).toBe(1);
      expect(await walletOpening(walletId)).toEqual([
        expect.objectContaining({ base_debit: '350.00' }),
      ]);
      expect(await walletRecon(walletId)).toMatchObject({ ledgerBalance: '310.00', difference: '0.00' });

      expect((await sync.syncWorkspace(workspaceId, { force: true })).openingBalances).toBe(0);
    });

    it('reverses it when the wallet is deactivated', async () => {
      await dataSource.getRepository(Wallet).update(walletId, { isActive: false });
      expect((await sync.syncWorkspace(workspaceId)).openingBalances).toBe(1);
      expect(await walletOpening(walletId)).toEqual([]);
      // The reconciliation expects no opening either: no false difference.
      expect(await walletRecon(walletId)).toMatchObject({ ledgerBalance: '-40.00', difference: '0.00' });
    });

    it('leaves a wallet that mirrors a bank account to its statements', async () => {
      const wallets = dataSource.getRepository(Wallet);
      const mirror = (
        await wallets.save(
          wallets.create({ userId, workspaceId, name: 'Bank', currency: 'EUR', initialBalance: 999 }),
        )
      ).id;
      await insertTransaction({ amount: 5, debit: 5, walletId: mirror });
      await insertTransaction({ amount: 10, debit: 10, walletId: mirror, statementId: null });

      await sync.syncWorkspace(workspaceId);

      expect(await walletOpening(mirror)).toEqual([]);
      expect(await walletRecon(mirror)).toMatchObject({ ledgerBalance: '-10.00', difference: '0.00' });
    });

    it('books the other openings when one lacks a rate, and retries that one later', async () => {
      const wallets = dataSource.getRepository(Wallet);
      const euro = (
        await wallets.save(
          wallets.create({ userId, workspaceId, name: 'Euro till', currency: 'EUR', initialBalance: 70 }),
        )
      ).id;
      const pounds = (
        await wallets.save(
          wallets.create({ userId, workspaceId, name: 'Pounds', currency: 'GBP', initialBalance: 100 }),
        )
      ).id;

      await sync.syncWorkspace(workspaceId);

      expect(await walletOpening(euro)).toEqual([expect.objectContaining({ base_debit: '70.00' })]);
      expect(await walletOpening(pounds)).toEqual([]);
      // Queued again, but not retried straight away.
      const [flag] = await query<{ dirty: boolean; attempted: Date | null }>(
        `SELECT "ledger_openings_dirty" AS "dirty", "ledger_openings_attempted_at" AS "attempted"
           FROM "workspaces" WHERE "id" = $1`,
        [workspaceId],
      );
      expect(flag.dirty).toBe(true);
      expect(flag.attempted).not.toBeNull();
      expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);

      rates.GBP = 1.15;
      await query(
        `UPDATE "workspaces" SET "ledger_openings_attempted_at" = now() - interval '2 hours' WHERE "id" = $1`,
        [workspaceId],
      );
      expect(await sync.workspacesNeedingSync()).toContain(workspaceId);
      await sync.syncWorkspace(workspaceId);

      expect(await walletOpening(pounds)).toEqual([expect.objectContaining({ base_debit: '115.00' })]);
      expect(await sync.workspacesNeedingSync()).not.toContain(workspaceId);
    });

    it('lets a workspace with wallets be deleted', async () => {
      const doomed = (await dataSource.getRepository(Workspace).save({ name: 'Doomed WS', currency: 'USD' })).id;
      const wallets = dataSource.getRepository(Wallet);
      await wallets.save(
        wallets.create({ userId, workspaceId: doomed, name: 'W', currency: 'EUR', initialBalance: 1 }),
      );
      await expect(dataSource.getRepository(Workspace).delete(doomed)).resolves.toBeDefined();
    });
  });

  it('keeps every booked entry balanced through all of it', async () => {
    expect((await sync.integrity(workspaceId)).unbalancedEntries).toBe(0);
  });
});
