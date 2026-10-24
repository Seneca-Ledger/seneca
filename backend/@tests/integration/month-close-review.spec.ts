/**
 * Integration test — the month close and Review agree, against a real Postgres.
 *
 * Every step of the dashboard's month close (the Overview widget) shows
 * how many things are left and links to Review, limited to that month. The
 * number is a promise: open the link and that many rows are there. Both sides
 * decide in SQL, so only a database shows whether they agree. Seeded with the
 * cases that broke it: a scan counted as its row and again as its receipt, a
 * confirmed row with no category that Review never listed, a receipt dated by
 * its email but listed by its import, rows of another month.
 */
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
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
import { ReviewInboxKind } from '../../src/modules/review-inbox/dto/review-inbox.dto';
import { ReviewInboxService } from '../../src/modules/review-inbox/review-inbox.service';
import { SubscriptionsService } from '../../src/modules/subscriptions/subscriptions.service';
import { TaxReserveService } from '../../src/modules/tax/tax-reserve.service';
import { CrossStatementDeduplicationService } from '../../src/modules/transactions/services/cross-statement-deduplication.service';
import { TransactionsService } from '../../src/modules/transactions/transactions.service';
import { WorkspaceCurrencyService } from '../../src/modules/workspaces/workspace-currency.service';

const BASE_URL =
  process.env.DATABASE_URL || 'postgresql://finflow:finflow@localhost:5434/finflow';
const SCRATCH_DB = `seneca_month_close_${process.pid}`;

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

// The closed month is last month: anything imported today is created in another
// month, so a list dated by import instead of by the item itself shows here.
const now = new Date();
const FROM = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const TO = isoDay(new Date(now.getFullYear(), now.getMonth(), 0));
const DAY = isoDay(new Date(now.getFullYear(), now.getMonth() - 1, 15));
const MONTH_BEFORE = isoDay(new Date(now.getFullYear(), now.getMonth() - 2, 15));

describe('month close counts are what Review lists (real Postgres)', () => {
  jest.setTimeout(180_000);

  let dataSource: DataSource;
  let txRepo: Repository<Transaction>;
  let workspaceId: string;
  let userId: string;
  let groceriesId: string;
  let dashboard: DashboardService;
  let review: ReviewInboxService;

  const statement = async (fields: Partial<Statement> = {}) =>
    (
      await dataSource.getRepository(Statement).save(
        dataSource.getRepository(Statement).create({
          userId,
          workspaceId,
          fileName: 'bank.pdf',
          filePath: `/tmp/${randomUUID()}.pdf`,
          fileType: FileType.PDF,
          fileSize: 1,
          fileHash: randomUUID(),
          bankName: BankName.OTHER,
          status: StatementStatus.COMPLETED,
          currency: 'EUR',
          ...fields,
        }),
      )
    ).id;

  const row = async (fields: Partial<Transaction>) =>
    (
      await txRepo.save(
        txRepo.create({
          workspaceId,
          transactionDate: new Date(DAY),
          counterpartyName: 'Someone',
          paymentPurpose: 'Payment',
          currency: 'EUR',
          transactionType: TransactionType.EXPENSE,
          amount: 10,
          debit: 10,
          credit: null,
          isVerified: true,
          categoryId: groceriesId,
          ...fields,
        }),
      )
    ).id;

  const receipt = (fields: Partial<Receipt>) =>
    dataSource.getRepository(Receipt).save(
      dataSource.getRepository(Receipt).create({
        userId,
        workspaceId,
        source: ReceiptSource.IMAP,
        subject: 'Receipt',
        sender: 'shop@example.com',
        receivedAt: new Date(DAY),
        status: ReceiptStatus.PARSED,
        parsedData: { amount: 12, currency: 'EUR' },
        ...fields,
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

    const rates = {
      getRate: jest.fn(async () => 1),
      getRateOrNull: jest.fn(async () => 1),
      convert: jest.fn(async (amount: number) => amount),
      coverageForWorkspace: jest.fn(async () => []),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        BudgetsService,
        ReviewInboxService,
        WorkspaceCurrencyService,
        { provide: ExchangeRatesService, useValue: rates },
        { provide: GoalsService, useValue: { findAll: jest.fn(async () => []) } },
        {
          provide: SubscriptionsService,
          useValue: { getSummary: jest.fn(async () => ({ totalMonthlyCost: 0 })) },
        },
        { provide: TaxReserveService, useValue: { getReserve: jest.fn(async () => null) } },
        { provide: BalanceService, useValue: {} },
        { provide: AuditService, useValue: { createEvent: jest.fn() } },
        { provide: NotificationsService, useValue: { createForWorkspaceMembers: jest.fn() } },
        { provide: TransactionsService, useValue: {} },
        { provide: CrossStatementDeduplicationService, useValue: {} },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        ...ENTITIES.map(entity => ({
          provide: getRepositoryToken(entity),
          useValue: dataSource.getRepository(entity),
        })),
      ],
    }).compile();
    dashboard = moduleRef.get(DashboardService);
    review = moduleRef.get(ReviewInboxService);
    txRepo = dataSource.getRepository(Transaction);

    const workspaces = dataSource.getRepository(Workspace);
    workspaceId = (await workspaces.save({ name: 'Close WS', currency: 'EUR' })).id;
    userId = (
      await dataSource.getRepository(User).save(
        dataSource.getRepository(User).create({
          email: `close-${randomUUID()}@example.com`,
          passwordHash: 'x',
          name: 'Close Tester',
          workspaceId,
        }),
      )
    ).id;
    groceriesId = (
      await dataSource
        .getRepository(Category)
        .save({ workspaceId, userId, name: 'Groceries', type: CategoryType.EXPENSE })
    ).id;
    const cryptoWalletId = (
      await dataSource
        .getRepository(CryptoWallet)
        .save({ workspaceId, address: '0xabc', label: 'Ledger' })
    ).id;

    const bank = await statement();
    const trashed = await statement({ deletedAt: new Date() });

    // To review: two unconfirmed rows and a suspected duplicate.
    await row({ statementId: bank, isVerified: false });
    await row({ statementId: bank, isVerified: false, categoryId: null });
    await row({ statementId: bank, isVerified: false, isDuplicate: true });

    // A scan with an amount: its receipt, its shell statement and the row it
    // booked. One thing without a category, not two.
    const scan = await statement({
      fileName: 'scan.jpg',
      parsingDetails: { detectedBy: 'receipt-scan' } as Statement['parsingDetails'],
    });
    await row({ statementId: scan, isVerified: false, categoryId: null });
    await receipt({ source: ReceiptSource.SCAN, statementId: scan, status: ReceiptStatus.DRAFT });

    // Confirmed but never categorised: Review has to list them too.
    await row({ categoryId: null }); // a manual row, no statement
    await row({ statementId: bank, categoryId: null });

    // A receipt Review still asks about: dated in the month by its email,
    // imported (created) today, in another month.
    await receipt({ status: ReceiptStatus.NEEDS_REVIEW });

    // Never counted anywhere.
    await row({ statementId: trashed, isVerified: false, categoryId: null });
    await row({ categoryId: null, transferPairId: randomUUID() });
    await row({ categoryId: null, cryptoWalletId, cryptoAsset: 'ETH' }); // a swap leg
    await receipt({ status: ReceiptStatus.REJECTED, parsedData: { amount: 5 } });

    // Last month's leftovers belong to last month.
    await row({ transactionDate: new Date(MONTH_BEFORE), isVerified: false, categoryId: null });
    await receipt({ receivedAt: new Date(MONTH_BEFORE), status: ReceiptStatus.NEEDS_REVIEW });
  });

  afterAll(async () => {
    await dataSource?.destroy();
    const admin = new Client({ connectionString: scratchUrl('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await admin.end();
  });

  const health = async () =>
    (await dashboard.getDashboard(userId, workspaceId, 'month', DAY)).dataHealth;
  const listed = (kind: ReviewInboxKind, extra: { uncategorized?: boolean } = {}) =>
    review.list(workspaceId, { kind, from: FROM, to: TO, limit: 200, ...extra });

  it('"to review" is the rows and duplicates Review lists for the month', async () => {
    const [rows, duplicates] = await Promise.all([
      listed(ReviewInboxKind.TRANSACTION),
      listed(ReviewInboxKind.DUPLICATE),
    ]);

    expect(rows.total).toBe(3);
    expect(duplicates.total).toBe(1);
    expect((await health()).statementsPendingReview).toBe(rows.total + duplicates.total);
  });

  it('"without a category" is the rows Review lists with that filter, each once', async () => {
    const page = await listed(ReviewInboxKind.TRANSACTION, { uncategorized: true });

    expect(page.total).toBe(4);
    expect(page.items.every(item => item.kind === 'transaction' && !item.categoryId)).toBe(true);
    expect((await health()).uncategorizedTransactions).toBe(page.total);
  });

  it('"receipts" is the receipts Review lists, dated like the dashboard dates them', async () => {
    const page = await listed(ReviewInboxKind.RECEIPT);

    expect(page.total).toBe(1);
    expect((await health()).receiptsPendingReview).toBe(page.total);
  });

  it("Review's tab badges count the same month as its lists", async () => {
    const page = await listed(ReviewInboxKind.TRANSACTION);
    const totals = await Promise.all(
      [ReviewInboxKind.TRANSACTION, ReviewInboxKind.DUPLICATE, ReviewInboxKind.RECEIPT].map(
        async kind => (await listed(kind)).total,
      ),
    );

    expect([page.counts.transaction, page.counts.duplicate, page.counts.receipt]).toEqual(totals);
  });
});
