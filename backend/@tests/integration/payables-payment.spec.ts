/**
 * Integration test — settling a bill, against a real Postgres.
 *
 * Which transactions count as a bill's payment is decided in SQL, and a cash
 * payment must become an ordinary transaction the ledger books; only a
 * database shows both. Scratch database, real migrations, real services;
 * notifications, exports and exchange rates are stubbed.
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
  Payable,
  PayableDirection,
  PayableStatus,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Wallet,
  Workspace,
} from '../../src/entities';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PayablesService } from '../../src/modules/payables/payables.service';
import { PayablesExportService } from '../../src/modules/payables/payables-export.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_payables_payment_${process.pid}`;

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

const daysAgo = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

describe('settling payables (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let payables: PayablesService;
  let posting: LedgerPostingService;
  let txRepo: Repository<Transaction>;
  let payableRepo: Repository<Payable>;
  let workspaceId: string;
  let userId: string;
  let walletId: string;
  let categoryId: string;
  let statementId: string;

  const query = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    dataSource.query(sql, params) as Promise<T[]>;

  const transaction = (fields: Partial<Transaction>) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        transactionDate: new Date(daysAgo(3)),
        counterpartyName: 'Someone',
        paymentPurpose: 'Payment',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        amount: 120,
        debit: 120,
        // Only a confirmed bank row may settle a bill.
        isVerified: true,
        ...fields,
      }),
    );

  const bill = (fields: Partial<Payable> = {}) =>
    payableRepo.save(
      payableRepo.create({
        workspaceId,
        createdById: userId,
        vendor: 'Acme',
        amount: 120,
        currency: 'EUR',
        dueDate: new Date(daysAgo(2)),
        status: PayableStatus.TO_PAY,
        ...fields,
      }),
    );

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
        PayablesService,
        WorkspaceCurrencyService,
        LedgerPostingService,
        LedgerAccountsService,
        { provide: ExchangeRatesService, useValue: { getRateQuote: jest.fn(), getRate: jest.fn() } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: jest.fn() } },
        { provide: PayablesExportService, useValue: {} },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    payables = moduleRef.get(PayablesService);
    posting = moduleRef.get(LedgerPostingService);
    txRepo = dataSource.getRepository(Transaction);
    payableRepo = dataSource.getRepository(Payable);

    workspaceId = (
      await dataSource
        .getRepository(Workspace)
        .save({ name: 'Bills WS', currency: 'EUR', ledgerBaseCurrency: 'EUR' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `bills-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Bills Tester',
          workspaceId,
        }),
      )
    ).id;
    const wallets = dataSource.getRepository(Wallet);
    walletId = (
      await wallets.save(wallets.create({ userId, workspaceId, name: 'Till', currency: 'EUR' }))
    ).id;
    categoryId = (
      await dataSource
        .getRepository(Category)
        .save({ workspaceId, userId, name: 'Services', type: CategoryType.EXPENSE })
    ).id;
    statementId = (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'bank.pdf',
          filePath: '/tmp/bank.pdf',
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          accountNumber: 'DE00 1',
          currency: 'EUR',
        }),
      )
    ).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  it('suggests matching payments, the ones naming the vendor first', async () => {
    const payable = await bill();
    const named = await transaction({ counterpartyName: 'ACME GmbH', transactionDate: new Date(daysAgo(10)) });
    const closest = await transaction({ transactionDate: new Date(daysAgo(2)) });
    // Offered too, but last: money of about the right size is a candidate since
    // partial payments exist — it just sorts behind the exact matches.
    const near = await transaction({ amount: 121, debit: 121 });
    // Not candidates: other currency, income, a duplicate, too old, on a
    // trashed statement, already settling another bill.
    await transaction({ currency: 'USD' });
    await transaction({ transactionType: TransactionType.INCOME, debit: null, credit: 120 });
    await transaction({ isDuplicate: true });
    await transaction({ transactionDate: new Date(daysAgo(40)) });
    const trashed = await dataSource.getRepository(Statement).save(
      dataSource.getRepository(Statement).create({
        userId,
        workspaceId,
        fileName: 'old.pdf',
        filePath: '/tmp/old.pdf',
        fileType: FileType.PDF,
        fileSize: 1,
        fileHash: randomUUID(),
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        currency: 'EUR',
        deletedAt: new Date(),
      }),
    );
    await transaction({ statementId: trashed.id });
    const taken = await transaction({ statementId });
    await bill({ linkedTransactionId: taken.id, status: PayableStatus.PAID });

    const candidates = await payables.findPaymentCandidates(payable.id, workspaceId);

    expect(candidates.map(candidate => candidate.id)).toEqual([named.id, closest.id, near.id]);
    expect(candidates[0]).toMatchObject({ vendorMatch: true, amount: '120.00', currency: 'EUR' });
  });

  it('records a cash payment as a wallet transaction the ledger books', async () => {
    const payable = await bill({ comment: 'May invoice' });

    const paid = await payables.markAsPaid(payable.id, workspaceId, userId, {
      payFromWalletId: walletId,
      paidOn: daysAgo(1),
      categoryId,
    });

    expect(paid).toMatchObject({ status: PayableStatus.PAID });
    const created = await txRepo.findOneByOrFail({ id: paid.linkedTransactionId as string });
    expect(created).toMatchObject({
      walletId,
      statementId: null,
      categoryId,
      currency: 'EUR',
      transactionType: TransactionType.EXPENSE,
      counterpartyName: 'Acme',
      paymentPurpose: 'May invoice',
    });
    expect(Number(created.debit)).toBe(120);
    expect(String(created.transactionDate).slice(0, 10)).toBe(daysAgo(1));

    const [{ ledger_dirty }] = await query<{ ledger_dirty: boolean }>(
      `SELECT "ledger_dirty" FROM "transactions" WHERE "id" = $1`,
      [created.id],
    );
    expect(ledger_dirty).toBe(true);
    await expect(posting.postTransaction(workspaceId, created.id)).resolves.toMatchObject({
      status: 'posted',
    });
    const [line] = await query<{ credit: string; wallet_id: string }>(
      `SELECT l."credit", a."wallet_id" FROM "journal_lines" l
         JOIN "journal_entries" e ON e."id" = l."entry_id"
         JOIN "ledger_accounts" a ON a."id" = l."account_id"
        WHERE e."source_transaction_id" = $1 AND l."credit" > 0`,
      [created.id],
    );
    expect(line).toEqual({ credit: '120.00', wallet_id: walletId });
  });

  it('records it once, however often the request is repeated', async () => {
    const payable = await bill();
    const request = { payFromWalletId: walletId };

    const results = await Promise.all([
      payables.markAsPaid(payable.id, workspaceId, userId, request),
      payables.markAsPaid(payable.id, workspaceId, userId, request),
    ]);
    await payables.markAsPaid(payable.id, workspaceId, userId, request);

    expect(new Set(results.map(result => result.linkedTransactionId)).size).toBe(1);
    const [{ n }] = await query<{ n: number }>(
      `SELECT count(*)::int AS "n" FROM "transactions" WHERE "wallet_id" = $1 AND "counterparty_name" = 'Acme'`,
      [walletId],
    );
    expect(n).toBe(2); // this bill's and the previous test's
  });

  it('records a received payment as income', async () => {
    const receivable = await bill({ direction: PayableDirection.RECEIVABLE, vendor: 'Client' });
    const paid = await payables.markAsPaid(receivable.id, workspaceId, userId, {
      payFromWalletId: walletId,
    });
    const created = await txRepo.findOneByOrFail({ id: paid.linkedTransactionId as string });
    expect(created.transactionType).toBe(TransactionType.INCOME);
    expect(Number(created.credit)).toBe(120);
    expect(created.debit).toBeNull();
  });

  it('refuses what it cannot record', async () => {
    const usdWallet = await dataSource
      .getRepository(Wallet)
      .save({ userId, workspaceId, name: 'USD', currency: 'USD' });
    const payable = await bill();
    const linked = await bill({ linkedTransactionId: (await transaction({})).id });
    const foreignWorkspace = (await dataSource.getRepository(Workspace).save({ name: 'Other', currency: 'EUR' })).id;
    const foreignWallet = await dataSource
      .getRepository(Wallet)
      .save({ userId, workspaceId: foreignWorkspace, name: 'Theirs', currency: 'EUR' });

    expect(
      await errorOf(
        payables.markAsPaid(payable.id, workspaceId, userId, { payFromWalletId: usdWallet.id }),
      ),
    ).toEqual({ status: 400, code: 'PAYABLE_WALLET_CURRENCY_MISMATCH' });
    expect(
      await errorOf(
        payables.markAsPaid(payable.id, workspaceId, userId, { payFromWalletId: foreignWallet.id }),
      ),
    ).toEqual({ status: 400, code: 'PAYABLE_WALLET_NOT_FOUND' });
    expect(
      await errorOf(
        payables.markAsPaid(payable.id, workspaceId, userId, {
          payFromWalletId: walletId,
          linkedTransactionId: (await transaction({})).id,
        }),
      ),
    ).toEqual({ status: 400, code: 'PAYABLE_PAYMENT_AMBIGUOUS' });
    expect(
      await errorOf(
        payables.markAsPaid(linked.id, workspaceId, userId, { payFromWalletId: walletId }),
      ),
    ).toEqual({ status: 409, code: 'PAYABLE_ALREADY_LINKED' });
    // Nothing was written by the refused requests.
    expect((await payableRepo.findOneByOrFail({ id: payable.id })).status).toBe(PayableStatus.TO_PAY);
  });

  it('keeps the recorded payment when the bill is marked unpaid again', async () => {
    const payable = await bill();
    const paid = await payables.markAsPaid(payable.id, workspaceId, userId, {
      payFromWalletId: walletId,
    });
    await payables.update(payable.id, workspaceId, userId, { status: PayableStatus.TO_PAY });

    expect(await txRepo.existsBy({ id: paid.linkedTransactionId as string })).toBe(true);

    // Linking a bank transaction now would book the payment twice; the same one is fine.
    const bank = await transaction({ statementId });
    expect(
      await errorOf(
        payables.markAsPaid(payable.id, workspaceId, userId, { linkedTransactionId: bank.id }),
      ),
    ).toEqual({ status: 409, code: 'PAYABLE_ALREADY_LINKED' });
    await expect(
      payables.markAsPaid(payable.id, workspaceId, userId, {
        linkedTransactionId: paid.linkedTransactionId as string,
      }),
    ).resolves.toMatchObject({ status: PayableStatus.PAID });
  });
});
