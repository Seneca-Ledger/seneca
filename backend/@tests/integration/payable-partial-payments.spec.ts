/**
 * Integration test — partial payments, against a real Postgres.
 *
 * The money people actually send: part of a bill, instalments, one wire
 * covering several invoices, a processor fee kept on the way. The status is
 * derived from the payment log, so only a database shows whether the two agree.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client as PgClient } from 'pg';
import { DataSource, type Repository } from 'typeorm';

import * as entityIndex from '../../src/entities';
import {
  BankName,
  Category,
  CategoryType,
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
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PayablesService } from '../../src/modules/payables/payables.service';
import { PayablesExportService } from '../../src/modules/payables/payables-export.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL = process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `lumio_partial_payments_${process.pid}`;

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

describe('partial payments (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let payables: PayablesService;
  let payableRepo: Repository<Payable>;
  let paymentRepo: Repository<PayablePayment>;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  let walletId: string;
  let categoryId: string;
  let statementId: string;

  const bill = (fields: Partial<Payable> = {}) =>
    payableRepo.save(
      payableRepo.create({
        workspaceId,
        createdById: userId,
        vendor: 'Acme',
        amount: 1000,
        currency: 'EUR',
        dueDate: new Date(daysAgo(2)),
        status: PayableStatus.TO_PAY,
        ...fields,
      }),
    );

  const transaction = (fields: Partial<Transaction>) =>
    txRepo.save(
      txRepo.create({
        workspaceId,
        statementId,
        transactionDate: new Date(daysAgo(1)),
        counterpartyName: 'Acme',
        paymentPurpose: 'Payment',
        currency: 'EUR',
        transactionType: TransactionType.EXPENSE,
        amount: 400,
        debit: 400,
        // Only a confirmed bank row may settle a bill.
        isVerified: true,
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
    const admin = new PgClient({ connectionString: scratchUrl('postgres') });
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
    payableRepo = dataSource.getRepository(Payable);
    paymentRepo = dataSource.getRepository(PayablePayment);
    txRepo = dataSource.getRepository(Transaction);

    workspaceId = (
      await dataSource.getRepository(Workspace).save({ name: 'Partials WS', currency: 'EUR' })
    ).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `partials-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Partials Tester',
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
          currency: 'EUR',
        }),
      )
    ).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new PgClient({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM "payable_payments"');
    await dataSource.query('DELETE FROM "payables"');
    // Every transaction of the workspace, not just the statement's: a cash
    // payment is recorded with no statement and would survive into the next test.
    await dataSource.query('DELETE FROM "transactions" WHERE "workspace_id" = $1', [workspaceId]);
  });

  it('reads as partially paid, with what is still outstanding', async () => {
    const payable = await bill();

    const afterFirst = await payables.addPayment(payable.id, workspaceId, userId, {
      amount: 400,
      paidOn: daysAgo(1),
    });

    expect(afterFirst.status).toBe(PayableStatus.PARTIALLY_PAID);
    expect(Number(afterFirst.paidAmount)).toBe(400);
    expect(afterFirst.paidAt).toBeNull();
  });

  it('closes the bill when the instalments add up', async () => {
    const payable = await bill();
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 400 });
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 350 });

    const settled = await payables.addPayment(payable.id, workspaceId, userId, { amount: 250 });

    expect(settled.status).toBe(PayableStatus.PAID);
    expect(Number(settled.paidAmount)).toBe(1000);
    expect(settled.paidAt).toBeInstanceOf(Date);
    expect(await payables.listPayments(payable.id, workspaceId)).toHaveLength(3);
  });

  it('refuses more than is outstanding, and anything that is not money', async () => {
    const payable = await bill();
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 900 });

    expect(
      await errorOf(payables.addPayment(payable.id, workspaceId, userId, { amount: 200 })),
    ).toEqual({ status: 400, code: 'PAYABLE_PAYMENT_EXCEEDS_OUTSTANDING' });
    expect(
      await errorOf(payables.addPayment(payable.id, workspaceId, userId, { amount: 0 })),
    ).toEqual({ status: 400, code: 'PAYABLE_PAYMENT_NOT_POSITIVE' });
    expect(Number((await payables.findOne(payable.id, workspaceId)).paidAmount)).toBe(900);
  });

  it('keeps the processor fee apart from what the client owes', async () => {
    const payable = await bill({ amount: 1000, direction: PayableDirection.RECEIVABLE });
    // The client sent 1000; the processor kept 29, so the bank shows 971.
    const received = await transaction({
      amount: 971,
      debit: null,
      credit: 971,
      transactionType: TransactionType.INCOME,
    });

    const settled = await payables.addPayment(payable.id, workspaceId, userId, {
      amount: 1000,
      feeAmount: 29,
      linkedTransactionId: received.id,
    });

    expect(settled.status).toBe(PayableStatus.PAID);
    const [payment] = await payables.listPayments(payable.id, workspaceId);
    expect(Number(payment.amount)).toBe(1000);
    expect(Number(payment.feeAmount)).toBe(29);
    expect(payment.transactionId).toBe(received.id);
  });

  it('spreads one transaction over several bills', async () => {
    const first = await bill({ amount: 500, vendor: 'Beta' });
    const second = await bill({ amount: 300, vendor: 'Beta' });
    const third = await bill({ amount: 200, vendor: 'Beta' });
    const wire = await transaction({ amount: 1000, debit: 1000 });

    const settled = await payables.allocateTransaction(workspaceId, userId, {
      transactionId: wire.id,
      paidOn: daysAgo(1),
      allocations: [
        { payableId: first.id, amount: 500 },
        { payableId: second.id, amount: 300 },
        { payableId: third.id, amount: 200 },
      ],
    });

    expect(settled.map(row => row.status)).toEqual([
      PayableStatus.PAID,
      PayableStatus.PAID,
      PayableStatus.PAID,
    ]);
    expect(await paymentRepo.count({ where: { transactionId: wire.id } })).toBe(3);
  });

  it('applies the same transaction to one bill only once', async () => {
    const payable = await bill({ amount: 1000 });
    const wire = await transaction({ amount: 400, debit: 400 });

    await payables.addPayment(payable.id, workspaceId, userId, {
      amount: 400,
      linkedTransactionId: wire.id,
    });
    // A retried request must not credit the bill twice.
    const again = await payables.addPayment(payable.id, workspaceId, userId, {
      amount: 400,
      linkedTransactionId: wire.id,
    });

    expect(Number(again.paidAmount)).toBe(400);
    expect(await paymentRepo.count({ where: { payableId: payable.id } })).toBe(1);
  });

  it('takes a payment back and the bill reopens', async () => {
    const payable = await bill({ amount: 1000 });
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 600 });
    const settled = await payables.addPayment(payable.id, workspaceId, userId, { amount: 400 });
    expect(settled.status).toBe(PayableStatus.PAID);

    const [newest] = await payables.listPayments(payable.id, workspaceId);
    const reopened = await payables.removePayment(payable.id, newest.id, workspaceId);

    expect(reopened.status).toBe(PayableStatus.PARTIALLY_PAID);
    expect(Number(reopened.paidAmount)).toBe(600);
    expect(reopened.paidAt).toBeNull();
  });

  it('goes back to overdue, not to-pay, when the last payment is removed', async () => {
    const payable = await bill({ amount: 100, dueDate: new Date(daysAgo(10)) });
    await payables.addPayment(payable.id, workspaceId, userId, { amount: 100 });
    const [only] = await payables.listPayments(payable.id, workspaceId);

    const reopened = await payables.removePayment(payable.id, only.id, workspaceId);

    expect(reopened.status).toBe(PayableStatus.OVERDUE);
    expect(Number(reopened.paidAmount)).toBe(0);
  });

  it('records a cash instalment as a wallet transaction', async () => {
    const payable = await bill({ amount: 1000 });

    const paid = await payables.addPayment(payable.id, workspaceId, userId, {
      amount: 250,
      payFromWalletId: walletId,
      categoryId,
      paidOn: daysAgo(1),
    });

    expect(paid.status).toBe(PayableStatus.PARTIALLY_PAID);
    const [payment] = await payables.listPayments(payable.id, workspaceId);
    const recorded = await txRepo.findOneByOrFail({ id: payment.transactionId as string });
    expect(Number(recorded.amount)).toBe(250);
    expect(recorded.walletId).toBe(walletId);
  });

  it('offers a part-spent transaction again, but not one already used up', async () => {
    const wire = await transaction({ amount: 1000, debit: 1000 });
    const first = await bill({ amount: 400 });
    await payables.addPayment(first.id, workspaceId, userId, {
      amount: 400,
      linkedTransactionId: wire.id,
    });

    // 600 of the wire is still unallocated, so it is a candidate for the rest.
    const second = await bill({ amount: 600 });
    expect(
      (await payables.findPaymentCandidates(second.id, workspaceId)).map(row => row.id),
    ).toContain(wire.id);

    await payables.addPayment(second.id, workspaceId, userId, {
      amount: 600,
      linkedTransactionId: wire.id,
    });

    const third = await bill({ amount: 100 });
    expect(
      (await payables.findPaymentCandidates(third.id, workspaceId)).map(row => row.id),
    ).not.toContain(wire.id);
  });

  it('suggests a transaction smaller than the bill, closest amount first', async () => {
    const payable = await bill({ amount: 1000 });
    const near = await transaction({ amount: 950, debit: 950 });
    const small = await transaction({ amount: 100, debit: 100 });

    const candidates = await payables.findPaymentCandidates(payable.id, workspaceId);

    // The old rule required an exact match and would have offered neither.
    expect(candidates.map(row => row.id).slice(0, 2)).toEqual([near.id, small.id]);
  });
  it('splits one wire of 18 450 across the four bills that add up to it', async () => {
    const amounts = [4200, 6150.5, 5099.5, 3000];
    const bills = [];
    for (const [index, amount] of amounts.entries()) {
      bills.push(await bill({ amount, dueDate: new Date(daysAgo(30 - index)) }));
    }
    // A fifth bill, newer and not part of the sum: it must stay out of it.
    const untouched = await bill({ amount: 777, dueDate: new Date(daysAgo(1)) });
    const wire = await transaction({ amount: 18_450, debit: 18_450 });

    const suggestion = await payables.suggestAllocation(workspaceId, wire.id);

    expect(suggestion.exact).toBe(true);
    expect(suggestion.unallocated).toBe(0);
    expect(suggestion.allocations.map(row => row.payableId).sort()).toEqual(
      bills.map(row => row.id).sort(),
    );
    expect(suggestion.allocations.map(row => row.payableId)).not.toContain(untouched.id);
    expect(suggestion.allocations.every(row => row.partial === false)).toBe(true);

    // Confirming the proposal settles all four and leaves nothing on the wire.
    const settled = await payables.allocateTransaction(workspaceId, userId, {
      transactionId: wire.id,
      allocations: suggestion.allocations.map(row => ({
        payableId: row.payableId,
        amount: row.amount,
      })),
    });
    expect(settled.map(row => row.status)).toEqual([
      PayableStatus.PAID,
      PayableStatus.PAID,
      PayableStatus.PAID,
      PayableStatus.PAID,
    ]);
    expect((await payables.suggestAllocation(workspaceId, wire.id)).available).toBe(0);
  });

  it('pays the oldest bills first when nothing adds up exactly', async () => {
    const oldest = await bill({ amount: 300, dueDate: new Date(daysAgo(20)) });
    const middle = await bill({ amount: 300, dueDate: new Date(daysAgo(10)) });
    const newest = await bill({ amount: 300, dueDate: new Date(daysAgo(1)) });
    const wire = await transaction({ amount: 450, debit: 450 });

    const suggestion = await payables.suggestAllocation(workspaceId, wire.id);

    expect(suggestion.exact).toBe(false);
    expect(suggestion.unallocated).toBe(0);
    expect(suggestion.allocations).toEqual([
      expect.objectContaining({ payableId: oldest.id, amount: 300, partial: false }),
      expect.objectContaining({ payableId: middle.id, amount: 150, partial: true }),
    ]);
    expect(suggestion.allocations.map(row => row.payableId)).not.toContain(newest.id);
  });

  it('proposes nothing when the money has no open bill to go to', async () => {
    const paid = await bill({ amount: 500 });
    await payables.addPayment(paid.id, workspaceId, userId, { amount: 500 });
    const wire = await transaction({ amount: 500, debit: 500 });

    const suggestion = await payables.suggestAllocation(workspaceId, wire.id);

    expect(suggestion.allocations).toEqual([]);
    expect(suggestion.unallocated).toBe(500);
  });
});
