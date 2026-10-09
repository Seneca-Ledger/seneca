/**
 * Integration test — the posting engine against a real Postgres.
 *
 * The rules are unit-tested as pure functions; what only a database can show
 * is that the entries the engine writes are ones the CreateLedger triggers
 * accept (balanced at COMMIT, posted through the draft -> posted sequence,
 * immutable afterwards), that re-posting is idempotent, and that corrections
 * arrive as reversal pairs. Real services, real migrations, a scratch database
 * next to DATABASE_URL; only the exchange-rate lookup is stubbed.
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
  BankName,
  Category,
  CategoryType,
  CryptoWallet,
  ExchangeRate,
  FileType,
  JournalEntry,
  JournalEntryStatus,
  LedgerAccount,
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import {
  ExchangeRatesService,
  type RateQuoteOptions,
} from '../../src/modules/exchange-rates/exchange-rates.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import {
  categoryAccountCode,
  LEDGER_ACCOUNT_CODES,
} from '../../src/modules/ledger/ledger-default-accounts';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_ledger_posting_${process.pid}`;

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

const USD_EUR = 0.9137;
const IBAN = 'DE89 3704 0044 0532 0130 00';

describe('ledger posting engine (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let posting: LedgerPostingService;
  let accounts: LedgerAccountsService;
  let txRepo: Repository<Transaction>;
  let entryRepo: Repository<JournalEntry>;

  let workspaceId: string;
  let userId: string;
  let eurStatementId: string;
  let usdStatementId: string;
  const category: Record<string, string> = {};
  const tx: Record<string, string> = {};
  let system: Record<string, string>;

  /** Called by the posting service; a test may swap the behaviour. */
  let onRateLookup: (from: string, to: string, date: string) => Promise<number | null>;
  const exchangeStub = {
    getRateQuote: jest.fn(
      async (from: string, to: string, date: string, _options?: RateQuoteOptions) => {
        const rate = await onRateLookup(from, to, date);
        return rate === null ? null : { rate, rateDate: date, stale: false };
      },
    ),
  };
  const defaultRates = async (from: string, to: string) =>
    from === 'USD' && to === 'EUR' ? USD_EUR : null;

  const query = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    dataSource.query(sql, params) as Promise<T[]>;

  async function insertTransaction(fields: Partial<Transaction>): Promise<string> {
    const saved = await txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date('2026-03-10'),
        counterpartyName: 'Counterparty',
        paymentPurpose: 'Purpose',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        // Booked rows are confirmed ones; a test about unconfirmed rows overrides it.
        isVerified: true,
        ...fields,
      }),
    );
    return saved.id;
  }

  async function linesOf(entryId: string) {
    return query<{ code: string; debit: string; credit: string; base_debit: string; base_credit: string; fx_rate: string; currency: string }>(
      `SELECT a."code", l."debit", l."credit", l."base_debit", l."base_credit", l."fx_rate", l."currency"
         FROM "journal_lines" l JOIN "ledger_accounts" a ON a."id" = l."account_id"
        WHERE l."entry_id" = $1 ORDER BY l."line_no"`,
      [entryId],
    );
  }

  async function accountBalance(accountId: string): Promise<string> {
    const [row] = await query<{ balance: string }>(
      `SELECT coalesce(sum(l."base_debit" - l."base_credit"), 0)::numeric(15,2) AS balance
         FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE l."account_id" = $1 AND e."status" <> 'draft'`,
      [accountId],
    );
    return row.balance;
  }

  const entryCount = async () =>
    Number((await query<{ n: string }>(`SELECT count(*) AS n FROM "journal_entries"`))[0].n);

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
        LedgerPostingService,
        LedgerAccountsService,
        { provide: ExchangeRatesService, useValue: exchangeStub },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    posting = moduleRef.get(LedgerPostingService);
    accounts = moduleRef.get(LedgerAccountsService);
    txRepo = dataSource.getRepository(Transaction);
    entryRepo = dataSource.getRepository(JournalEntry);
    onRateLookup = defaultRates;

    const workspace = await dataSource.getRepository(Workspace).save({ name: 'Ledger WS', currency: 'USD' });
    workspaceId = workspace.id;
    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: `ledger-${randomUUID()}@example.com`,
        passwordHash: 'x',
        name: 'Ledger Tester',
        workspaceId,
      }),
    );
    userId = user.id;

    const statementRepo = dataSource.getRepository(Statement);
    const statement = (currency: string, accountNumber: string, balanceStart: number | null) =>
      statementRepo.save(
        statementRepo.create({
          userId,
          workspaceId,
          fileName: `${currency}.pdf`,
          filePath: `/tmp/${currency}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          accountNumber,
          currency,
          balanceStart,
          statementDateFrom: new Date('2026-01-01'),
        }),
      );
    eurStatementId = (await statement('EUR', IBAN, 1000)).id;
    usdStatementId = (await statement('USD', 'US-9999', null)).id;

    const categoryRepo = dataSource.getRepository(Category);
    const addCategory = async (name: string, type: CategoryType, parentId: string | null = null) =>
      (await categoryRepo.save(categoryRepo.create({ workspaceId, userId, name, type, parentId }))).id;
    category.food = await addCategory('Food', CategoryType.EXPENSE);
    category.groceries = await addCategory('Groceries', CategoryType.EXPENSE, category.food);
    category.salary = await addCategory('Salary', CategoryType.INCOME);
    category.consulting = await addCategory('Consulting', CategoryType.INCOME);

    tx.taxedExpense = await insertTransaction({
      amount: 121,
      debit: 121,
      taxAmount: 21,
      taxNetAmount: 100,
      categoryId: category.groceries,
      statementId: eurStatementId,
    });
    tx.income = await insertTransaction({
      transactionType: TransactionType.INCOME,
      amount: 500,
      credit: 500,
      categoryId: category.salary,
      statementId: eurStatementId,
    });
    tx.uncategorised = await insertTransaction({
      amount: 40,
      debit: 40,
      statementId: eurStatementId,
    });
    tx.nowhere = await insertTransaction({ amount: 15, debit: 15, categoryId: category.food });
    tx.duplicate = await insertTransaction({
      amount: 99,
      debit: 99,
      isDuplicate: true,
      statementId: eurStatementId,
    });
    tx.dollars = await insertTransaction({
      amount: 1234.57,
      debit: 1234.57,
      taxAmount: 214.26,
      currency: 'USD',
      categoryId: category.food,
      statementId: usdStatementId,
    });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('refuses to post while the ledger has no base currency', async () => {
    await expect(posting.postTransaction(workspaceId, tx.income)).rejects.toMatchObject({
      code: 'LEDGER_DISABLED',
    });
    expect(await entryCount()).toBe(0);

    await dataSource.getRepository(Workspace).update(workspaceId, { ledgerBaseCurrency: 'EUR' });
    system = await accounts.systemAccountIds(workspaceId);
  });

  it('books every row of the posting table', async () => {
    const outcomes = {
      taxedExpense: await posting.postTransaction(workspaceId, tx.taxedExpense),
      income: await posting.postTransaction(workspaceId, tx.income),
      uncategorised: await posting.postTransaction(workspaceId, tx.uncategorised),
      nowhere: await posting.postTransaction(workspaceId, tx.nowhere),
      duplicate: await posting.postTransaction(workspaceId, tx.duplicate),
      dollars: await posting.postTransaction(workspaceId, tx.dollars),
    };

    expect(outcomes.duplicate).toEqual({ status: 'skipped', reason: 'duplicate' });
    for (const key of ['taxedExpense', 'income', 'uncategorised', 'nowhere', 'dollars'] as const) {
      expect(outcomes[key].status).toBe('posted');
    }
    const id = (key: keyof typeof outcomes) => (outcomes[key] as { entryId: string }).entryId;

    // A sub-category books to its parent's account; tax to VAT receivable.
    const foodCode = (
      await dataSource.getRepository(LedgerAccount).findOneByOrFail({
        id: (await dataSource.getRepository(Category).findOneByOrFail({ id: category.food })).ledgerAccountId ?? '',
      })
    ).code;
    const taxed = await linesOf(id('taxedExpense'));
    expect(taxed.map(line => [line.code, line.debit, line.credit])).toEqual([
      [foodCode, '100.00', '0.00'],
      [LEDGER_ACCOUNT_CODES.VAT_RECEIVABLE, '21.00', '0.00'],
      [expect.stringMatching(/^CASH_[0-9A-F]{8}$/), '0.00', '121.00'],
    ]);

    expect((await linesOf(id('uncategorised')))[0].code).toBe(LEDGER_ACCOUNT_CODES.SUSPENSE);
    expect((await linesOf(id('nowhere')))[1].code).toBe(LEDGER_ACCOUNT_CODES.CASH_UNALLOCATED);

    // USD converted at the posting date's rate; the cash leg is the exact conversion.
    const dollars = await linesOf(id('dollars'));
    expect(dollars.every(line => line.currency === 'USD' && line.fx_rate === '0.91370000')).toBe(true);
    const cashLeg = dollars[2];
    expect(cashLeg.base_credit).toBe((Math.round(123457 * USD_EUR) / 100).toFixed(2));
    const debits = dollars.reduce((sum, line) => sum + Math.round(Number(line.base_debit) * 100), 0);
    const credits = dollars.reduce((sum, line) => sum + Math.round(Number(line.base_credit) * 100), 0);
    expect(debits).toBe(credits);

    // Gap-free numbering in posting order.
    const numbers = await query<{ entry_no: string }>(
      `SELECT "entry_no" FROM "journal_entries" WHERE "workspace_id" = $1 ORDER BY "entry_no"`,
      [workspaceId],
    );
    expect(numbers.map(row => row.entry_no)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('names cash accounts with the account number masked and keys them without it', async () => {
    const cash = await query<{ name: string; statement_account_key: string; currency: string }>(
      `SELECT "name", "statement_account_key", "currency" FROM "ledger_accounts"
        WHERE "workspace_id" = $1 AND "statement_account_key" IS NOT NULL ORDER BY "currency"`,
      [workspaceId],
    );
    expect(cash.map(row => [row.name, row.currency])).toEqual([
      ['Other ····3000 · EUR', 'EUR'],
      ['Other ····9999 · USD', 'USD'],
    ]);
    for (const row of cash) {
      expect(row.statement_account_key).toMatch(/^statement:[0-9a-f]{64}$/);
    }
  });

  it('leaves an unchanged transaction alone', async () => {
    const before = await entryCount();
    await expect(posting.postTransaction(workspaceId, tx.taxedExpense)).resolves.toMatchObject({
      status: 'unchanged',
    });
    // A memo-only edit is not money and does not warrant a reversal pair.
    await txRepo.update(tx.taxedExpense, { paymentPurpose: 'Edited description' });
    await expect(posting.postTransaction(workspaceId, tx.taxedExpense)).resolves.toMatchObject({
      status: 'unchanged',
    });
    expect(await entryCount()).toBe(before);
  });

  it('corrects a recategorised transaction with a reversal pair', async () => {
    const [original] = await query<{ id: string }>(
      `SELECT "id" FROM "journal_entries" WHERE "source_transaction_id" = $1`,
      [tx.income],
    );
    await txRepo.update(tx.income, { categoryId: category.consulting });

    const outcome = await posting.postTransaction(workspaceId, tx.income);
    expect(outcome.status).toBe('reposted');

    const entries = await query<{ id: string; status: string; reversal_of_id: string | null }>(
      `SELECT "id", "status", "reversal_of_id" FROM "journal_entries"
        WHERE "source_transaction_id" = $1 ORDER BY "entry_no"`,
      [tx.income],
    );
    expect(entries.map(entry => [entry.status, entry.reversal_of_id])).toEqual([
      ['reversed', null],
      ['posted', original.id],
      ['posted', null],
    ]);

    const salaryAccount = await accounts.categoryAccountId(workspaceId, category.salary);
    const consultingAccount = await accounts.categoryAccountId(workspaceId, category.consulting);
    expect(await accountBalance(salaryAccount ?? '')).toBe('0.00');
    expect(await accountBalance(consultingAccount ?? '')).toBe('-500.00');
  });

  it('reverses a transaction that became a duplicate, once', async () => {
    await txRepo.update(tx.uncategorised, { isDuplicate: true });
    await expect(posting.postTransaction(workspaceId, tx.uncategorised)).resolves.toMatchObject({
      status: 'reversed',
    });
    await expect(posting.postTransaction(workspaceId, tx.uncategorised)).resolves.toEqual({
      status: 'skipped',
      reason: 'duplicate',
    });
    expect(await accountBalance(system[LEDGER_ACCOUNT_CODES.SUSPENSE])).toBe('0.00');
  });

  it('leaves out a trashed statement and books it again on restore', async () => {
    const statementRepo = dataSource.getRepository(Statement);
    const trashed = await statementRepo.save(
      statementRepo.create({
        userId,
        workspaceId,
        fileName: 'trash.pdf',
        filePath: '/tmp/trash.pdf',
        fileType: FileType.PDF,
        fileSize: 1,
        fileHash: randomUUID(),
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        accountNumber: IBAN,
        currency: 'EUR',
      }),
    );
    const inTrash = await insertTransaction({
      amount: 60,
      debit: 60,
      categoryId: category.food,
      statementId: trashed.id,
    });
    await expect(posting.postTransaction(workspaceId, inTrash)).resolves.toMatchObject({
      status: 'posted',
    });

    // Lists and reports hide a trashed statement's rows; the ledger follows.
    await statementRepo.update(trashed.id, { deletedAt: new Date() });
    await expect(posting.postTransaction(workspaceId, inTrash)).resolves.toMatchObject({
      status: 'reversed',
    });
    await expect(posting.postTransaction(workspaceId, inTrash)).resolves.toEqual({
      status: 'skipped',
      reason: 'statement_deleted',
    });

    await statementRepo.update(trashed.id, { deletedAt: null });
    await expect(posting.postTransaction(workspaceId, inTrash)).resolves.toMatchObject({
      status: 'posted',
    });
  });

  it('writes nothing when no exchange rate exists', async () => {
    const lira = await insertTransaction({ amount: 50, debit: 50, currency: 'TRY', categoryId: category.food });
    const before = await entryCount();
    await expect(posting.postTransaction(workspaceId, lira)).rejects.toMatchObject({
      code: 'FX_RATE_MISSING',
    });
    expect(await entryCount()).toBe(before);
  });

  it('borrows a rate from an earlier day only within the allowed age', async () => {
    // The real lookup over the scratch database; no API key and no network.
    const realRates = new ExchangeRatesService(
      dataSource.getRepository(ExchangeRate),
      { get: jest.fn().mockResolvedValue(undefined), set: jest.fn() } as never,
      { get: jest.fn().mockReturnValue(undefined) } as never,
    );
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    exchangeStub.getRateQuote.mockImplementation((from, to, date, options) =>
      realRates.getRateQuote(from, to, date, options),
    );
    try {
      await dataSource.getRepository(ExchangeRate).save([
        { baseCurrency: 'CHF', targetCurrency: 'EUR', rate: 1.05, source: 'test', rateDate: new Date('2025-03-01') },
        // Later than every booking below: must never be used for them.
        { baseCurrency: 'CHF', targetCurrency: 'EUR', rate: 9.99, source: 'test', rateDate: new Date('2025-06-01') },
      ]);
      const tooOld = await insertTransaction({
        amount: 10,
        debit: 10,
        currency: 'CHF',
        categoryId: category.food,
        transactionDate: new Date('2025-03-11'),
      });
      await expect(posting.postTransaction(workspaceId, tooOld)).rejects.toMatchObject({
        code: 'FX_RATE_MISSING',
      });

      const recent = await insertTransaction({
        amount: 10,
        debit: 10,
        currency: 'CHF',
        categoryId: category.food,
        transactionDate: new Date('2025-03-06'),
      });
      await expect(posting.postTransaction(workspaceId, recent)).resolves.toMatchObject({
        status: 'posted',
      });
      const [line] = await query<{ fx_rate: string }>(
        `SELECT l.fx_rate FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
          WHERE e.source_transaction_id = $1 AND l.currency = 'CHF' LIMIT 1`,
        [recent],
      );
      expect(Number(line.fx_rate)).toBe(1.05);
    } finally {
      fetchSpy.mockRestore();
      exchangeStub.getRateQuote.mockImplementation(async (from, to, date) => {
        const rate = await onRateLookup(from, to, date);
        return rate === null ? null : { rate, rateDate: date, stale: false };
      });
    }
  });

  it('refuses to book a transaction edited between planning and locking', async () => {
    const edited = await insertTransaction({
      amount: 10,
      debit: 10,
      currency: 'USD',
      statementId: usdStatementId,
    });
    onRateLookup = async (from, to) => {
      await txRepo.update(edited, { amount: 11, debit: 11 });
      return defaultRates(from, to);
    };
    try {
      await expect(posting.postTransaction(workspaceId, edited)).rejects.toMatchObject({
        code: 'TRANSACTION_CHANGED',
      });
    } finally {
      onRateLookup = defaultRates;
    }
    // A retry sees the new amount and books it.
    await expect(posting.postTransaction(workspaceId, edited)).resolves.toMatchObject({ status: 'posted' });
  });

  it('books a transaction once when two posters race for it', async () => {
    const raced = await insertTransaction({ amount: 7, debit: 7, statementId: eurStatementId });
    const outcomes = await Promise.all([
      posting.postTransaction(workspaceId, raced),
      posting.postTransaction(workspaceId, raced),
    ]);
    expect(outcomes.map(outcome => outcome.status).sort()).toEqual(['posted', 'unchanged']);
    const [{ n }] = await query<{ n: string }>(
      `SELECT count(*) AS n FROM "journal_entries" WHERE "source_transaction_id" = $1`,
      [raced],
    );
    expect(n).toBe('1');
  });

  it('books opening balances from the earliest statement, once', async () => {
    const results = await posting.postOpeningBalances(workspaceId);
    expect(results.map(result => result.outcome.status).sort()).toEqual(['posted', 'skipped']);
    const posted = results.find(result => result.outcome.status === 'posted');
    const entry = (posted?.outcome as { entryId: string }).entryId;
    expect((await linesOf(entry)).map(line => [line.code, line.debit, line.credit])).toEqual([
      [expect.stringMatching(/^CASH_/), '1000.00', '0.00'],
      [LEDGER_ACCOUNT_CODES.OPENING_BALANCE, '0.00', '1000.00'],
    ]);

    const again = await posting.postOpeningBalances(workspaceId);
    expect(again.find(result => result.cashAccountId === posted?.cashAccountId)?.outcome).toEqual({
      status: 'unchanged',
      entryId: entry,
    });
  });

  it('reverses a posted entry on request, but not a reversal or a reversed entry', async () => {
    const [opening] = await query<{ id: string }>(
      `SELECT "id" FROM "journal_entries" WHERE "source" = 'opening_balance' AND "status" = 'posted'`,
    );
    const reversal = await posting.reverseEntry(workspaceId, opening.id, {
      userId,
      date: '2026-09-24',
    });
    expect(reversal).toMatchObject({ reversalOfId: opening.id, entryDate: '2026-09-24', postedBy: userId });

    await expect(posting.reverseEntry(workspaceId, opening.id)).rejects.toMatchObject({
      code: 'NOT_REVERSIBLE',
    });
    await expect(posting.reverseEntry(workspaceId, reversal.id)).rejects.toMatchObject({
      code: 'NOT_REVERSIBLE',
    });
    await expect(posting.reverseEntry(randomUUID(), opening.id)).rejects.toThrow(/not found/);
  });

  it('books crypto transfers to the wallet own account, and reverses them when the wallet goes', async () => {
    const cryptoWallets = dataSource.getRepository(CryptoWallet);
    const cryptoWallet = await cryptoWallets.save(
      cryptoWallets.create({
        workspaceId,
        address: '0x1234567890abcdef1234567890abcdef12345678',
        label: null,
      }),
    );
    // Fiat value in the workspace currency; no category, like the chain sync writes it.
    const received = await insertTransaction({
      amount: 250,
      credit: 250,
      transactionType: TransactionType.INCOME,
      currency: 'EUR',
      cryptoWalletId: cryptoWallet.id,
      cryptoAsset: 'ETH',
      cryptoAmount: '0.1',
    });

    const outcome = await posting.postTransaction(workspaceId, received);

    expect(outcome).toMatchObject({ status: 'posted' });
    const [account] = await query<{ id: string; code: string; name: string; parent: string }>(
      `SELECT a."id", a."code", a."name", p."code" AS "parent"
         FROM "ledger_accounts" a JOIN "ledger_accounts" p ON p."id" = a."parent_id"
        WHERE a."crypto_wallet_id" = $1`,
      [cryptoWallet.id],
    );
    expect(account).toMatchObject({ parent: 'ASSET_CRYPTO', name: '0x1234…5678 · crypto' });
    expect(account.code).toMatch(/^CRYPTO_[0-9A-F]{8}$/);
    const lines = await query<{ account_id: string; base_debit: string }>(
      `SELECT l."account_id", l."base_debit" FROM "journal_lines" l
         JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE e."source_transaction_id" = $1 AND l."base_debit" > 0`,
      [received],
    );
    expect(lines).toEqual([{ account_id: account.id, base_debit: '250.00' }]);

    await cryptoWallets.delete(cryptoWallet.id);
    expect(await posting.reverseOrphans(workspaceId)).toBe(1);
  });

  it('books an invoice accrual entry across accounts receivable, revenue and VAT payable', async () => {
    const entry = await entryRepo.manager.transaction(manager =>
      posting.postInvoice(manager, {
        workspaceId,
        entryDate: '2026-03-15',
        currency: 'EUR',
        lines: [
          { amount: 100, taxAmount: 21, categoryId: category.consulting },
          { amount: 50, taxAmount: 0, categoryId: null },
        ],
        memo: 'Invoice INV-TEST-1',
      }),
    );

    expect(entry.status).toBe(JournalEntryStatus.POSTED);
    const lines = await linesOf(entry.id);
    const byCode = Object.fromEntries(lines.map(line => [line.code, line]));
    expect(byCode[LEDGER_ACCOUNT_CODES.RECEIVABLES]).toMatchObject({ debit: '171.00', credit: '0.00' });
    expect(byCode[LEDGER_ACCOUNT_CODES.VAT_PAYABLE]).toMatchObject({ credit: '21.00' });
    expect(byCode[categoryAccountCode('income', category.consulting)]).toMatchObject({
      credit: '100.00',
    });
    expect(byCode[LEDGER_ACCOUNT_CODES.SALES_REVENUE]).toMatchObject({ credit: '50.00' });
  });

  it('settles an invoice-sourced receivable against accounts receivable, not income', async () => {
    const payables = dataSource.getRepository(Payable);
    // A category is set on purpose: the override must still win over it.
    const settlement = await insertTransaction({
      amount: 300,
      credit: 300,
      transactionType: TransactionType.INCOME,
      categoryId: category.consulting,
      statementId: eurStatementId,
    });
    await payables.save(
      payables.create({
        workspaceId,
        vendor: 'Invoice client',
        amount: 300,
        currency: 'EUR',
        status: PayableStatus.PAID,
        direction: PayableDirection.RECEIVABLE,
        source: PayableSource.INVOICE,
        linkedTransactionId: settlement,
        isRecurring: false,
      }),
    );

    const outcome = await posting.postTransaction(workspaceId, settlement);
    expect(outcome).toMatchObject({ status: 'posted' });
    const entryId = (outcome as { entryId: string }).entryId;

    const codes = (await linesOf(entryId)).map(line => line.code);
    expect(codes).toContain(LEDGER_ACCOUNT_CODES.RECEIVABLES);
    expect(codes).not.toContain(categoryAccountCode('income', category.consulting));
  });

  it('leaves the whole ledger balanced, entry by entry', async () => {
    const unbalanced = await query(
      `SELECT e."id" FROM "journal_lines" l JOIN "journal_entries" e ON e."id" = l."entry_id"
        WHERE e."status" <> 'draft'
        GROUP BY e."id" HAVING sum(l."base_debit") <> sum(l."base_credit")`,
    );
    expect(unbalanced).toEqual([]);
    const drafts = await entryRepo.count({ where: { status: JournalEntryStatus.DRAFT } });
    expect(drafts).toBe(0);
  });
});
