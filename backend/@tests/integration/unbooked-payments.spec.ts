/**
 * Integration test — money marked received before it shows up, against a real Postgres.
 *
 * "Mark received" without a wallet or a bank row records the payment but books
 * no transaction: the money is expected to arrive with the bank statement, and
 * booking it now would count it twice then. Until it arrives the payment is
 * "not in an account yet" — the summary and the list say so. When a row of the
 * same money turns up (same currency and side, the amount the bank received,
 * within a week), the payment is linked to it, so the income appears exactly
 * once. The same happens when the row is already there at the time of marking.
 */
import { randomUUID } from 'node:crypto';
import type { HttpException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
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
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { LedgerAccountsService } from '../../src/modules/ledger/ledger-accounts.service';
import { LedgerPostingService } from '../../src/modules/ledger/ledger-posting.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PayablesService } from '../../src/modules/payables/payables.service';
import { PayablesExportService } from '../../src/modules/payables/payables-export.service';
import { UnbookedPaymentsService } from '../../src/modules/payables/unbooked-payments.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_unbooked_${process.pid}`;

function scratchUrl(database: string): string {
  const url = new URL(BASE_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

const ENTITIES = Object.values(entityIndex).filter(
  (value): value is Function => typeof value === 'function',
);

/** Loaded through Vite: TypeORM's glob loader would bypass the test transform. */
function loadMigrations(): Function[] {
  const modules = import.meta.glob<Record<string, unknown>>('../../src/migrations/*.ts', {
    eager: true,
  });
  return Object.keys(modules)
    .sort()
    .flatMap(file =>
      Object.values(modules[file]).filter(
        (value): value is Function => typeof value === 'function',
      ),
    );
}

describe('payments marked received before the money shows up (real Postgres)', () => {
  vi.setConfig({ testTimeout: 180_000 });

  let dataSource: DataSource;
  let payables: PayablesService;
  let unbooked: UnbookedPaymentsService;
  let txRepo: Repository<Transaction>;
  let payableRepo: Repository<Payable>;
  let paymentRepo: Repository<PayablePayment>;
  let workspaceId: string;
  let otherWorkspaceId: string;
  let userId: string;
  let statementId: string;
  let walletId: string;

  async function errorOf(promise: Promise<unknown>) {
    try {
      await promise;
    } catch (error) {
      const http = error as HttpException;
      return { status: http.getStatus(), code: (http.getResponse() as { code?: string }).code };
    }
    return null;
  }

  const receivable = (fields: Partial<Payable> = {}) =>
    payableRepo.save(
      payableRepo.create({
        workspaceId,
        createdById: userId,
        vendor: 'Logika',
        amount: 410,
        currency: 'USD',
        direction: PayableDirection.RECEIVABLE,
        dueDate: new Date('2026-09-29'),
        status: PayableStatus.OVERDUE,
        ...fields,
      }),
    );

  /** A bank row as an imported statement leaves it: not confirmed yet. */
  const bankRow = (fields: Partial<Transaction> = {}) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        statementId,
        transactionDate: new Date('2026-10-18'),
        counterpartyName: 'LOGIKA SRO',
        paymentPurpose: 'Invoice 7',
        currency: 'USD',
        transactionType: TransactionType.INCOME,
        amount: 410,
        credit: 410,
        debit: null,
        isVerified: false,
        ...fields,
      }),
    );

  const markReceived = (id: string) =>
    payables.markAsPaid(id, workspaceId, userId, { paidOn: '2026-10-16' } as never);

  const paymentOf = (payableId: string) => paymentRepo.findOneByOrFail({ payableId });

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
        UnbookedPaymentsService,
        WorkspaceCurrencyService,
        LedgerPostingService,
        LedgerAccountsService,
        { provide: ExchangeRatesService, useValue: { getRateQuote: vi.fn(), getRate: vi.fn(async () => 1) } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: vi.fn() } },
        { provide: PayablesExportService, useValue: {} },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    payables = moduleRef.get(PayablesService);
    unbooked = moduleRef.get(UnbookedPaymentsService);
    txRepo = dataSource.getRepository(Transaction);
    payableRepo = dataSource.getRepository(Payable);
    paymentRepo = dataSource.getRepository(PayablePayment);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Unbooked WS', currency: 'USD' })).id;
    otherWorkspaceId = (await workspaces.save({ name: 'Other WS', currency: 'USD' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `unbooked-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Unbooked Tester',
          workspaceId,
        }),
      )
    ).id;
    walletId = (
      await dataSource
        .getRepository(Wallet)
        .save({ userId, workspaceId, name: 'Cash', currency: 'USD' })
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
          currency: 'USD',
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

  beforeEach(async () => {
    await paymentRepo.query('DELETE FROM payable_payments');
    await payableRepo.query('DELETE FROM payables');
    await txRepo.query('DELETE FROM transactions');
  });

  it('links the payment to the bank row when the statement arrives', async () => {
    const bill = await receivable();
    await markReceived(bill.id);
    expect((await paymentOf(bill.id)).transactionId).toBeNull();

    const row = await bankRow();
    expect(await unbooked.linkUnbooked(workspaceId)).toBe(1);

    expect((await paymentOf(bill.id)).transactionId).toBe(row.id);
    expect((await payableRepo.findOneByOrFail({ id: bill.id })).linkedTransactionId).toBe(row.id);
  });

  it('links at once when the bank row is already there', async () => {
    const row = await bankRow({ transactionDate: new Date('2026-10-14') });
    const bill = await receivable();

    await markReceived(bill.id);

    expect((await paymentOf(bill.id)).transactionId).toBe(row.id);
  });

  it('matches what the bank received, after the processor fee', async () => {
    const bill = await receivable({ amount: 100 });
    await payables.addPayment(bill.id, workspaceId, userId, {
      amount: 100,
      feeAmount: 3,
      paidOn: '2026-10-16',
    } as never);
    const full = await bankRow({ amount: 100, credit: 100 });
    const net = await bankRow({ amount: 97, credit: 97 });

    await unbooked.linkUnbooked(workspaceId);

    expect((await paymentOf(bill.id)).transactionId).toBe(net.id);
    expect(full.id).not.toBe(net.id);
  });

  it('links a bill to spending and a receivable to income only', async () => {
    const bill = await receivable({ direction: PayableDirection.PAYABLE, vendor: 'Hosting' });
    await markReceived(bill.id);
    await bankRow(); // income of the same amount
    const spending = await bankRow({
      transactionType: TransactionType.EXPENSE,
      credit: null,
      debit: 410,
    });

    await unbooked.linkUnbooked(workspaceId);

    expect((await paymentOf(bill.id)).transactionId).toBe(spending.id);
  });

  it('leaves alone what is not the same money', async () => {
    const bill = await receivable();
    await markReceived(bill.id);
    const other = await receivable({ vendor: 'Other client', amount: 999 });
    await bankRow({ currency: 'EUR' });
    await bankRow({ transactionDate: new Date('2026-10-30') }); // two weeks later
    await bankRow({ isDuplicate: true });
    await bankRow({ transferPairId: randomUUID() });
    await bankRow({ workspaceId: otherWorkspaceId, statementId: null });
    // Already the payment of another bill.
    const taken = await bankRow();
    await payableRepo.update({ id: other.id }, { linkedTransactionId: taken.id });

    expect(await unbooked.linkUnbooked(workspaceId)).toBe(0);
    expect((await paymentOf(bill.id)).transactionId).toBeNull();
  });

  it('gives one row to one payment, the closest in date', async () => {
    const first = await receivable({ amount: 90, vendor: 'HoldYou' });
    const second = await receivable({ amount: 90, vendor: 'HoldYou' });
    await markReceived(first.id);
    await payables.markAsPaid(second.id, workspaceId, userId, { paidOn: '2026-10-12' } as never);
    const row = await bankRow({ amount: 90, credit: 90, transactionDate: new Date('2026-10-17') });

    await unbooked.linkUnbooked(workspaceId);

    expect((await paymentOf(first.id)).transactionId).toBe(row.id);
    expect((await paymentOf(second.id)).transactionId).toBeNull();
  });

  it('says how much received money is not in an account yet', async () => {
    const waiting = await receivable();
    await markReceived(waiting.id);
    // Set paid by hand before payments were recorded: no payment, no transaction.
    const legacy = await receivable({ vendor: 'Sold a laptop', amount: 50, status: PayableStatus.PAID });
    const booked = await receivable({ vendor: 'Booked', amount: 70 });
    await markReceived(booked.id);
    await bankRow({ amount: 70, credit: 70 });
    await unbooked.linkUnbooked(workspaceId);

    const summary = await payables.getSummary(workspaceId, PayableDirection.RECEIVABLE);
    expect(summary).toMatchObject({ paidTotal: 530, unbookedTotal: 460, unbookedCount: 2 });

    const { data } = await payables.findAll(workspaceId, {
      direction: 'receivable',
      page: 1,
      limit: 20,
    } as never);
    const unbookedOf = (id: string) => data.find(item => item.id === id)?.unbookedAmount;
    expect(unbookedOf(waiting.id)).toBe('410.00');
    expect(unbookedOf(legacy.id)).toBe('50.00');
    expect(unbookedOf(booked.id)).toBe('0.00');
  });

  describe('booking the money of a payment marked without it', () => {
    it('books it into the wallet the cash went into, as income', async () => {
      const bill = await receivable();
      await markReceived(bill.id);
      const payment = await paymentOf(bill.id);

      await payables.bookPayment(bill.id, payment.id, workspaceId, userId, { payFromWalletId: walletId });

      const booked = await paymentOf(bill.id);
      expect(booked.transactionId).not.toBeNull();
      expect(await txRepo.findOneByOrFail({ id: booked.transactionId as string })).toMatchObject({
        walletId,
        transactionType: TransactionType.INCOME,
        credit: '410.00',
        isVerified: true,
      });
      expect((await unbooked.unbookedByPayable(workspaceId)).get(bill.id)).toBe(0);
    });

    it('books it to a bank row, one wire paying several bills up to its amount', async () => {
      const wire = await bankRow({ amount: 800, credit: 800, isVerified: true });
      const first = await receivable({ amount: 300, vendor: 'HoldYou' });
      await payables.addPayment(first.id, workspaceId, userId, {
        amount: 300,
        linkedTransactionId: wire.id,
      } as never);
      const second = await receivable();
      await markReceived(second.id);
      const payment = await paymentOf(second.id);

      await payables.bookPayment(second.id, payment.id, workspaceId, userId, {
        linkedTransactionId: wire.id,
      });

      expect((await paymentOf(second.id)).transactionId).toBe(wire.id);
    });

    it('refuses a row with less left on it than the payment', async () => {
      const wire = await bankRow({ amount: 800, credit: 800, isVerified: true });
      const first = await receivable({ amount: 500, vendor: 'Big client' });
      await payables.addPayment(first.id, workspaceId, userId, {
        amount: 500,
        linkedTransactionId: wire.id,
      } as never);
      const second = await receivable();
      await markReceived(second.id);
      const payment = await paymentOf(second.id);

      expect(
        await errorOf(
          payables.bookPayment(second.id, payment.id, workspaceId, userId, {
            linkedTransactionId: wire.id,
          }),
        ),
      ).toEqual({ status: 400, code: 'PAYABLE_PAYMENT_SHORT' });
      expect((await paymentOf(second.id)).transactionId).toBeNull();
    });

    // A sale paid in cash, hand to hand: no wallet to name, still income.
    it('books it as cash in hand, with no wallet', async () => {
      const bill = await receivable({ amount: 3500, currency: 'ILS', vendor: 'Sold Mac Mini' });
      await markReceived(bill.id);
      const payment = await paymentOf(bill.id);

      await payables.bookPayment(bill.id, payment.id, workspaceId, userId, { inHand: true });

      const booked = await paymentOf(bill.id);
      expect(await txRepo.findOneByOrFail({ id: booked.transactionId as string })).toMatchObject({
        walletId: null,
        statementId: null,
        currency: 'ILS',
        transactionType: TransactionType.INCOME,
        credit: '3500.00',
        isVerified: true,
      });
      expect((await unbooked.unbookedByPayable(workspaceId)).get(bill.id)).toBe(0);
    });

    it('marks it received in hand straight away', async () => {
      const bill = await receivable();

      await payables.markAsPaid(bill.id, workspaceId, userId, {
        inHand: true,
        paidOn: '2026-10-16',
      } as never);

      const payment = await paymentOf(bill.id);
      expect(payment.transactionId).not.toBeNull();
      expect(
        (await txRepo.findOneByOrFail({ id: payment.transactionId as string })).walletId,
      ).toBeNull();
    });

    it('takes cash in hand or a wallet, not both', async () => {
      const bill = await receivable();
      await markReceived(bill.id);
      const payment = await paymentOf(bill.id);

      expect(
        await errorOf(
          payables.bookPayment(bill.id, payment.id, workspaceId, userId, {
            inHand: true,
            payFromWalletId: walletId,
          }),
        ),
      ).toEqual({ status: 400, code: 'PAYABLE_PAYMENT_AMBIGUOUS' });
    });

    it('refuses what cannot be booked', async () => {
      const bill = await receivable();
      await markReceived(bill.id);
      const payment = await paymentOf(bill.id);

      expect(await errorOf(payables.bookPayment(bill.id, payment.id, workspaceId, userId, {}))).toEqual(
        { status: 400, code: 'PAYABLE_BOOK_NEEDS_SOURCE' },
      );
      await payables.bookPayment(bill.id, payment.id, workspaceId, userId, { payFromWalletId: walletId });
      expect(
        await errorOf(
          payables.bookPayment(bill.id, payment.id, workspaceId, userId, { payFromWalletId: walletId }),
        ),
      ).toEqual({ status: 409, code: 'PAYABLE_ALREADY_LINKED' });
      // A payment of another bill is not found through this one.
      const other = await receivable({ vendor: 'Other' });
      expect(
        (await errorOf(
          payables.bookPayment(other.id, payment.id, workspaceId, userId, { payFromWalletId: walletId }),
        ))?.status,
      ).toBe(404);
    });
  });
});
