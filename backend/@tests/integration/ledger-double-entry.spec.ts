/**
 * Integration test — the double-entry invariant is enforced by Postgres itself.
 *
 * The balance check is a DEFERRABLE INITIALLY DEFERRED constraint trigger, so it
 * runs at COMMIT. Two consequences shape this file:
 *
 * - Mocked repositories cannot exercise it at all, hence a real database built
 *   by the real migrations.
 * - A test that rolls its transaction back never reaches the check and passes
 *   vacuously. Every case here therefore really commits (or forces the check
 *   with `SET CONSTRAINTS ALL IMMEDIATE`), on a scratch database created next to
 *   DATABASE_URL and dropped afterwards, so dev data is never touched.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { CreateLedger1786420000000 } from '../../src/migrations/1786420000000-CreateLedger';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_ledger_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

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

type Leg = { account: string; debit?: number; credit?: number };

describe('ledger double-entry invariant (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let db: Client;
  let entryNo = 0;

  let workspaceId: string;
  let cash: string;
  let expense: string;
  let header: string;
  let categoryId: string;

  async function createWorkspace(): Promise<string> {
    const { rows } = await db.query(
      `INSERT INTO "workspaces" ("name", "currency") VALUES ('ledger test', 'USD') RETURNING "id"`,
    );
    return rows[0].id;
  }

  async function createAccount(
    ws: string,
    code: string,
    type: 'asset' | 'expense',
    options: { postable?: boolean; currency?: string } = {},
  ): Promise<string> {
    const { rows } = await db.query(
      `INSERT INTO "ledger_accounts"
         ("workspace_id", "code", "name", "account_type", "normal_balance", "is_postable", "currency")
       VALUES ($1, $2, $2, $3, 'debit', $4, $5) RETURNING "id"`,
      [ws, code, type, options.postable ?? true, options.currency ?? null],
    );
    return rows[0].id;
  }

  async function insertDraft(
    ws: string,
    options: { source?: string; sourceTransactionId?: string; reversalOf?: string } = {},
  ): Promise<string> {
    const { rows } = await db.query(
      `INSERT INTO "journal_entries"
         ("workspace_id", "entry_date", "base_currency", "source", "source_transaction_id", "reversal_of_id")
       VALUES ($1, '2026-09-01', 'EUR', $2, $3, $4) RETURNING "id"`,
      [ws, options.source ?? 'manual', options.sourceTransactionId ?? null, options.reversalOf ?? null],
    );
    return rows[0].id;
  }

  async function insertLines(entryId: string, legs: Leg[], currency = 'EUR'): Promise<void> {
    for (const [index, leg] of legs.entries()) {
      await db.query(
        `INSERT INTO "journal_lines"
           ("entry_id", "line_no", "account_id", "debit", "credit", "currency", "base_debit", "base_credit", "category_id")
         VALUES ($1, $2, $3, $4, $5, $6, $4, $5, $7)`,
        [entryId, index + 1, leg.account, leg.debit ?? 0, leg.credit ?? 0, currency, categoryId],
      );
    }
  }

  async function markPosted(entryId: string): Promise<void> {
    entryNo += 1;
    await db.query(
      `UPDATE "journal_entries" SET "status" = 'posted', "entry_no" = $2, "posted_at" = now() WHERE "id" = $1`,
      [entryId, entryNo],
    );
  }

  /** Draft -> lines -> posted, committed as one transaction. */
  async function book(
    legs: Leg[],
    options: { ws?: string; sourceTransactionId?: string; reversalOf?: string } = {},
  ): Promise<string> {
    await db.query('BEGIN');
    try {
      const entryId = await insertDraft(options.ws ?? workspaceId, {
        source: options.sourceTransactionId ? 'transaction' : 'manual',
        sourceTransactionId: options.sourceTransactionId,
        reversalOf: options.reversalOf,
      });
      await insertLines(entryId, legs);
      await markPosted(entryId);
      await db.query('COMMIT');
      return entryId;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  async function commitFails(work: () => Promise<unknown>): Promise<string> {
    await db.query('BEGIN');
    try {
      await work();
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK').catch(() => undefined);
      return (error as Error).message;
    }
    throw new Error('expected the transaction to be rejected, but it committed');
  }

  async function count(sql: string, params: unknown[] = []): Promise<number> {
    const { rows } = await db.query(sql, params);
    return Number(rows[0].count);
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
      entities: [],
      migrations: loadMigrations(),
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    db = new Client({ connectionString: scratchUrl(SCRATCH_DB) });
    await db.connect();

    workspaceId = await createWorkspace();
    cash = await createAccount(workspaceId, 'CASH_EUR', 'asset', { currency: 'EUR' });
    expense = await createAccount(workspaceId, 'EXPENSE_FOOD', 'expense');
    header = await createAccount(workspaceId, 'EXPENSES', 'expense', { postable: false });
    const { rows } = await db.query(
      `INSERT INTO "categories" ("workspace_id", "name", "type") VALUES ($1, 'Food', 'expense') RETURNING "id"`,
      [workspaceId],
    );
    categoryId = rows[0].id;
  });

  afterAll(async () => {
    await db?.end();
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('commits a balanced entry even though its lines arrive one by one', async () => {
    const entryId = await book([
      { account: expense, debit: 12.5 },
      { account: cash, credit: 12.5 },
    ]);

    const { rows } = await db.query(
      `SELECT sum("base_debit") AS d, sum("base_credit") AS c FROM "journal_lines" WHERE "entry_id" = $1`,
      [entryId],
    );
    expect(rows[0]).toEqual({ d: '12.50', c: '12.50' });
  });

  it('rejects an entry that is off by one cent at COMMIT and keeps nothing', async () => {
    const before = await count(`SELECT count(*) FROM "journal_entries"`);

    const message = await commitFails(async () => {
      const entryId = await insertDraft(workspaceId);
      await insertLines(entryId, [
        { account: expense, debit: 10 },
        { account: cash, credit: 9.99 },
      ]);
      await markPosted(entryId);
    });

    expect(message).toMatch(/unbalanced by 0\.01/);
    expect(await count(`SELECT count(*) FROM "journal_entries"`)).toBe(before);
  });

  it('surfaces the check before COMMIT only when constraints are forced immediate', async () => {
    await db.query('BEGIN');
    try {
      const entryId = await insertDraft(workspaceId);
      await insertLines(entryId, [
        { account: expense, debit: 10 },
        { account: cash, credit: 9 },
      ]);
      // Still inside the transaction: the deferred trigger has not run yet.
      await markPosted(entryId);
      await expect(db.query('SET CONSTRAINTS ALL IMMEDIATE')).rejects.toThrow(/unbalanced by 1\.00/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('rejects a booked entry with a single line', async () => {
    const message = await commitFails(async () => {
      const entryId = await insertDraft(workspaceId);
      await insertLines(entryId, [{ account: expense, debit: 5 }]);
      await markPosted(entryId);
    });
    expect(message).toMatch(/needs at least two/);
  });

  it('checks a draft promoted to posted in a later transaction without touching its lines', async () => {
    await db.query('BEGIN');
    const entryId = await insertDraft(workspaceId);
    await insertLines(entryId, [
      { account: expense, debit: 7 },
      { account: cash, credit: 3 },
    ]);
    // Unbalanced drafts are legal: they are work in progress.
    await db.query('COMMIT');

    const message = await commitFails(() => markPosted(entryId));
    expect(message).toMatch(/unbalanced by 4\.00/);

    await db.query(`DELETE FROM "journal_entries" WHERE "id" = $1`, [entryId]);
  });

  it('refuses lines on a header account or on another workspace account', async () => {
    const otherWorkspace = await createWorkspace();
    const foreignCash = await createAccount(otherWorkspace, 'CASH_EUR', 'asset');

    await expect(
      book([
        { account: header, debit: 1 },
        { account: cash, credit: 1 },
      ]),
    ).rejects.toThrow(/not postable here/);

    await expect(
      book([
        { account: expense, debit: 1 },
        { account: foreignCash, credit: 1 },
      ]),
    ).rejects.toThrow(/not postable here/);
  });

  it('refuses a line in a currency other than its account currency', async () => {
    const message = await commitFails(async () => {
      const entryId = await insertDraft(workspaceId);
      // Balanced in base currency; only the cash leg's currency is wrong.
      await db.query(
        `INSERT INTO "journal_lines"
           ("entry_id", "line_no", "account_id", "debit", "credit", "currency", "base_debit", "base_credit", "fx_rate")
         VALUES ($1, 1, $2, 10, 0, 'USD', 9, 0, 0.9), ($1, 2, $3, 0, 10, 'USD', 0, 9, 0.9)`,
        [entryId, expense, cash],
      );
      await markPosted(entryId);
    });
    expect(message).toMatch(/not postable here/);
  });

  it('refuses a line with both sides or neither side filled', async () => {
    const entryId = await insertDraft(workspaceId);
    await expect(
      db.query(
        `INSERT INTO "journal_lines" ("entry_id", "line_no", "account_id", "debit", "credit", "currency")
         VALUES ($1, 1, $2, 1, 1, 'EUR')`,
        [entryId, expense],
      ),
    ).rejects.toThrow(/CHK_journal_lines_one_side/);
    await expect(
      db.query(
        `INSERT INTO "journal_lines" ("entry_id", "line_no", "account_id", "debit", "credit", "currency")
         VALUES ($1, 1, $2, 0, 0, 'EUR')`,
        [entryId, expense],
      ),
    ).rejects.toThrow(/CHK_journal_lines_one_side/);
    await db.query(`DELETE FROM "journal_entries" WHERE "id" = $1`, [entryId]);
  });

  describe('booked entries are immutable', () => {
    let entryId: string;

    beforeAll(async () => {
      entryId = await book([
        { account: expense, debit: 20 },
        { account: cash, credit: 20 },
      ]);
    });

    it('refuses to change, add or remove a line', async () => {
      await expect(
        db.query(`UPDATE "journal_lines" SET "debit" = 21, "base_debit" = 21 WHERE "entry_id" = $1 AND "line_no" = 1`, [
          entryId,
        ]),
      ).rejects.toThrow(/immutable/);
      await expect(
        db.query(`DELETE FROM "journal_lines" WHERE "entry_id" = $1 AND "line_no" = 2`, [entryId]),
      ).rejects.toThrow(/immutable/);
      await expect(insertLines(entryId, [{ account: expense, debit: 1 }])).rejects.toThrow(
        /immutable/,
      );
    });

    it('refuses to delete the entry or to rewrite its date', async () => {
      await expect(db.query(`DELETE FROM "journal_entries" WHERE "id" = $1`, [entryId])).rejects.toThrow(
        /cannot be deleted/,
      );
      await expect(
        db.query(`UPDATE "journal_entries" SET "entry_date" = '2026-01-01' WHERE "id" = $1`, [entryId]),
      ).rejects.toThrow(/only posted -> reversed/);
    });

    it('lets a deleted category null its analytics link', async () => {
      const { rows } = await db.query(
        `INSERT INTO "categories" ("workspace_id", "name", "type") VALUES ($1, 'Temp', 'expense') RETURNING "id"`,
        [workspaceId],
      );
      await db.query(`UPDATE "journal_lines" SET "category_id" = NULL WHERE "entry_id" = $1`, [entryId]);
      // Re-pointing a booked line at a new category is analytics, not money.
      await db.query(`UPDATE "journal_lines" SET "category_id" = $2 WHERE "entry_id" = $1`, [
        entryId,
        rows[0].id,
      ]);
      await db.query(`DELETE FROM "categories" WHERE "id" = $1`, [rows[0].id]);

      expect(
        await count(
          `SELECT count(*) FROM "journal_lines" WHERE "entry_id" = $1 AND "category_id" IS NULL`,
          [entryId],
        ),
      ).toBe(2);
    });

    it('lets a deleted user unlink from the entry, but not be swapped for another', async () => {
      const insertUser = async () =>
        (
          await db.query(
            `INSERT INTO "users" ("email", "password_hash", "name") VALUES ($1, 'x', 'Poster') RETURNING "id"`,
            [`${randomUUID()}@ledger.test`],
          )
        ).rows[0].id;
      const poster = await insertUser();

      await db.query('BEGIN');
      const draft = await insertDraft(workspaceId);
      await db.query(`UPDATE "journal_entries" SET "posted_by" = $2 WHERE "id" = $1`, [draft, poster]);
      await insertLines(draft, [
        { account: expense, debit: 3 },
        { account: cash, credit: 3 },
      ]);
      await markPosted(draft);
      await db.query('COMMIT');

      await expect(
        db.query(`UPDATE "journal_entries" SET "posted_by" = $2 WHERE "id" = $1`, [draft, await insertUser()]),
      ).rejects.toThrow(/only posted -> reversed/);

      await db.query(`DELETE FROM "users" WHERE "id" = $1`, [poster]);
      expect(
        await count(`SELECT count(*) FROM "journal_entries" WHERE "id" = $1 AND "posted_by" IS NULL`, [draft]),
      ).toBe(1);
    });

    it('moves posted -> reversed once, and never back', async () => {
      const reversal = await book(
        [
          { account: cash, debit: 20 },
          { account: expense, credit: 20 },
        ],
        { reversalOf: entryId },
      );
      await db.query(`UPDATE "journal_entries" SET "status" = 'reversed' WHERE "id" = $1`, [entryId]);

      await expect(
        db.query(`UPDATE "journal_entries" SET "status" = 'posted' WHERE "id" = $1`, [entryId]),
      ).rejects.toThrow(/only posted -> reversed/);
      // One reversal per entry.
      await expect(
        book(
          [
            { account: cash, debit: 20 },
            { account: expense, credit: 20 },
          ],
          { reversalOf: entryId },
        ),
      ).rejects.toThrow(/UQ_journal_entries_reversal_of/);
      expect(reversal).toBeDefined();
    });
  });

  it('keeps one live entry per transaction, but lets a reversal share the source', async () => {
    const { rows } = await db.query(
      `INSERT INTO "transactions"
         ("workspace_id", "transaction_date", "counterparty_name", "payment_purpose",
          "transaction_type", "currency")
       VALUES ($1, '2026-09-01', 'Shop', 'Groceries', 'expense', 'USD') RETURNING "id"`,
      [workspaceId],
    );
    const transactionId = rows[0].id;
    const legs = [
      { account: expense, debit: 8 },
      { account: cash, credit: 8 },
    ];

    const original = await book(legs, { sourceTransactionId: transactionId });
    await expect(book(legs, { sourceTransactionId: transactionId })).rejects.toThrow(
      /UQ_journal_entries_live_transaction/,
    );

    // Re-posting: reverse the old entry and book the new one in one transaction.
    await db.query('BEGIN');
    const reversal = await insertDraft(workspaceId, {
      source: 'transaction',
      sourceTransactionId: transactionId,
      reversalOf: original,
    });
    await insertLines(reversal, [
      { account: cash, debit: 8 },
      { account: expense, credit: 8 },
    ]);
    await markPosted(reversal);
    await db.query(`UPDATE "journal_entries" SET "status" = 'reversed' WHERE "id" = $1`, [original]);
    const replacement = await insertDraft(workspaceId, {
      source: 'transaction',
      sourceTransactionId: transactionId,
    });
    await insertLines(replacement, legs);
    await markPosted(replacement);
    await db.query('COMMIT');

    // Transactions are hard-deleted; the booked entries survive, unlinked.
    await db.query(`DELETE FROM "transactions" WHERE "id" = $1`, [transactionId]);
    expect(
      await count(`SELECT count(*) FROM "journal_entries" WHERE "id" = ANY($1) AND "source_transaction_id" IS NULL`, [
        [original, reversal, replacement],
      ]),
    ).toBe(3);
  });

  it('lets a workspace with booked entries be deleted', async () => {
    const ws = await createWorkspace();
    const wsCash = await createAccount(ws, 'CASH', 'asset');
    const wsParent = await createAccount(ws, 'EXPENSES', 'expense', { postable: false });
    const wsExpense = await createAccount(ws, 'EXPENSE_RENT', 'expense');
    await db.query(`UPDATE "ledger_accounts" SET "parent_id" = $2 WHERE "id" = $1`, [wsExpense, wsParent]);
    await book(
      [
        { account: wsExpense, debit: 100 },
        { account: wsCash, credit: 100 },
      ],
      { ws },
    );

    await db.query(`DELETE FROM "workspaces" WHERE "id" = $1`, [ws]);

    expect(await count(`SELECT count(*) FROM "ledger_accounts" WHERE "workspace_id" = $1`, [ws])).toBe(0);
    expect(await count(`SELECT count(*) FROM "journal_entries" WHERE "workspace_id" = $1`, [ws])).toBe(0);
  });

  it('still refuses to hard-delete an account that has lines', async () => {
    // The account foreign key is deferred for the workspace cascade; outside
    // that cascade it must still hold, only at COMMIT instead of at once.
    await expect(db.query(`DELETE FROM "ledger_accounts" WHERE "id" = $1`, [cash])).rejects.toThrow(
      /FK_journal_lines_account/,
    );
  });

  it('refuses a parent account from another workspace', async () => {
    const otherWorkspace = await createWorkspace();
    const foreignHeader = await createAccount(otherWorkspace, 'EXPENSES', 'expense', { postable: false });
    await expect(
      db.query(`UPDATE "ledger_accounts" SET "parent_id" = $2 WHERE "id" = $1`, [expense, foreignHeader]),
    ).rejects.toThrow(/FK_ledger_accounts_parent/);
  });

  it('numbers entries per workspace without gaps for drafts', async () => {
    const ws = await createWorkspace();
    await db.query(`INSERT INTO "ledger_counters" ("workspace_id") VALUES ($1)`, [ws]);
    const next = async () =>
      (
        await db.query(
          `UPDATE "ledger_counters" SET "next_entry_no" = "next_entry_no" + 1
            WHERE "workspace_id" = $1 RETURNING "next_entry_no" - 1 AS "taken"`,
          [ws],
        )
      ).rows[0].taken;

    expect([await next(), await next()]).toEqual(['1', '2']);
    // A draft has no number, so two drafts do not collide on the unique key.
    await insertDraft(ws);
    await insertDraft(ws);
    expect(
      await count(`SELECT count(*) FROM "journal_entries" WHERE "workspace_id" = $1 AND "entry_no" IS NULL`, [ws]),
    ).toBe(2);
  });

  it('reverts cleanly', async () => {
    // CreateLedger and every ledger migration built on it, undone newest first
    // as a real rollback would, then re-applied.
    const timestampOf = (migration: object) =>
      Number(/\d{13}$/.exec(migration.constructor.name)?.[0] ?? 0);
    const stack = dataSource.migrations
      .filter(migration => timestampOf(migration) >= 1786420000000)
      .sort((a, b) => timestampOf(a) - timestampOf(b));
    expect(stack[0]).toBeInstanceOf(CreateLedger1786420000000);
    const queryRunner = dataSource.createQueryRunner();
    for (const migration of [...stack].reverse()) {
      await migration.down(queryRunner);
    }
    const { rows } = await db.query(
      `SELECT to_regclass('journal_lines') AS lines, to_regclass('ledger_accounts') AS accounts`,
    );
    expect(rows[0]).toEqual({ lines: null, accounts: null });
    expect(
      await count(
        `SELECT count(*) FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'ledger_account_id'`,
      ),
    ).toBe(0);
    for (const migration of stack) {
      await migration.up(queryRunner);
    }
    await queryRunner.release();
  });
});
