/**
 * Integration test — editing an approved receipt moves the figures, against a real Postgres.
 *
 * Every figure (dashboard, reports, budgets, forecast) sums transactions, not
 * receipts. A receipt keeps its own copy of the fields, so an edit has to reach
 * the row it booked, or the documents list shows one date and every number
 * another. The row the receipt booked itself (a scan's row, or the one approval
 * created) follows the receipt; a bank row it was attached to keeps the bank's
 * date and amount and takes only the category. A filed row does not move.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  Receipt,
  ReceiptSource,
  ReceiptStatus,
  Statement,
  StatementStatus,
  Transaction,
  TransactionType,
  User,
  Workspace,
} from '../../src/entities';
import { AuditService } from '../../src/modules/audit/audit.service';
import { BalanceService } from '../../src/modules/balance/balance.service';
import { BudgetsService } from '../../src/modules/budgets/budgets.service';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { ExchangeRatesService } from '../../src/modules/exchange-rates/exchange-rates.service';
import { GoalsService } from '../../src/modules/goals/goals.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { ReceiptProcessorService } from '../../src/modules/receipts/services/receipt-processor.service';
import { ReceiptsService } from '../../src/modules/receipts/receipts.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { TaxReserveService } from '../../src/modules/tax/tax-reserve.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_receipt_edit_${process.pid}`;

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
const LAST_MONTH = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 10));
const MONTH_BEFORE = isoDay(new Date(now.getFullYear(), now.getMonth() - 2, 21));

describe('editing an approved receipt reaches the figures (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let receiptRepo: Repository<Receipt>;
  let workspaceId: string;
  let userId: string;
  let softwareId: string;
  let travelId: string;
  let receipts: ReceiptsService;
  let dashboard: DashboardService;

  const statement = async (fields: Partial<Statement> = {}) =>
    (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'doc.pdf',
          filePath: `/tmp/${randomUUID()}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          currency: 'USD',
          ...fields,
        }),
      )
    ).id;

  const row = async (fields: Partial<Transaction>) =>
    (
      await txRepo.save(
        txRepo.create({
          workspaceId,
          transactionDate: new Date(LAST_MONTH),
          counterpartyName: 'Vendor',
          paymentPurpose: 'Vendor',
          currency: 'USD',
          transactionType: TransactionType.EXPENSE,
          amount: 50,
          debit: 50,
          credit: null,
          isVerified: true,
          categoryId: softwareId,
          ...fields,
        }),
      )
    ).id;

  const approvedReceipt = async (fields: Partial<Receipt>) =>
    (
      await receiptRepo.save(
        receiptRepo.create({
          userId,
          workspaceId,
          source: ReceiptSource.SCAN,
          subject: 'Receipt',
          sender: 'me',
          receivedAt: new Date(LAST_MONTH),
          status: ReceiptStatus.APPROVED,
          parsedData: {
            date: '',
            amount: 50,
            currency: 'USD',
            vendor: 'Vendor',
            categoryId: softwareId,
            transactionType: 'expense',
          },
          ...fields,
        }),
      )
    ).id;

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

    const rates = {
      getRate: jest.fn(async () => 1),
      getRateOrNull: jest.fn(async () => 1),
      convert: jest.fn(async (amount: number) => amount),
      coverageForWorkspace: jest.fn(async () => []),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        DashboardService,
        BudgetsService,
        WorkspaceCurrencyService,
        { provide: ReceiptProcessorService, useValue: {} },
        { provide: EventEmitter2, useValue: { emitAsync: jest.fn(async () => []) } },
        { provide: AuditService, useValue: { createEvent: jest.fn(), createBatch: jest.fn() } },
        { provide: ExchangeRatesService, useValue: rates },
        { provide: GoalsService, useValue: { findAll: jest.fn(async () => []) } },
        {
          provide: SubscriptionsService,
          useValue: { getSummary: jest.fn(async () => ({ totalMonthlyCost: 0 })) },
        },
        { provide: TaxReserveService, useValue: { getReserve: jest.fn(async () => null) } },
        { provide: BalanceService, useValue: {} },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    receipts = moduleRef.get(ReceiptsService);
    dashboard = moduleRef.get(DashboardService);
    txRepo = dataSource.getRepository(Transaction);
    receiptRepo = dataSource.getRepository(Receipt);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Receipt WS', currency: 'USD' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `receipt-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Receipt Tester',
          workspaceId,
        }),
      )
    ).id;
    const categories = dataSource.getRepository(Category);
    softwareId = (
      await categories.save({ workspaceId, userId, name: 'Software', type: CategoryType.EXPENSE })
    ).id;
    travelId = (
      await categories.save({ workspaceId, userId, name: 'Travel', type: CategoryType.EXPENSE })
    ).id;
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const spentIn = async (day: string) =>
    (await dashboard.getDashboard(userId, workspaceId, 'month', day)).topCategories.reduce(
      (sum, category) => sum + category.amount,
      0,
    );

  it("moves a scan's own row to the receipt's new date and amount, and the month with it", async () => {
    const scan = await statement({
      fileName: 'scan.jpg',
      parsingDetails: { detectedBy: 'receipt-scan' } as Statement['parsingDetails'],
    });
    const id = await row({ statementId: scan, amount: 289, debit: 289 });
    const receiptId = await approvedReceipt({ statementId: scan, transactionId: id });
    expect(await spentIn(LAST_MONTH)).toBe(289);

    await receipts.update(
      receiptId,
      workspaceId,
      { parsedData: { date: MONTH_BEFORE, amount: 300, vendor: 'Renamed' } },
      userId,
    );

    const moved = await txRepo.findOneByOrFail({ id });
    expect(String(moved.transactionDate).slice(0, 10)).toBe(MONTH_BEFORE);
    expect(Number(moved.debit)).toBe(300);
    expect(moved.counterpartyName).toBe('Renamed');
    expect(await spentIn(LAST_MONTH)).toBe(0);
    expect(await spentIn(MONTH_BEFORE)).toBe(300);
    await txRepo.delete({ id });
  });

  it("moves a scan's row while the receipt still waits in Review", async () => {
    // Before approval the scan's row exists on its statement, but the receipt
    // has no transactionId yet: Review lists that row.
    const scan = await statement({
      fileName: 'scan.jpg',
      currency: 'ARS',
      parsingDetails: { detectedBy: 'receipt-scan' } as Statement['parsingDetails'],
    });
    const id = await row({
      statementId: scan,
      currency: 'ARS',
      counterpartyName: 'Google Play',
      amount: 8.9,
      debit: 8.9,
      isVerified: false,
    });
    const receiptId = await approvedReceipt({
      statementId: scan,
      status: ReceiptStatus.DRAFT,
      parsedData: {
        date: LAST_MONTH,
        amount: 8.9,
        currency: 'ARS',
        vendor: 'Google Play',
        categoryId: softwareId,
        transactionType: 'expense',
      },
    });

    await receipts.update(
      receiptId,
      workspaceId,
      { parsedData: { currency: 'ILS', vendor: '100 Telegram Stars' } },
      userId,
    );

    const edited = await txRepo.findOneByOrFail({ id });
    expect(edited.currency).toBe('ILS');
    expect(edited.counterpartyName).toBe('100 Telegram Stars');
    expect(Number(edited.debit)).toBe(8.9);
    expect(String(edited.transactionDate).slice(0, 10)).toBe(LAST_MONTH);
    // Still waiting in Review: an edit is not an approval.
    expect(edited.isVerified).toBe(false);
    await txRepo.delete({ id });
  });

  it('moves the row an emailed receipt booked when it was approved', async () => {
    const id = await row({ amount: 12, debit: 12 });
    const receiptId = await approvedReceipt({
      source: ReceiptSource.IMAP,
      transactionId: id,
      parsedData: { date: LAST_MONTH, amount: 12, currency: 'USD', vendor: 'Shop' },
    });

    await receipts.update(
      receiptId,
      workspaceId,
      { parsedData: { amount: 15, categoryId: travelId } },
      userId,
    );

    const edited = await txRepo.findOneByOrFail({ id });
    expect(Number(edited.debit)).toBe(15);
    expect(edited.categoryId).toBe(travelId);
    // The date was not edited and stays.
    expect(String(edited.transactionDate).slice(0, 10)).toBe(LAST_MONTH);
    await txRepo.delete({ id });
  });

  it("keeps the bank's date and amount on a bank row and takes only the category", async () => {
    const bank = await statement({ bankName: BankName.OTHER });
    const id = await row({ statementId: bank, amount: 50, debit: 50 });
    const receiptId = await approvedReceipt({ source: ReceiptSource.IMAP, transactionId: id });

    await receipts.update(
      receiptId,
      workspaceId,
      { parsedData: { date: MONTH_BEFORE, amount: 99, categoryId: travelId } },
      userId,
    );

    const bankRow = await txRepo.findOneByOrFail({ id });
    expect(String(bankRow.transactionDate).slice(0, 10)).toBe(LAST_MONTH);
    expect(Number(bankRow.debit)).toBe(50);
    expect(bankRow.categoryId).toBe(travelId);
    await txRepo.delete({ id });
  });

  it('leaves a row filed on a tax return as it was filed', async () => {
    const id = await row({ amount: 40, debit: 40, taxLocked: true, taxAmount: 0 });
    const receiptId = await approvedReceipt({ source: ReceiptSource.IMAP, transactionId: id });

    await receipts.update(
      receiptId,
      workspaceId,
      { parsedData: { date: MONTH_BEFORE, amount: 41, categoryId: travelId } },
      userId,
    );

    const filed = await txRepo.findOneByOrFail({ id });
    expect(Number(filed.debit)).toBe(40);
    expect(filed.categoryId).toBe(softwareId);
    expect(String(filed.transactionDate).slice(0, 10)).toBe(LAST_MONTH);
  });
});
