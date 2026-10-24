jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import { generateSync } from 'otplib';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { encryptText } from '../../src/common/utils/encryption.util';
import { BackupRun, BackupRunStatus, BackupRunTrigger } from '../../src/entities/backup-run.entity';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../src/entities/receipt.entity';
import { PEPPOL_DOCTYPES } from '../../src/modules/e-invoices/peppol-ubl-writer';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../src/entities/transaction.entity';
import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../src/entities/subscription.entity';
import {
  AccountLedger,
  AdminUserList,
  AgeingReport,
  AllocationSuggestion,
  AvailableCustomTables,
  BackupConfiguration,
  BackupRunList,
  BalanceSheetResponse,
  BankSyncStatus,
  BudgetImpact,
  BudgetItem,
  BudgetList,
  BusinessProfileResponse,
  CashFlowMap,
  CategoryList,
  CategoryUsageCount,
  Client,
  ClientList,
  CreatedCustomTable,
  CreatedFromSource,
  CreatedWebhookEndpoint,
  CreditNoteList,
  CryptoGains,
  CryptoHistory,
  CryptoNetworkList,
  CryptoSummary,
  CryptoTransactionList,
  CryptoWalletList,
  CurrentUser,
  CustomTableAggregates,
  CustomTableColumnItem,
  CustomTableDetail,
  CustomTableGroups,
  CustomTableItem,
  CustomTableList,
  CustomTableMoneyTotal,
  CustomTableRowItem,
  CustomTableRowPage,
  CustomTableSummaries,
  DailyQuote,
  DashboardCashFlowEntriesResponse,
  DashboardCommitmentsResponse,
  DashboardMonthlyCashFlowResponse,
  DashboardResponse,
  DashboardTrendsResponse,
  DisclaimerStatus,
  DuplicateGroups,
  EntityImportResult,
  ExchangeRateCoverage,
  ExchangeRateQuote,
  ForecastResponse,
  FormulaPreview,
  GoalDetail,
  GoalFlowResponse,
  GoalList,
  GoalPlanResponse,
  GoalWithProgress,
  ImportSuggestion,
  IncomeTaxDisclaimer,
  IncomeTaxDraft,
  IncomeTaxMappings,
  IncomeTaxProfile,
  InsightList,
  InvestmentAccountList,
  InvitationPreview,
  Invoice,
  InvoiceDeliveryList,
  InvoiceListPage,
  InvoiceSettings,
  JournalEntryDetail,
  JournalEntryPage,
  JurisdictionRateList,
  LateFeeQuote,
  LedgerAccount,
  LedgerAccountList,
  LedgerIntegrity,
  LedgerSettings,
  LocalCategorizationStatus,
  LoginResponse,
  MapStyles,
  MetalReceiptList,
  MetalsSummary,
  MonthGoalList,
  NetWorthResponse,
  NoteCounts,
  NoteItem,
  NoteList,
  NotificationList,
  NotificationPreferences,
  Payable,
  PayableList,
  PayableListPage,
  PayablePaymentList,
  PayablesSummary,
  Payee,
  PayeePendingReview,
  PayeesPage,
  PaymentCandidateList,
  PeppolLookup,
  PeppolTransmissionList,
  PublicInvoiceView,
  PushPublicKey,
  ReceiptApproval,
  ReceiptListPage,
  ReceiptRecord,
  ReceiptRecordUpdate,
  ReceiptSplitSuggestion,
  ReceiptTax,
  ReceiptTransactionMatches,
  ReconciliationResponse,
  RecoveryCodes,
  RefreshedFromSource,
  RegisterResponse,
  ReportHistoryList,
  ReportPreview,
  ReportScheduleList,
  ReviewApproved,
  ReviewInboxByStatement,
  ReviewInboxCounts,
  ReviewInboxPage,
  SearchResponse,
  SharedFileAccess,
  SharedTableRows,
  SharedTableView,
  SourcePreview,
  SpendFlow,
  StatementApproved,
  StatementDetail,
  StoicBalance,
  StorageFileDetails,
  StorageFileList,
  StorageFolder,
  StorageFolderList,
  StorageTag,
  StorageTagList,
  StorageViewItem,
  StorageViewList,
  SubscriptionChargeCalendar,
  SubscriptionChargeCandidates,
  SubscriptionChargeRow,
  SubscriptionDetail,
  SubscriptionDuplicateGroups,
  SubscriptionList,
  SubscriptionMonthStatus,
  SubscriptionSummary,
  SystemUpdateStatus,
  TagList,
  TransactionTagLinks,
  TaxJurisdictionList,
  TaxRateItem,
  TaxRateList,
  TaxReturnPreview,
  TaxReturnRecord,
  TaxRuleList,
  TaxThresholdStatus,
  TelegramBotStatus,
  TelegramReportPage,
  TransactionAttachmentList,
  TransactionCandidates,
  TransactionList,
  TrialBalance,
  TwoFactorSetup,
  TwoFactorStatus,
  UnreadCount,
  UpcomingSubscriptionList,
  UserPermissions,
  UserSessionList,
  UserUpdateResponse,
  WalletList,
  WebhookEndpointList,
  WebhookSubscriptionList,
  WorkspaceActivity,
  WorkspaceDetail,
  WorkspaceList,
  WorkspaceOverview,
  WorkspaceSummary,
  WorkspaceTaxSettings,
  DatevMapping,
  DatevPreview,
  DatevSettings,
  OfficialRatesCheck,
  TaxDeadlineList,
  TaxReassessment,
  TaxReserve,
  TaxReserveSettings,
  TaxYearReport,
  UstvaResult,
  VatFilingSettings,
  VatStatusChange,
  AuditEventList,
  AuditEventPage,
  AuditRollbackResult,
  BackupImportPreview,
  BackupRestoreResult,
  BranchList,
  BusinessProfileLogo,
  CategoryUsageCounts,
  CustomTableRowBatch,
  CustomTablesReport,
  CustomTablesReportDrillDown,
  DuplicatesMarked,
  FileCategoryUpdate,
  IntegrationConnection,
  InvitationAccepted,
  InvoiceCreated,
  MessageResult,
  PageHintsSeen,
  PayeeRecord,
  PlaceSuggestions,
  ReceiptUploadResult,
  RevaluationResult,
  SetupProgress,
  StatementListPage,
  TransactionListPage,
  TransactionPayeeResult,
  TransactionsOverview,
  UploadedIcon,
  ViewPreferenceState,
  WelcomeTutorialSeen,
  WorkspaceFavorite,
  XRechnungCheck,
} from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Every response the frontend checks against a contract in development is
 * checked here against the real backend, with data in it, so a contract that
 * only matches empty answers does not pass.
 */
describe('API contracts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `contracts-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const get = (url: string) =>
    request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .expect(200);
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>, {
      onExcessProperty: 'ignore',
    })(body);

  beforeAll(async () => {
    // Read once when the backups module starts: where a local backup run writes.
    process.env.BACKUP_LOCAL_ROOT ??= mkdtempSync(join(tmpdir(), 'seneca-contracts-backups-'));
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Contracts Owner');
    const categories = await get('/categories?type=expense');
    const today = new Date().toISOString().slice(0, 10);
    await request(app.getHttpServer())
      .post('/statements/manual-expense')
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId)
      .field('amount', '42.50')
      .field('currency', 'USD')
      .field('merchant', 'Contract Coffee')
      .field('categoryId', categories.body[0].id)
      .field('date', today)
      .expect(201);
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  describe('dashboard', () => {
    it('GET /dashboard', async () => {
      const res = await get('/dashboard?range=30d');
      matches(DashboardResponse, res.body);
      expect(res.body.recentTransactions.length).toBeGreaterThan(0);
    });

    it('GET /dashboard/trends', async () => {
      matches(DashboardTrendsResponse, (await get('/dashboard/trends?days=30')).body);
    });

    it('GET /dashboard/cash-flow', async () => {
      matches(DashboardMonthlyCashFlowResponse, (await get('/dashboard/cash-flow?range=12m')).body);
    });

    it('GET /dashboard/cash-flow/entries', async () => {
      const month = new Date().toISOString().slice(0, 7);
      const res = await get(`/dashboard/cash-flow/entries?month=${month}`);
      matches(DashboardCashFlowEntriesResponse, res.body);
      expect(res.body.entries).toContainEqual(
        expect.objectContaining({ name: 'Contract Coffee', kind: 'expense' }),
      );
    });

    it('GET /dashboard/commitments', async () => {
      matches(DashboardCommitmentsResponse, (await get('/dashboard/commitments?days=60')).body);
    });
  });

  describe('app shell', () => {
    it('GET /auth/me, without credentials or bookkeeping columns', async () => {
      const res = await get('/auth/me');
      matches(CurrentUser, res.body);
      for (const field of ['passwordHash', 'tokenVersion', 'twoFactorSecret', 'isActive']) {
        expect(res.body).not.toHaveProperty(field);
      }
    });

    it('GET /workspaces', async () => {
      const res = await get('/workspaces');
      matches(WorkspaceList, res.body);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /workspaces/me', async () => {
      const res = await get('/workspaces/me');
      matches(WorkspaceOverview, res.body);
      expect(res.body.members.length).toBeGreaterThan(0);
    });

    it('GET /workspaces/:id', async () => {
      const res = await get(`/workspaces/${owner.workspaceId}`);
      matches(WorkspaceDetail, res.body);
      expect(res.body.members[0]).toHaveProperty('memberId');
    });

    it('GET /notifications and /notifications/unread-count', async () => {
      matches(NotificationList, (await get('/notifications')).body);
      matches(UnreadCount, (await get('/notifications/unread-count')).body);
    });

    it('GET /insights', async () => {
      matches(InsightList, (await get('/insights?limit=50&locale=en')).body);
    });

    it('GET /review-inbox/counts', async () => {
      const res = await get('/review-inbox/counts');
      matches(ReviewInboxCounts, res.body);
    });
  });

  describe('reference data', () => {
    it('GET /categories, with parents and children', async () => {
      const res = await get('/categories');
      matches(CategoryList, res.body);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('GET /wallets', async () => {
      await request(app.getHttpServer())
        .post('/wallets')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send({ name: 'Contract Wallet', currency: 'USD', initialBalance: 12.5 })
        .expect(201);
      const res = await get('/wallets');
      matches(WalletList, res.body);
      expect(res.body[0].initialBalance).toBe('12.50');
    });
  });

  describe('budgets and goals', () => {
    const month = new Date().toISOString().slice(0, 7);
    let goalId: string;

    beforeAll(async () => {
      const post = (url: string, body: object) =>
        request(app.getHttpServer())
          .post(url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body)
          .expect(201);
      const goal = await post('/goals', { name: 'Move', targetAmount: 1000, currency: 'USD' });
      goalId = goal.body.id;
      await post(`/goals/${goalId}/contributions`, { amount: 100 });
      const categories = await get('/categories?type=expense');
      await post('/budgets', {
        name: 'Food for the move',
        categoryId: categories.body[0].id,
        limitAmount: 250.5,
        periodType: 'monthly',
        currency: 'USD',
        goalId,
      });
    });

    it("GET /dashboard counts the budget's category spending as budgeted", async () => {
      const res = await get('/dashboard?range=month');
      matches(DashboardResponse, res.body);
      expect(
        res.body.cashFlow.some((point: { budgeted: number }) => point.budgeted > 0),
      ).toBe(true);
    });

    it('GET /budgets', async () => {
      const res = await get('/budgets');
      matches(BudgetList, res.body);
      expect(res.body[0].limitAmount).toBe('250.50');
    });

    it('GET /goals and /goals?month=', async () => {
      matches(GoalList, (await get('/goals')).body);
      const monthly = await get(`/goals?month=${month}`);
      matches(MonthGoalList, monthly.body);
      expect(monthly.body.length).toBeGreaterThan(0);
    });

    it('GET /goals/:id/flow and /plan', async () => {
      matches(GoalFlowResponse, (await get(`/goals/${goalId}/flow?month=${month}`)).body);
      matches(GoalPlanResponse, (await get(`/goals/${goalId}/plan`)).body);
    });
  });

  describe('wealth', () => {
    const post = (url: string, body: object) =>
      request(app.getHttpServer())
        .post(url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body)
        .expect(201);

    beforeAll(async () => {
      // Prices in the workspace currency, so nothing has to be fetched or converted.
      const { currency } = (await get('/reports/balance/sheet')).body;
      const account = await post('/investments/accounts', { name: 'Broker', kind: 'investment' });
      await post(`/investments/accounts/${account.body.id}/holdings`, {
        symbol: 'VWCE',
        name: 'All-World',
        assetClass: 'etf',
        quantity: 3,
        price: 100,
        priceCurrency: currency,
      });
      await post('/metals/lots', {
        metal: 'XAU',
        name: 'Krugerrand',
        quantity: 1,
        unitWeight: 1,
        weightUnit: 'ozt',
        purity: 0.9167,
        acquiredOn: '2025-01-15',
        costTotal: 2500,
        costCurrency: currency,
        price: 2600,
        priceCurrency: currency,
      });
      await post('/crypto/holdings', { asset: 'BTC', amount: '0.5', costPerUnit: 100 });
    }, 60_000);

    it('GET /investments', async () => {
      const res = await get('/investments');
      matches(InvestmentAccountList, res.body);
      expect(res.body[0].holdings[0].pricedAt).toEqual(expect.any(String));
    });

    it('GET /metals and /metals/receipt-options', async () => {
      const res = await get('/metals');
      matches(MetalsSummary, res.body);
      expect(res.body.lots).toHaveLength(1);
      expect(res.body.byMetal[0].pricedAt).toEqual(expect.any(String));
      matches(MetalReceiptList, (await get('/metals/receipt-options')).body);
    });

    it('GET /reports/net-worth', async () => {
      const res = await get('/reports/net-worth?range=30d');
      matches(NetWorthResponse, res.body);
      expect(res.body.assetLines.length).toBeGreaterThan(0);
    });

    it('GET /reports/balance/sheet', async () => {
      const res = await get('/reports/balance/sheet');
      matches(BalanceSheetResponse, res.body);
      expect(res.body.assets.sections.length).toBeGreaterThan(0);
    });

    it('GET /crypto/*', async () => {
      const wallets = await get('/crypto/wallets');
      matches(CryptoWalletList, wallets.body);
      expect(wallets.body[0].balances[0].asset).toBe('BTC');
      matches(CryptoSummary, (await get('/crypto/summary')).body);
      const month = new Date().toISOString().slice(0, 7);
      matches(CryptoSummary, (await get(`/crypto/summary?month=${month}`)).body);
      matches(CryptoTransactionList, (await get('/crypto/transactions')).body);
      matches(CryptoHistory, (await get('/crypto/history')).body);
      matches(CryptoGains, (await get('/crypto/gains?year=2026')).body);
      matches(CryptoNetworkList, (await get('/crypto/networks')).body);
    }, 120_000);
  });

  describe('subscriptions', () => {
    beforeAll(async () => {
      const send = (method: 'post' | 'patch', url: string, body: object) =>
        request(app.getHttpServer())
          [method](url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body);
      const next = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
      const categories = await get('/categories?type=expense');
      const created = await send('post', '/subscriptions', {
        vendorName: 'Netflix',
        amount: 12.99,
        frequency: 'monthly',
        currency: 'USD',
        categoryId: categories.body[0].id,
        nextChargeDate: next,
      }).expect(201);
      // The same service on two plans is what /duplicates reports.
      await send('post', '/subscriptions', {
        vendorName: 'Netflix',
        amount: 15.49,
        frequency: 'annual',
        currency: 'USD',
        nextChargeDate: next,
      }).expect(201);
      const me = await get('/auth/me');
      await send('patch', `/subscriptions/${created.body.id}/owner`, { ownerId: me.body.id }).expect(
        200,
      );
    });

    it('GET /subscriptions, money as decimal strings', async () => {
      const res = await get('/subscriptions');
      matches(SubscriptionList, res.body);
      expect(res.body.map((row: { amount: string }) => row.amount).sort()).toEqual([
        '12.99',
        '15.49',
      ]);
    });

    it('GET /subscriptions/summary, /charge-calendar and /duplicates', async () => {
      matches(SubscriptionSummary, (await get('/subscriptions/summary')).body);
      const calendar = await get('/subscriptions/charge-calendar?months=6');
      matches(SubscriptionChargeCalendar, calendar.body);
      expect(calendar.body.rows.length).toBeGreaterThan(0);
      const duplicates = await get('/subscriptions/duplicates');
      matches(SubscriptionDuplicateGroups, duplicates.body);
      expect(duplicates.body).toHaveLength(1);
    });

    it('GET /subscriptions/month-status', async () => {
      const status = await get('/subscriptions/month-status');
      matches(SubscriptionMonthStatus, status.body);
      // A monthly charge lands in every month, paid or still to come.
      expect(status.body.paidCount + status.body.unpaidCount).toBeGreaterThan(0);
      expect(status.body.items.length).toBeGreaterThan(0);
    });

    it('GET /subscriptions/upcoming', async () => {
      const upcoming = await get('/subscriptions/upcoming?days=30');
      matches(UpcomingSubscriptionList, upcoming.body);
      expect(upcoming.body).toHaveLength(2);
    });

    it('records a payment by hand, links it to a bank row, then removes it', async () => {
      const send = (method: 'post' | 'patch' | 'delete', url: string, body: object = {}) =>
        request(app.getHttpServer())
          [method](url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body);
      const today = new Date().toISOString().slice(0, 10);
      const monthly = (await get('/subscriptions')).body.find(
        (row: { amount: string }) => row.amount === '12.99',
      );

      const recorded = await send('post', `/subscriptions/${monthly.id}/charges`, {
        chargeDate: today,
      }).expect(201);
      matches(SubscriptionChargeRow, recorded.body);
      expect(recorded.body).toEqual(
        expect.objectContaining({ transactionId: null, amount: '12.99', chargeDate: today }),
      );

      const candidates = await get('/subscriptions/charge-candidates?vendorName=Contract%20Coffee');
      matches(SubscriptionChargeCandidates, candidates.body);
      const coffee = candidates.body.find(
        (row: { counterpartyName: string }) => row.counterpartyName === 'Contract Coffee',
      );
      expect(coffee).toEqual(expect.objectContaining({ amount: 42.5, matchesVendor: true }));

      const linked = await send('patch', `/subscriptions/${monthly.id}/charges/${recorded.body.id}`, {
        transactionId: coffee.transactionId,
      }).expect(200);
      matches(SubscriptionChargeRow, linked.body);
      expect(linked.body).toEqual(
        expect.objectContaining({ id: recorded.body.id, transactionId: coffee.transactionId, amount: '42.50' }),
      );
      // A row that is a payment is no longer offered.
      const after = await get('/subscriptions/charge-candidates?vendorName=Contract%20Coffee');
      expect(after.body.map((row: { transactionId: string }) => row.transactionId)).not.toContain(
        coffee.transactionId,
      );
      const detail = await get(`/subscriptions/${monthly.id}`);
      matches(SubscriptionDetail, detail.body);
      expect(detail.body.charges).toEqual([expect.objectContaining({ id: recorded.body.id })]);
      const status = await get('/subscriptions/month-status');
      matches(SubscriptionMonthStatus, status.body);
      expect(status.body.items).toContainEqual(
        expect.objectContaining({ subscriptionId: monthly.id, paid: true }),
      );

      // Removing the payment keeps the bank row, which is then free again.
      await send('delete', `/subscriptions/${monthly.id}/charges/${recorded.body.id}`).expect(200);
      expect((await get(`/subscriptions/${monthly.id}`)).body.charges).toEqual([]);
      const freed = await get('/subscriptions/charge-candidates?vendorName=Contract%20Coffee');
      expect(freed.body.map((row: { transactionId: string }) => row.transactionId)).toContain(
        coffee.transactionId,
      );
    });

    it("links a payee's new rows to the subscription a person linked one of its rows to", async () => {
      const send = (method: 'post' | 'delete', url: string, body: object = {}) =>
        request(app.getHttpServer())
          [method](url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body);
      const merchant = 'Contract Coffee';
      const today = new Date().toISOString().slice(0, 10);
      const categories = await get('/categories?type=expense');
      const addExpense = async (amount: string): Promise<string> => {
        const created = await request(app.getHttpServer())
          .post('/statements/manual-expense')
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .field('amount', amount)
          .field('currency', 'USD')
          .field('merchant', merchant)
          .field('categoryId', categories.body[0].id)
          .field('date', today)
          .expect(201);
        return created.body.id;
      };
      const detailOf = async (id: string) => {
        const detail = await get(`/subscriptions/${id}`);
        matches(SubscriptionDetail, detail.body);
        return detail.body;
      };
      const subscriptions = (await get('/subscriptions')).body;
      const monthly = subscriptions.find((row: { amount: string }) => row.amount === '12.99');
      const annual = subscriptions.find((row: { amount: string }) => row.amount === '15.49');
      const coffee = (await get('/subscriptions/charge-candidates?vendorName=Contract%20Coffee')).body.find(
        (row: { counterpartyName: string }) => row.counterpartyName === merchant,
      );
      const statementIds: string[] = [];

      try {
        // A person links a bank row: the subscription learns its payee.
        const linked = await send('post', `/subscriptions/${monthly.id}/charges`, {
          transactionId: coffee.transactionId,
        }).expect(201);
        expect((await detailOf(monthly.id)).autoLinkPayees).toEqual([
          { payeeId: expect.any(String), name: merchant, shared: false },
        ]);

        // A new row of that payee becomes a payment by itself.
        statementIds.push(await addExpense('13.10'));
        const withAuto = await detailOf(monthly.id);
        const auto = withAuto.charges.find(
          (charge: { transactionId: string | null }) => charge.transactionId !== coffee.transactionId,
        );
        expect(withAuto.charges).toHaveLength(2);
        expect(auto).toEqual(
          expect.objectContaining({ amount: '13.10', chargeDate: today, matchStatus: 'matched' }),
        );
        expect(withAuto.subscription.lastChargeDate).toBe(today);

        // Removing one payment keeps the rule while another row of the payee is a payment.
        await send('delete', `/subscriptions/${monthly.id}/charges/${auto.id}`).expect(200);
        expect((await detailOf(monthly.id)).autoLinkPayees).toHaveLength(1);

        // A second subscription with the same payee: both say so, and neither takes new rows.
        await send('post', `/subscriptions/${annual.id}/charges`, {
          transactionId: auto.transactionId,
        }).expect(201);
        expect((await detailOf(monthly.id)).autoLinkPayees).toEqual([
          expect.objectContaining({ name: merchant, shared: true }),
        ]);
        statementIds.push(await addExpense('13.20'));
        expect((await detailOf(monthly.id)).charges).toHaveLength(1);
        expect((await detailOf(annual.id)).charges).toHaveLength(1);

        // Removing the last payment of the payee forgets the rule.
        await send('delete', `/subscriptions/${monthly.id}/charges/${linked.body.id}`).expect(200);
        expect((await detailOf(monthly.id)).autoLinkPayees).toEqual([]);
        const annualCharge = (await detailOf(annual.id)).charges[0];
        await send('delete', `/subscriptions/${annual.id}/charges/${annualCharge.id}`).expect(200);
        expect((await detailOf(annual.id)).autoLinkPayees).toEqual([]);
      } finally {
        // The added rows would change what later tests count.
        await dataSource.query('DELETE FROM transactions WHERE statement_id = ANY($1)', [statementIds]);
        await dataSource.query('DELETE FROM statements WHERE id = ANY($1)', [statementIds]);
      }
    });

    it("pays a subscription from a budget: reserved in the budget, its row takes the budget's category", async () => {
      const send = (method: 'post' | 'put' | 'delete', url: string, body: object = {}) =>
        request(app.getHttpServer())
          [method](url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body);
      const vendorName = 'ACME Music';
      const budgetName = 'Fun money';
      const today = new Date().toISOString().slice(0, 10);
      const categories = (await get('/categories?type=expense')).body;
      const [rowCategory, budgetCategory] = [categories[0].id, categories[1].id];
      const budget = await send('post', '/budgets', {
        name: budgetName,
        categoryId: budgetCategory,
        limitAmount: 80,
        periodType: 'monthly',
        currency: 'USD',
      }).expect(201);
      let subscriptionId: string | undefined;
      const statementIds: string[] = [];
      // Two rows of one amount on one day would be a duplicate.
      const addExpense = async (amount: string): Promise<string> => {
        const expense = await request(app.getHttpServer())
          .post('/statements/manual-expense')
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .field('amount', amount)
          .field('currency', 'USD')
          .field('merchant', vendorName)
          .field('categoryId', rowCategory)
          .field('date', today)
          .expect(201);
        statementIds.push(expense.body.id);
        const [row] = await dataSource.query(
          'SELECT id FROM transactions WHERE statement_id = $1 AND workspace_id = $2',
          [expense.body.id, owner.workspaceId],
        );
        return row.id;
      };
      const categoryOf = async (id: string) =>
        (
          await dataSource.query(
            'SELECT category_id, category_source, category_reason FROM transactions WHERE id = $1',
            [id],
          )
        )[0];
      const inBudget = { category_id: budgetCategory, category_source: 'rule', category_reason: budgetName };

      try {
        const created = await send('post', '/subscriptions', {
          vendorName,
          amount: 4.5,
          frequency: 'weekly',
          currency: 'USD',
          nextChargeDate: today,
          budgetId: budget.body.id,
        }).expect(201);
        subscriptionId = created.body.id;
        expect(created.body.budgetId).toBe(budget.body.id);
        const listed = (await get('/subscriptions')).body;
        matches(SubscriptionList, listed);
        expect(listed).toContainEqual(
          expect.objectContaining({ id: subscriptionId, budgetId: budget.body.id }),
        );

        // Today's charge and the weekly ones after it, to the end of the month.
        const budgets = await get('/budgets');
        matches(BudgetList, budgets.body);
        const listedBudget = budgets.body.find((row: { id: string }) => row.id === budget.body.id);
        expect(listedBudget.subscriptionReserve.items).toEqual([
          { subscriptionId, vendorName, amount: expect.any(Number) },
        ]);
        expect(listedBudget.subscriptionReserve.amount).toBeGreaterThanOrEqual(4.5);
        expect(listedBudget.subscriptionReserve.amount % 4.5).toBeCloseTo(0);
        const single = await get(`/budgets/${budget.body.id}`);
        matches(BudgetItem, single.body);
        expect(single.body.subscriptionReserve).toEqual(listedBudget.subscriptionReserve);

        // A bank row the importer categorised becomes a payment: it moves to the budget.
        const rowId = await addExpense('4.50');
        await dataSource.query(`UPDATE transactions SET category_source = 'keyword' WHERE id = $1`, [
          rowId,
        ]);
        const recorded = await send('post', `/subscriptions/${subscriptionId}/charges`, {
          transactionId: rowId,
        }).expect(201);
        matches(SubscriptionChargeRow, recorded.body);
        expect(await categoryOf(rowId)).toEqual(inBudget);

        // The payee's next rows are linked on insert. One the importer categorised moves to
        // the budget in the same database transaction; one whose category a person picked stays.
        const importedId = await dataSource.transaction(async manager => {
          const saved = await manager.getRepository(Transaction).save(
            manager.getRepository(Transaction).create({
              workspaceId: owner.workspaceId,
              statementId: statementIds[0],
              transactionDate: today as unknown as Date,
              counterpartyName: vendorName,
              paymentPurpose: vendorName,
              debit: 4.55,
              amount: 4.55,
              currency: 'USD',
              transactionType: TransactionType.EXPENSE,
              categoryId: rowCategory,
              categorySource: TransactionCategorySource.KEYWORD,
            }),
          );
          return saved.id;
        });
        const pickedId = await addExpense('4.60');
        const linkedCharges = (await get(`/subscriptions/${subscriptionId}`)).body.charges;
        expect(linkedCharges).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ transactionId: importedId }),
            expect.objectContaining({ transactionId: pickedId }),
          ]),
        );
        expect(await categoryOf(importedId)).toEqual(inBudget);
        expect(await categoryOf(pickedId)).toEqual(
          expect.objectContaining({ category_id: rowCategory, category_source: 'manual' }),
        );

        // Unlinking keeps the row where it is.
        const unlinked = await send('put', `/subscriptions/${subscriptionId}`, {
          budgetId: null,
        }).expect(200);
        expect(unlinked.body.budgetId).toBeNull();
        const detail = await get(`/subscriptions/${subscriptionId}`);
        matches(SubscriptionDetail, detail.body);
        expect(detail.body.subscription.budgetId).toBeNull();
        expect(await categoryOf(rowId)).toEqual(inBudget);
      } finally {
        // Later tests count the subscriptions, budgets and rows.
        if (subscriptionId) await send('delete', `/subscriptions/${subscriptionId}`).expect(200);
        await send('delete', `/budgets/${budget.body.id}`).expect(200);
        await dataSource.query('DELETE FROM transactions WHERE statement_id = ANY($1)', [statementIds]);
        await dataSource.query('DELETE FROM statements WHERE id = ANY($1)', [statementIds]);
      }
    });
  });

  describe('review inbox and payees', () => {
    beforeAll(async () => {
      // The queue holds the rows nobody has confirmed yet.
      await dataSource.query('UPDATE transactions SET is_verified = false WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
    });

    it('GET /review-inbox, every kind', async () => {
      for (const kind of ['transaction', 'receipt', 'duplicate', 'subscription']) {
        const res = await get(`/review-inbox?kind=${kind}&reviewer=anyone`);
        matches(ReviewInboxPage, res.body);
      }
      const transactions = await get('/review-inbox?kind=transaction&reviewer=anyone');
      expect(transactions.body.items.length).toBeGreaterThan(0);
    });

    it('GET /review-inbox/statements', async () => {
      matches(ReviewInboxByStatement, (await get('/review-inbox/statements')).body);
    });

    it('GET /payees, /payees/:id and /payees/:id/pending-review', async () => {
      const res = await get('/payees');
      matches(PayeesPage, res.body);
      expect(res.body.data.length).toBeGreaterThan(0);
      matches(Payee, (await get(`/payees/${res.body.data[0].id}`)).body);
      matches(PayeePendingReview, (await get(`/payees/${res.body.data[0].id}/pending-review`)).body);
    });
  });

  describe('forecast', () => {
    it('GET /forecast, with the subscriptions above as events', async () => {
      const res = await get('/forecast?days=90');
      matches(ForecastResponse, res.body);
      expect(res.body.events.length).toBeGreaterThan(0);
      matches(ForecastResponse, (await get('/forecast?days=30&expenseFactor=1.2')).body);
    });
  });

  describe('invoices', () => {
    let clientId: string;
    let invoiceId: string;

    beforeAll(async () => {
      const send = (method: 'post' | 'put', url: string, body?: object) =>
        request(app.getHttpServer())
          [method](url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body);
      // Sending needs the seller's details on the document.
      await send('put', '/business-profile', {
        legalName: 'Contract Studio',
        addressLines: '1 Main St',
      }).expect(200);
      const client = await send('post', '/clients', {
        name: 'Acme GmbH',
        email: 'billing@acme.example',
        currency: 'USD',
        peppolId: '0208:0428643097',
      }).expect(201);
      clientId = client.body.id;
      const invoice = await send('post', '/invoices', {
        clientId,
        issueDate: '2026-01-05',
        dueDate: '2026-02-04',
        currency: 'USD',
        lineItems: [{ description: 'Design work', quantity: 2, unitPrice: 150.5 }],
      }).expect(201);
      invoiceId = invoice.body.id;
      await send('put', `/invoices/${invoiceId}/send`).expect(200);
      await send('post', '/credit-notes', {
        reason: 'Discount',
        applications: [{ invoiceId, amount: 20 }],
      }).expect(201);
      // No SMTP in the test env: the attempt is still recorded, as skipped or failed.
      await send('post', `/invoices/${invoiceId}/deliveries`, {});
    }, 60_000);

    it('GET /clients and /clients/:id', async () => {
      matches(ClientList, (await get('/clients')).body);
      matches(Client, (await get(`/clients/${clientId}`)).body);
    });

    it('GET /invoices and /invoices/:id, money as decimal strings', async () => {
      const list = await get('/invoices');
      matches(InvoiceListPage, list.body);
      const one = await get(`/invoices/${invoiceId}`);
      matches(Invoice, one.body);
      expect(one.body.total).toBe('301.00');
      expect(one.body.lineItems[0].unitPrice).toBe('150.50');
      expect(one.body.amountCredited).toBe(20);
    });

    it('GET the ageing, settings, late fee, deliveries and credit notes', async () => {
      matches(AgeingReport, (await get('/invoices/ageing')).body);
      matches(InvoiceSettings, (await get('/invoices/settings')).body);
      matches(LateFeeQuote, (await get(`/invoices/clients/${clientId}/late-fee`)).body);
      matches(InvoiceDeliveryList, (await get(`/invoices/${invoiceId}/deliveries`)).body);
      const notes = await get(`/invoices/${invoiceId}/credit-notes`);
      matches(CreditNoteList, notes.body);
      expect(notes.body).toHaveLength(1);
    });

    it('GET /invoices/:id/peppol and POST /peppol/lookup', async () => {
      await dataSource.query(
        `INSERT INTO peppol_connections (workspace_id, api_key_id, api_secret, company_id, sender_peppol_id)
         VALUES ($1, 'key_c', $2, 'c_1', '9930:DE123456789')`,
        [owner.workspaceId, encryptText('secret_c')],
      );
      await dataSource.query(
        `INSERT INTO peppol_transmissions
           (workspace_id, invoice_id, recipient, format, doc_type_id, provider_document_id, document_xml, status, failure)
         VALUES ($1, $2, '0208:0428643097', 'peppol_bis', 'urn:x', 'doc_1', '<Invoice/>', 'failed', 'Receiver rejected')`,
        [owner.workspaceId, invoiceId],
      );
      const log = await get(`/invoices/${invoiceId}/peppol`);
      matches(PeppolTransmissionList, log.body);
      expect(log.body).toHaveLength(1);

      const fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              success: true,
              isValid: true,
              companyName: 'Klant NV',
              supportedDocuments: [{ docTypeId: PEPPOL_DOCTYPES.bisInvoice, name: 'Invoice' }],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      );
      try {
        const lookup = await request(app.getHttpServer())
          .post('/peppol/lookup')
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send({ peppolId: '0208:0428643097' })
          .expect(201);
        matches(PeppolLookup, lookup.body);
        expect(lookup.body).toEqual({ registered: true, companyName: 'Klant NV', formats: ['peppol_bis'] });
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('payables', () => {
    let payableId: string;

    beforeAll(async () => {
      const post = (url: string, body: object) =>
        request(app.getHttpServer())
          .post(url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .send(body)
          .expect(201);
      const tag = await post('/tags', { name: 'Contract Bills', color: '#22c55e' });
      const payable = await post('/payables', {
        vendor: 'Contract Coffee',
        amount: 120.4,
        currency: 'USD',
        dueDate: '2026-12-01',
        tagIds: [tag.body.id],
      });
      payableId = payable.body.id;
      await post(`/payables/${payableId}/payments`, { amount: 20, paidOn: '2026-10-01' });
    });

    it('GET /payables (both directions) and /payables/:id', async () => {
      const bills = await get('/payables?direction=payable');
      matches(PayableListPage, bills.body);
      expect(bills.body.data[0].paidAmount).toBe('20.00');
      // The sent invoice above put a receivable here.
      const receivables = await get('/payables?direction=receivable');
      matches(PayableListPage, receivables.body);
      expect(receivables.body.data.length).toBeGreaterThan(0);
      const one = await get(`/payables/${payableId}`);
      matches(Payable, one.body);
      expect(one.body.tags.map((tag: { name: string }) => tag.name)).toEqual(['Contract Bills']);
      const tagged = await get(`/payables?direction=payable&tagId=${one.body.tags[0].id}`);
      matches(PayableListPage, tagged.body);
      expect(tagged.body.data.map((bill: { id: string }) => bill.id)).toEqual([payableId]);
    });

    it('GET /payables/summary, payments and payment candidates', async () => {
      matches(PayablesSummary, (await get('/payables/summary?direction=payable')).body);
      const payments = await get(`/payables/${payableId}/payments`);
      matches(PayablePaymentList, payments.body);
      expect(payments.body).toHaveLength(1);
      matches(PaymentCandidateList, (await get(`/payables/${payableId}/payment-candidates`)).body);
    });
  });

  describe('settings and account', () => {
    const send = (method: 'post' | 'put', url: string, body: object) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body);

    it('GET /auth/2fa and /auth/sessions', async () => {
      matches(TwoFactorStatus, (await get('/auth/2fa')).body);
      const sessions = await get('/auth/sessions');
      matches(UserSessionList, sessions.body);
      expect(sessions.body.length).toBeGreaterThan(0);
    });

    it('GET /backups/config before and after setup, and /backups/runs', async () => {
      // Not set up: Nest sends null as an empty body, which the client reads as ''.
      expect((await get('/backups/config')).text).toBe('');
      await send('put', '/backups/config', {
        destinationKind: 'local',
        password: 'contract-backup-pass',
      }).expect(200);
      const config = await get('/backups/config');
      matches(BackupConfiguration, config.body);
      expect(config.body.passwordConfigured).toBe(true);
      await dataSource.getRepository(BackupRun).save({
        workspaceId: owner.workspaceId,
        configurationId: config.body.id,
        trigger: BackupRunTrigger.MANUAL,
        status: BackupRunStatus.SUCCEEDED,
        sizeBytes: '2048',
        startedAt: new Date(),
        finishedAt: new Date(),
      });
      const runs = await get('/backups/runs');
      matches(BackupRunList, runs.body);
      expect(runs.body[0].sizeBytes).toBe('2048');
    });

    it('GET /business-profile, never saved and saved', async () => {
      // A workspace of its own: the invoices above already saved this one's profile.
      const workspace = await send('post', '/workspaces', { name: 'Contracts Fresh' }).expect(201);
      const fresh = await request(app.getHttpServer())
        .get('/business-profile')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', workspace.body.id)
        .expect(200);
      matches(BusinessProfileResponse, fresh.body);
      expect(fresh.body.missingRequired).toEqual(['legalName', 'addressLines']);
      const saved = await get('/business-profile');
      matches(BusinessProfileResponse, saved.body);
      expect(saved.body.missingRequired).toEqual([]);
    });

    it('GET exchange-rate coverage, notification preferences and integration settings', async () => {
      matches(ExchangeRateCoverage, (await get('/exchange-rates/coverage')).body);
      const preferences = await get('/notifications/preferences');
      matches(NotificationPreferences, preferences.body);
      expect(Object.keys(preferences.body.channels).length).toBeGreaterThan(0);
      matches(LocalCategorizationStatus, (await get('/settings/local-categorization')).body);
      matches(TelegramBotStatus, (await get('/settings/notifications/telegram')).body);
      matches(TelegramReportPage, (await get('/telegram/reports')).body);
      matches(PushPublicKey, (await get('/push/public-key')).body);
    });

    it('GET /users, /users/:id/permissions and /users/me/disclaimer', async () => {
      // The admin page is for the instance admin, not a workspace owner.
      await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', owner.userId]);
      const users = await get('/users');
      matches(AdminUserList, users.body);
      expect(users.body.length).toBeGreaterThan(0);
      matches(UserPermissions, (await get(`/users/${users.body[0].id}/permissions`)).body);
      matches(DisclaimerStatus, (await get('/users/me/disclaimer')).body);
    });

    it('GET /system/update, with a release and an updater run', async () => {
      await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', owner.userId]);
      const dir = path.join(process.cwd(), 'update');
      const created = !existsSync(dir);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'heartbeat'), '');
      writeFileSync(
        path.join(dir, 'status.json'),
        JSON.stringify({
          state: 'failed',
          tag: 'v1.3.0',
          step: 'pull',
          message: 'manifest unknown',
          backup: 'backup_20261016_100000.sql',
          startedAt: '2026-10-16T10:00:00Z',
          finishedAt: '2026-10-16T10:01:00Z',
        }),
      );
      const originalFetch = global.fetch;
      const originalVersion = process.env.APP_VERSION;
      process.env.APP_VERSION = 'v1.2.0';
      global.fetch = (async () =>
        new Response(
          JSON.stringify({
            tag_name: 'v1.3.0',
            html_url: 'https://github.com/symonbaikov/seneca/releases/tag/v1.3.0',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as typeof fetch;
      try {
        const status = await get('/system/update');
        matches(SystemUpdateStatus, status.body);
        expect(status.body).toMatchObject({
          currentVersion: 'v1.2.0',
          latestVersion: 'v1.3.0',
          updateAvailable: true,
          updaterAvailable: true,
          run: { state: 'failed', step: 'pull' },
        });
      } finally {
        global.fetch = originalFetch;
        process.env.APP_VERSION = originalVersion;
        if (created) rmSync(dir, { recursive: true, force: true });
        else for (const file of ['heartbeat', 'status.json']) rmSync(path.join(dir, file), { force: true });
      }
    });

    it('GET /workspaces/invitations/:token', async () => {
      const invite = await send('post', `/workspaces/${owner.workspaceId}/invitations`, {
        email: `contracts-invitee-${Date.now()}@example.com`,
        role: 'member',
      }).expect(201);
      const preview = await request(app.getHttpServer())
        .get(`/workspaces/invitations/${invite.body.invitation.token}`)
        .expect(200);
      matches(InvitationPreview, preview.body);
    });
  });

  describe('storage, receipts and attachments', () => {
    let statementId: string;
    let transactionId: string;
    let tagId: string;
    let receiptId: string;
    const send = (method: 'post' | 'put', url: string, body: object) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body);

    beforeAll(async () => {
      const files = await get('/storage/files');
      statementId = files.body[0].id;
      const rows = await get(`/transactions?statement_id=${statementId}`);
      transactionId = rows.body.data[0].id;
      tagId = (
        await send('post', '/tags', {
          name: 'Contracts',
          color: '#22c55e',
          description: 'Tagged for the contract run',
          tagDate: '2026-09-03',
        }).expect(201)
      ).body.id;
      await send('put', `/transactions/${transactionId}/tags`, { tagIds: [tagId] }).expect(200);
      await send('post', '/storage/folders', { name: 'Contracts folder', tagId }).expect(201);
      await send('post', '/storage/views', { name: 'Contracts view', filters: { search: 'x' } }).expect(
        201,
      );
      await send('post', `/storage/files/${statementId}/share`, {
        permission: 'download',
        password: 'contract-share',
        description: 'For the accountant',
      }).expect(201);
      const member = await registerAccount(app, `contracts-member-${Date.now()}@example.com`, 'Member');
      const invite = await send('post', `/workspaces/${owner.workspaceId}/invitations`, {
        email: member.email,
        role: 'member',
      }).expect(201);
      await request(app.getHttpServer())
        .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);
      await send('post', `/storage/files/${statementId}/permissions`, {
        userId: member.email,
        permissionType: 'viewer',
      }).expect(201);
      await request(app.getHttpServer())
        .post(`/transactions/${transactionId}/attachments`)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .attach('file', Buffer.from('%PDF-1.4 contract'), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      const categories = await get('/categories?type=expense');
      const receipt = await dataSource.getRepository(Receipt).save({
        userId: owner.userId,
        workspaceId: owner.workspaceId,
        source: ReceiptSource.SCAN,
        subject: 'Contract Coffee receipt',
        sender: 'scan',
        receivedAt: new Date(),
        status: ReceiptStatus.NEEDS_REVIEW,
        transactionId,
        confidence: 0.87,
        taxAmount: 1.5,
        metadata: { attachments: [{ id: 'a1', filename: 'r.jpg', mimeType: 'image/jpeg', size: 10 }] },
        parsedData: {
          amount: 42.5,
          currency: 'USD',
          vendor: 'Contract Coffee',
          categoryId: categories.body[0].id,
          lineItems: [
            { description: 'Coffee', amount: 30 },
            { description: 'Cake', amount: 12.5, categoryId: categories.body[1].id },
          ],
        },
      });
      receiptId = receipt.id;
      await send('put', `/receipts/${receiptId}/tags`, { tagIds: [tagId] }).expect(200);
    });

    it('GET /tags, with how often each tag is used, and /receipts/:id/tags', async () => {
      const tags = await get('/tags');
      matches(TagList, tags.body);
      const links = await get('/tags/transaction-links');
      matches(TransactionTagLinks, links.body);
      expect(links.body).toContainEqual({ transactionId, tagId });
      const contracts = tags.body.find((tag: { id: string }) => tag.id === tagId);
      expect(contracts).toMatchObject({
        name: 'Contracts',
        description: 'Tagged for the contract run',
        tagDate: '2026-09-03',
      });
      // The transaction and the receipt carry it.
      expect(contracts.usageCount).toBeGreaterThanOrEqual(2);
      const onReceipt = await get(`/receipts/${receiptId}/tags`);
      matches(StorageTagList, onReceipt.body);
      expect(onReceipt.body).toEqual([expect.objectContaining({ id: tagId, name: 'Contracts' })]);
    });

    it('GET /storage/files, /storage/files/:id, folders, tags and views', async () => {
      const files = await get('/storage/files');
      matches(StorageFileList, files.body);
      const details = await get(`/storage/files/${statementId}`);
      matches(StorageFileDetails, details.body);
      expect(details.body.sharedLinks[0].password).toBe('******');
      expect(details.body.permissions).toHaveLength(1);
      expect(details.body.transactions.length).toBeGreaterThan(0);
      matches(StorageFolderList, (await get('/storage/folders')).body);
      matches(StorageTagList, (await get('/storage/tags')).body);
      matches(StorageViewList, (await get('/storage/views')).body);
    });

    it('GET /storage/shared/:token, public', async () => {
      const details = await get(`/storage/files/${statementId}`);
      const res = await request(app.getHttpServer())
        .get(`/storage/shared/${details.body.sharedLinks[0].token}`)
        .set('x-share-password', 'contract-share')
        .expect(200);
      matches(SharedFileAccess, res.body);
      expect(res.body.transactions.length).toBeGreaterThan(0);
    });

    it('GET /statements/:id', async () => {
      matches(StatementDetail, (await get(`/statements/${statementId}`)).body);
    });

    it('GET /transactions/:id/tags and /attachments', async () => {
      const tags = await get(`/transactions/${transactionId}/tags`);
      matches(StorageTagList, tags.body);
      expect(tags.body).toHaveLength(1);
      const attachments = await get(`/transactions/${transactionId}/attachments`);
      matches(TransactionAttachmentList, attachments.body);
      expect(attachments.body).toHaveLength(1);
    });

    it('GET /receipts, /receipts/:id, its matches and its split', async () => {
      const page = await get('/receipts');
      matches(ReceiptListPage, page.body);
      expect(page.body.data.length).toBeGreaterThan(0);
      const one = await get(`/receipts/${receiptId}`);
      matches(ReceiptRecord, one.body);
      expect(one.body.category).not.toBeNull();
      matches(ReceiptTransactionMatches, (await get(`/receipts/${receiptId}/transaction-matches`)).body);
      matches(ReceiptSplitSuggestion, (await get(`/receipts/${receiptId}/split-suggestion`)).body);
    });
  });

  describe('custom tables', () => {
    let tableId: string;
    let shareToken: string;
    const send = (method: 'post' | 'patch', url: string, body: object) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body);

    beforeAll(async () => {
      const categories = await get('/categories?type=expense');
      const table = await send('post', '/custom-tables', {
        name: 'Contract costs',
        description: 'Checked against its contract',
        categoryId: categories.body[0].id,
      }).expect(201);
      tableId = table.body.id;
      const amount = await send('post', `/custom-tables/${tableId}/columns`, {
        title: 'Amount',
        type: 'number',
      }).expect(201);
      const vendor = await send('post', `/custom-tables/${tableId}/columns`, {
        title: 'Vendor',
        type: 'text',
      }).expect(201);
      await send('post', `/custom-tables/${tableId}/columns`, {
        title: 'Kind',
        type: 'select',
        config: { options: ['Rent', 'Food'] },
      }).expect(201);
      for (const [value, name] of [
        [120.5, 'Landlord'],
        [30, 'Cafe'],
        [30, 'Cafe'],
      ] as const) {
        await send('post', `/custom-tables/${tableId}/rows`, {
          data: { [amount.body.key]: value, [vendor.body.key]: name },
        }).expect(201);
      }
      await send('patch', `/custom-tables/${tableId}/view-settings/summaries`, {
        summaries: [{ title: 'Total', expression: `SUM([${amount.body.key}])` }],
      }).expect(200);
      shareToken = (await send('post', `/custom-tables/${tableId}/shares`, {}).expect(201)).body.token;
    });

    it('GET /custom-tables and /custom-tables/:id', async () => {
      const list = await get('/custom-tables');
      matches(CustomTableList, list.body);
      expect(list.body.items[0].category).not.toBeNull();
      const detail = await get(`/custom-tables/${tableId}`);
      matches(CustomTableDetail, detail.body);
      expect(detail.body.columns).toHaveLength(3);
    });

    it('GET rows, aggregates, groups and summaries', async () => {
      const detail = await get(`/custom-tables/${tableId}`);
      const [amount, vendor] = detail.body.columns;
      const rows = await get(`/custom-tables/${tableId}/rows`);
      matches(CustomTableRowPage, rows.body);
      expect(rows.body.items).toHaveLength(3);
      const aggs = encodeURIComponent(
        JSON.stringify([
          { col: amount.key, fn: 'sum' },
          { col: vendor.key, fn: 'count' },
        ]),
      );
      matches(CustomTableAggregates, (await get(`/custom-tables/${tableId}/aggregates?aggs=${aggs}`)).body);
      const groups = await get(`/custom-tables/${tableId}/groups?groupBy=${vendor.key}&aggs=${aggs}`);
      matches(CustomTableGroups, groups.body);
      expect(groups.body.items.length).toBe(2);
      const summaries = await get(`/custom-tables/${tableId}/summaries`);
      matches(CustomTableSummaries, summaries.body);
      expect(summaries.body.items).toHaveLength(1);
    });

    it('GET /custom-tables/:id/money-total', async () => {
      const amounts = [250.25, -40];
      const table = await send('post', '/custom-tables', { name: 'Contract balance' }).expect(201);
      const money = await send('post', `/custom-tables/${table.body.id}/columns`, {
        title: 'Amount',
        type: 'currency',
      }).expect(201);
      for (const value of amounts) {
        await send('post', `/custom-tables/${table.body.id}/rows`, {
          data: { [money.body.key]: value },
        }).expect(201);
      }
      const total = await get(`/custom-tables/${table.body.id}/money-total`);
      matches(CustomTableMoneyTotal, total.body);
      expect(total.body).toMatchObject({
        column: money.body.key,
        total: amounts.reduce((a, b) => a + b, 0),
        missing: [],
      });
    });

    it('GET the public share and /reports/custom-tables/available', async () => {
      const view = await request(app.getHttpServer())
        .get(`/public/custom-tables/${shareToken}`)
        .expect(200);
      matches(SharedTableView, view.body);
      const rows = await request(app.getHttpServer())
        .get(`/public/custom-tables/${shareToken}/rows`)
        .expect(200);
      matches(SharedTableRows, rows.body);
      expect(rows.body.items).toHaveLength(3);
      matches(AvailableCustomTables, (await get('/reports/custom-tables/available')).body);
    });
  });

  describe('tax and income tax', () => {
    const taxYear = 2025;
    const send = (method: 'post' | 'put', url: string, body: object) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body);

    beforeAll(async () => {
      await send('put', '/tax/settings/jurisdiction', { code: 'DE' }).expect(200);
      await send('put', '/income-tax/profile', {
        taxYear,
        taxpayerType: 'self_employed',
        details: { homeOfficeDays: 120 },
      }).expect(200);
      const categories = await get('/categories?type=expense');
      const rates = await get('/tax-rates');
      await send('post', '/tax/rules', {
        categoryId: categories.body[0].id,
        taxRateCode: rates.body.find((rate: { code: string | null }) => rate.code).code,
        direction: 'expense',
      }).expect(201);
    });

    it('GET the jurisdictions, their rates, the workspace rates, settings and threshold', async () => {
      const jurisdictions = await get('/tax/jurisdictions');
      matches(TaxJurisdictionList, jurisdictions.body);
      expect(jurisdictions.body.length).toBeGreaterThan(10);
      matches(JurisdictionRateList, (await get('/tax/jurisdictions/DE/rates')).body);
      const rates = await get('/tax-rates');
      matches(TaxRateList, rates.body);
      expect(rates.body.length).toBeGreaterThan(0);
      matches(TaxRateList, (await get('/tax/settings/rates')).body);
      matches(WorkspaceTaxSettings, (await get('/tax/settings')).body);
      // A VAT-registered business is past the threshold: null, an empty body.
      expect((await get('/tax/settings/threshold')).text).toBe('');
      await send('put', '/tax/settings/vat-status', { status: 'not_registered' }).expect(200);
      const threshold = await get('/tax/settings/threshold');
      expect(threshold.body).toEqual(expect.objectContaining({ currency: 'EUR' }));
      matches(TaxThresholdStatus, threshold.body);
      await send('put', '/tax/settings/vat-status', { status: 'registered' }).expect(200);
      matches(TaxRuleList, (await get('/tax/rules')).body);
    });

    it('GET and PUT the VAT filing, the reserve, the deadlines, the year report, UStVA and DATEV', async () => {
      const year = new Date().getFullYear();
      matches(VatFilingSettings, (await get('/tax/settings/vat-filing')).body);
      const filing = await send('put', '/tax/settings/vat-filing', {
        frequency: 'monthly',
        extension: true,
      }).expect(200);
      matches(VatFilingSettings, filing.body);
      expect(filing.body).toEqual(expect.objectContaining({ frequency: 'monthly', extension: true }));
      await send('put', '/tax/settings/vat-filing', { frequency: null, extension: false }).expect(
        200,
      );

      const categories = await get('/categories?type=expense');
      const reserve = await send('put', '/tax/settings/reserve', {
        percent: 25,
        paymentsCategoryId: categories.body[0].id,
      }).expect(200);
      matches(TaxReserveSettings, reserve.body);
      matches(TaxReserveSettings, (await get('/tax/settings/reserve')).body);
      const amount = await get('/tax/settings/reserve/amount');
      matches(TaxReserve, amount.body);
      expect(amount.body.incomeTax).not.toBeNull();

      const deadlines = await get('/tax/deadlines');
      matches(TaxDeadlineList, deadlines.body);
      const vatReturn = deadlines.body.find((row: { kind: string }) => row.kind === 'vat_return');
      expect(vatReturn).toBeDefined();
      const filed = await send('put', '/tax/deadlines/filed-elsewhere', {
        kind: 'vat_return',
        periodEnd: vatReturn.periodEnd,
        filed: true,
      }).expect(200);
      matches(TaxDeadlineList, filed.body);
      await send('put', '/tax/deadlines/filed-elsewhere', {
        kind: 'vat_return',
        periodEnd: vatReturn.periodEnd,
        filed: false,
      }).expect(200);

      // Marked tax-relevant, a category's rows are in the year report.
      await send('put', `/categories/${categories.body[0].id}`, { taxRelevant: true }).expect(200);
      matches(TaxYearReport, (await get(`/tax/year-report?year=${year}`)).body);

      matches(TaxReassessment, (await send('post', '/tax/settings/reassess', {}).expect(201)).body);
      const status = await send('put', '/tax/settings/vat-status', { status: 'registered' }).expect(
        200,
      );
      matches(VatStatusChange, status.body);
      const ustva = await get(`/tax/returns/ustva?periodStart=${year}-01-01&periodEnd=${year}-03-31`);
      matches(UstvaResult, ustva.body);
      expect(ustva.body.unsupported).not.toBe('not_germany');
      matches(OfficialRatesCheck, (await get('/tax/settings/official-rates')).body);

      matches(DatevSettings, (await get('/tax/datev/settings')).body);
      const datev = await send('put', '/tax/datev/settings', {
        chart: '03',
        consultantNumber: 1001,
        clientNumber: 1,
        bankAccount: '1200',
      }).expect(200);
      matches(DatevSettings, datev.body);
      // A row of its own: earlier tests pair the shared expense, which DATEV leaves out.
      await request(app.getHttpServer())
        .post('/statements/manual-expense')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .field('amount', '19.00')
        .field('currency', 'EUR')
        .field('merchant', 'DATEV Supplies')
        .field('categoryId', categories.body[0].id)
        .field('date', new Date().toISOString().slice(0, 10))
        .expect(201);
      const mapping = await get(`/tax/datev/mapping?year=${year}`);
      matches(DatevMapping, mapping.body);
      expect(mapping.body.categories.length).toBeGreaterThan(0);
      matches(DatevPreview, (await get(`/tax/datev/preview?from=${year}-01-01&to=${year}-12-31`)).body);
    });

    it('GET /tax/returns/preview and /tax/returns/period', async () => {
      const period = 'periodStart=2026-01-01&periodEnd=2026-12-31';
      matches(TaxReturnPreview, (await get(`/tax/returns/preview?${period}`)).body);
      matches(TaxReturnRecord, (await get(`/tax/returns/period?${period}`)).body);
    });

    it('GET the income tax disclaimer, profile, mappings and draft', async () => {
      matches(IncomeTaxDisclaimer, (await get('/income-tax/disclaimer')).body);
      const profile = await get(`/income-tax/profile?taxYear=${taxYear}`);
      matches(IncomeTaxProfile, profile.body);
      expect(profile.body.filingInfo).not.toBeNull();
      matches(IncomeTaxMappings, (await get(`/income-tax/mappings?taxYear=${taxYear}`)).body);
      matches(IncomeTaxDraft, (await get(`/income-tax/returns/${taxYear}`)).body);
    });
  });

  describe('ledger and reconciliation', () => {
    beforeAll(async () => {
      matches(LedgerSettings, (await get('/ledger/settings')).body);
      await request(app.getHttpServer())
        .put('/ledger/settings')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send({ baseCurrency: 'USD' })
        .expect(200);
      // The worker books the history in the background. Integrity can read "up
      // to date" before the first job runs, so wait for the entries themselves.
      for (let attempt = 0; attempt < 60; attempt++) {
        const [integrity, entries] = await Promise.all([
          get('/ledger/integrity'),
          get('/ledger/entries'),
        ]);
        if (integrity.body.upToDate && entries.body.data.length > 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }, 60_000);

    it('GET settings, integrity, accounts, entries and one entry', async () => {
      matches(LedgerSettings, (await get('/ledger/settings')).body);
      matches(LedgerIntegrity, (await get('/ledger/integrity')).body);
      const accounts = await get('/ledger/accounts');
      matches(LedgerAccountList, accounts.body);
      const entries = await get('/ledger/entries');
      matches(JournalEntryPage, entries.body);
      expect(entries.body.data.length).toBeGreaterThan(0);
      matches(JournalEntryDetail, (await get(`/ledger/entries/${entries.body.data[0].id}`)).body);
    });

    it('GET an account ledger and the trial balance', async () => {
      const entry = await get(
        `/ledger/entries/${(await get('/ledger/entries')).body.data[0].id}`,
      );
      const accountId = entry.body.lines[0].accountId;
      const ledger = await get(`/ledger/reports/accounts/${accountId}`);
      matches(AccountLedger, ledger.body);
      expect(ledger.body.lines.length).toBeGreaterThan(0);
      matches(TrialBalance, (await get('/ledger/reports/trial-balance')).body);
    });

    it('GET /reconciliation', async () => {
      matches(ReconciliationResponse, (await get('/reconciliation')).body);
    });
  });

  describe('the rest of the reads', () => {
    let transactionId: string;
    const send = (method: 'post' | 'put', url: string, body: object) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .send(body);

    beforeAll(async () => {
      transactionId = (await get('/transactions')).body.data[0].id;
      await send('post', '/notes', {
        entityType: 'transaction',
        entityId: transactionId,
        body: 'Ask about this one',
      }).expect(201);
      await send('post', '/reports/generate', {
        templateId: 'pnl',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        format: 'csv',
      }).expect(201);
      await send('post', '/reports/schedules', {
        templateId: 'pnl',
        format: 'pdf',
        cadence: 'monthly',
        recipients: ['accountant@example.com'],
      }).expect(201);
      await send('post', '/webhook-endpoints', { name: 'Contract inbound' }).expect(201);
      await send('post', '/webhook-subscriptions', {
        name: 'Contract outbound',
        url: 'https://example.com/hooks/seneca',
        secret: 'contract-signing-secret',
        events: ['transaction.created'],
      }).expect(201);
    });

    it('GET activity, a usage count, a rate, the daily quote and the map styles', async () => {
      matches(WorkspaceActivity, (await get('/audit-events/activity?limit=8')).body);
      const categories = await get('/categories?type=expense');
      matches(CategoryUsageCount, (await get(`/categories/${categories.body[0].id}/usage-count`)).body);
      matches(ExchangeRateQuote, (await get('/exchange-rates?from=USD&to=USD')).body);
      matches(DailyQuote, (await get('/insights/daily-quote')).body);
      matches(MapStyles, (await get('/maps/styles')).body);
    });

    it('GET notes and an allocation suggestion', async () => {
      const notes = await get(`/notes?entityType=transaction&entityId=${transactionId}`);
      matches(NoteList, notes.body);
      expect(notes.body.items).toHaveLength(1);
      matches(
        AllocationSuggestion,
        (await get(`/payables/allocation-suggestion/${transactionId}`)).body,
      );
    });

    it('GET the report history and schedules, webhooks and a subscription', async () => {
      const history = await get('/reports/history');
      matches(ReportHistoryList, history.body);
      expect(history.body.length).toBeGreaterThan(0);
      matches(ReportScheduleList, (await get('/reports/schedules')).body);
      matches(WebhookEndpointList, (await get('/webhook-endpoints')).body);
      matches(WebhookSubscriptionList, (await get('/webhook-subscriptions')).body);
      const subscriptions = await get('/subscriptions');
      matches(SubscriptionDetail, (await get(`/subscriptions/${subscriptions.body[0].id}`)).body);
    });

    it('confirms a detected subscription and returns its charges', async () => {
      // Confirming records the charges detection found; it used to fail on the
      // charge table's match_status column.
      const detected = await dataSource.getRepository(Subscription).save({
        workspaceId: owner.workspaceId,
        vendorName: 'Contract Coffee',
        amount: 42.5,
        currency: 'USD',
        frequency: SubscriptionFrequency.MONTHLY,
        status: SubscriptionStatus.DETECTED,
        detectionMeta: { transactionIds: [transactionId] },
      });
      await send('post', `/subscriptions/${detected.id}/confirm`, {}).expect(201);
      const detail = await get(`/subscriptions/${detected.id}`);
      matches(SubscriptionDetail, detail.body);
      expect(detail.body.charges).toHaveLength(1);
    });
  });

  describe('reports, search and the remaining views', () => {
    it('GET the budget impact of an expense and the Stoic balance', async () => {
      const categories = await get('/categories?type=expense');
      matches(
        BudgetImpact,
        (await get(`/budgets/impact?categoryId=${categories.body[0].id}&amount=500`)).body,
      );
      matches(StoicBalance, (await get('/budgets/stoic-balance')).body);
    });

    it('GET a sent invoice through its public link', async () => {
      const [row] = await dataSource.query(
        'SELECT share_token FROM invoices WHERE workspace_id = $1 AND share_token IS NOT NULL LIMIT 1',
        [owner.workspaceId],
      );
      const view = await request(app.getHttpServer())
        .get(`/public/invoices/${row.share_token}`)
        .expect(200);
      matches(PublicInvoiceView, view.body);
      expect(view.body.lines.length).toBeGreaterThan(0);
    });

    it('GET the cash-flow map and the spend flow', async () => {
      // Reports count reviewed rows only; the manual expense is still waiting.
      await dataSource.query(
        'UPDATE transactions SET is_verified = true WHERE workspace_id = $1',
        [owner.workspaceId],
      );
      matches(CashFlowMap, (await get('/reports/cash-flow-map')).body);
      const flow = await get('/reports/spend-flow?type=expense');
      matches(SpendFlow, flow.body);
      expect(flow.body.nodes.length).toBeGreaterThan(0);
      const byTag = await get('/reports/spend-flow?type=expense&groupBy=tag');
      matches(SpendFlow, byTag.body);
      expect(byTag.body.nodes.some((node: { kind: string }) => node.kind === 'tag')).toBe(true);
    });

    it('GET /search and /search/recent', async () => {
      const found = await get('/search?q=Contract');
      matches(SearchResponse, found.body);
      expect(found.body.results.length).toBeGreaterThan(0);
      matches(SearchResponse, (await get('/search/recent')).body);
    });

    it('GET transfer and reimbursement candidates and the duplicate groups', async () => {
      const transactionId = (await get('/transactions')).body.data[0].id;
      matches(
        TransactionCandidates,
        (await get(`/transactions/${transactionId}/transfer-candidates`)).body,
      );
      // Only an incoming row can be a reimbursement: book one next to the expense.
      const repository = dataSource.getRepository(Transaction);
      const { id: _id, createdAt: _c, updatedAt: _u, fingerprint: _f, ...expense } =
        await repository.findOneByOrFail({ id: transactionId });
      const income = await repository.save({
        ...expense,
        transactionType: TransactionType.INCOME,
        debit: null,
        credit: 42.5,
        counterpartyName: 'Contract refund',
      });
      matches(
        TransactionCandidates,
        (await get(`/transactions/${income.id}/reimbursement-candidates`)).body,
      );
      // The same expense booked twice (manual entry refuses it, an import would not).
      await repository.save({ ...expense, counterpartyName: expense.counterpartyName });
      const duplicates = await get('/transactions/duplicates/detect');
      matches(DuplicateGroups, duplicates.body);
      expect(duplicates.body.groups.length).toBeGreaterThan(0);
    });

    it('GET the bank feed status', async () => {
      matches(BankSyncStatus, (await get('/integrations/simplefin/status')).body);
    });
  });

  describe('mutation responses the app reads', () => {
    const call = (method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: object) => {
      const req = request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId);
      return body ? req.send(body) : req;
    };

    it('settings, storage and tags', async () => {
      const transactionId = (await get('/transactions')).body.data[0].id;
      matches(
        BusinessProfileResponse,
        (await call('put', '/business-profile', { phone: '+49 30 1234' }).expect(200)).body,
      );
      matches(
        BackupConfiguration,
        (await call('put', '/backups/config', { destinationKind: 'local', retentionCount: 5 }).expect(200))
          .body,
      );
      const tag = await call('post', '/storage/tags', { name: 'Mutation tag' }).expect(201);
      matches(StorageTag, tag.body);
      matches(
        StorageTag,
        (await call('patch', `/storage/tags/${tag.body.id}`, { color: '#ff0000' }).expect(200)).body,
      );
      const folder = await call('post', '/storage/folders', { name: 'Mutation folder' }).expect(201);
      matches(StorageFolder, folder.body);
      matches(
        StorageFolder,
        (await call('patch', `/storage/folders/${folder.body.id}`, { name: 'Renamed' }).expect(200)).body,
      );
      matches(StorageViewItem, (await call('post', '/storage/views', { name: 'Mutation view' }).expect(201)).body);
      matches(
        StorageTagList,
        (await call('put', `/transactions/${transactionId}/tags`, { tagIds: [tag.body.id] }).expect(200)).body,
      );
    });

    it('the Tags page: create, edit and delete a tag, and tag a receipt', async () => {
      const created = await call('post', '/tags', {
        name: 'Page tag',
        description: 'A weekend away',
        tagDate: '2026-08-15',
      }).expect(201);
      matches(StorageTag, created.body);
      expect(created.body).toMatchObject({ description: 'A weekend away', tagDate: '2026-08-15' });
      const edited = await call('patch', `/tags/${created.body.id}`, {
        description: null,
        color: '#0ea5e9',
      }).expect(200);
      matches(StorageTag, edited.body);
      expect(edited.body).toMatchObject({ name: 'Page tag', description: null, color: '#0ea5e9' });

      const receiptId = (await get('/receipts')).body.data[0].id;
      const kept = (await get(`/receipts/${receiptId}/tags`)).body.map((tag: { id: string }) => tag.id);
      const tagged = await call('put', `/receipts/${receiptId}/tags`, {
        tagIds: [...kept, created.body.id],
      }).expect(200);
      matches(StorageTagList, tagged.body);
      expect(tagged.body.map((tag: { id: string }) => tag.id)).toContain(created.body.id);

      // Deleting the tag takes it off the receipt and leaves the others.
      await call('delete', `/tags/${created.body.id}`).expect(200);
      const after = (await get(`/receipts/${receiptId}/tags`)).body.map((tag: { id: string }) => tag.id);
      expect(after.sort()).toEqual([...kept].sort());
    });

    it('clients, invoice settings and payables, money as decimal strings', async () => {
      const client = await call('post', '/clients', { name: 'Mutation Client', currency: 'USD' }).expect(201);
      matches(Client, client.body);
      matches(Client, (await call('put', `/clients/${client.body.id}`, { taxId: 'DE123' }).expect(200)).body);
      matches(InvoiceSettings, (await call('put', '/invoices/settings', { paymentTermsDays: 21 }).expect(200)).body);
      const payable = await call('post', '/payables', {
        vendor: 'Mutation Vendor',
        amount: 50,
        currency: 'USD',
        dueDate: '2026-12-01',
      }).expect(201);
      matches(Payable, payable.body);
      expect(payable.body.amount).toBe('50.00');
      const paid = await call('post', `/payables/${payable.body.id}/payments`, {
        amount: 10,
        paidOn: '2026-10-01',
      }).expect(201);
      matches(Payable, paid.body);
      expect(paid.body.paidAmount).toBe('10.00');
      matches(Payable, (await call('put', `/payables/${payable.body.id}`, { comment: 'Edited' }).expect(200)).body);
      const payments = await get(`/payables/${payable.body.id}/payments`);
      matches(
        Payable,
        (await call('delete', `/payables/${payable.body.id}/payments/${payments.body[0].id}`).expect(200))
          .body,
      );
      const bill = await call('post', '/payables', {
        vendor: 'Allocation Vendor',
        amount: 30,
        currency: 'USD',
        dueDate: '2026-12-01',
      }).expect(201);
      const transactionId = (await get('/transactions')).body.data[0].id;
      const allocated = await call('post', '/payables/allocate', {
        transactionId,
        allocations: [{ payableId: bill.body.id, amount: 30 }],
      }).expect(201);
      matches(PayableList, allocated.body);
      matches(Payable, (await call('put', `/payables/${payable.body.id}/mark-paid`, {}).expect(200)).body);
      matches(Payable, (await call('put', `/payables/${payable.body.id}/archive`, {}).expect(200)).body);
    });

    it('ledger accounts and the life of an entry', async () => {
      const account = await call('post', '/ledger/accounts', {
        code: 'MUTATION-1',
        name: 'Mutation asset',
        accountType: 'asset',
      }).expect(201);
      matches(LedgerAccount, account.body);
      const accounts = await get('/ledger/accounts');
      const other = accounts.body.find(
        (candidate: { isPostable: boolean; id: string }) =>
          candidate.isPostable && candidate.id !== account.body.id,
      );
      const entry = await call('post', '/ledger/entries', {
        entryDate: '2026-10-01',
        memo: 'Mutation',
        lines: [
          { accountId: account.body.id, side: 'debit', amount: '10.00' },
          { accountId: other.id, side: 'credit', amount: '10.00' },
        ],
      }).expect(201);
      matches(JournalEntryDetail, entry.body);
      const id = entry.body.id;
      matches(JournalEntryDetail, (await call('patch', `/ledger/entries/${id}`, { memo: 'Edited' }).expect(200)).body);
      matches(JournalEntryDetail, (await call('post', `/ledger/entries/${id}/post`, {}).expect(200)).body);
      matches(JournalEntryDetail, (await call('post', `/ledger/entries/${id}/reverse`, {}).expect(200)).body);
    });

    it('tax rates, custom tables, goals, workspaces, the profile and receipt locations', async () => {
      matches(TaxRateItem, (await call('post', '/tax-rates', { name: 'Mutation 5%', rate: 5 }).expect(201)).body);
      const table = await call('post', '/custom-tables', { name: 'Mutation table' }).expect(201);
      matches(CreatedCustomTable, table.body);
      const column = await call('post', `/custom-tables/${table.body.id}/columns`, {
        title: 'Amount',
        type: 'number',
      }).expect(201);
      matches(CustomTableColumnItem, column.body);
      const row = await call('post', `/custom-tables/${table.body.id}/rows`, {
        data: { [column.body.key]: 1 },
      }).expect(201);
      matches(CustomTableRowItem, row.body);
      matches(
        CustomTableRowItem,
        (
          await call('patch', `/custom-tables/${table.body.id}/rows/${row.body.id}`, {
            data: { [column.body.key]: 2 },
          }).expect(200)
        ).body,
      );
      matches(GoalWithProgress, (await call('post', '/goals', { name: 'Mutation goal', targetAmount: 100 }).expect(201)).body);
      matches(WorkspaceSummary, (await call('post', '/workspaces', { name: 'Mutation workspace' }).expect(201)).body);
      matches(WorkspaceSummary, (await call('post', '/workspaces/demo', { name: 'Demo' }).expect(201)).body);
      matches(WorkspaceSummary, (await call('post', '/workspaces/demo', { name: 'Demo' }).expect(200)).body);
      const profile = await call('patch', '/users/me/preferences', { name: 'Contracts Owner' }).expect(200);
      matches(UserUpdateResponse, profile.body);
      for (const field of ['passwordHash', 'tokenVersion', 'isActive']) {
        expect(profile.body.user).not.toHaveProperty(field);
      }
      const receiptId = (await get('/receipts')).body.data[0].id;
      matches(
        ReceiptRecordUpdate,
        (await call('patch', `/receipts/${receiptId}/location`, { latitude: 52.52, longitude: 13.4 }).expect(200))
          .body,
      );
      matches(ReceiptRecordUpdate, (await call('delete', `/receipts/${receiptId}/location`).expect(200)).body);

      const booked = (await get('/receipts')).body.data.find(
        (receipt: { transactionId: string | null }) => receipt.transactionId,
      );
      const rate = (await get('/tax-rates')).body.find(
        (candidate: { name: string }) => candidate.name === 'Mutation 5%',
      );
      matches(ReceiptTax, (await get(`/receipts/${booked.id}/tax`)).body);
      const picked = await call('put', `/receipts/${booked.id}/tax`, { taxRateId: rate.id }).expect(200);
      matches(ReceiptTax, picked.body);
      expect(picked.body).toMatchObject({ taxRateId: rate.id, taxSource: 'manual' });
      expect(picked.body.taxAmount).not.toBeNull();
      const automatic = await call('put', `/receipts/${booked.id}/tax`, { taxRateId: null }).expect(200);
      matches(ReceiptTax, automatic.body);
      expect(automatic.body.taxSource).not.toBe('manual');
    });
    it('registration and login, which reopens the last workspace', async () => {
      const newcomer = `contracts-newcomer-${Date.now()}@example.com`;
      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: newcomer, password: 'Test123!@#', name: 'Newcomer' })
        .expect(201);
      matches(RegisterResponse, registered.body);
      await deleteUserByEmail(dataSource, newcomer);

      const other = await call('post', '/workspaces', { name: 'Last opened' }).expect(201);
      await call('post', `/workspaces/${other.body.id}/switch`).expect(200);
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Test123!@#' })
        .expect(200);
      matches(LoginResponse, login.body);
      expect(login.body.user.lastWorkspaceId).toBe(other.body.id);
    });
  });

  describe('action responses the app reads', () => {
    // Actions answer 200 or 201 by their own convention: any success will do.
    const succeeded = (res: request.Response) => {
      if (res.status >= 300) {
        throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
      }
    };
    const call = (method: 'post' | 'patch', url: string, body?: object) => {
      const req = request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId);
      return body ? req.send(body) : req;
    };

    it('two-factor setup, enable and new recovery codes', async () => {
      const second = `contracts-2fa-${Date.now()}@example.com`;
      const account = await registerAccount(app, second, 'Second factor');
      const as = (url: string, body: object) =>
        request(app.getHttpServer())
          .post(url)
          .set('Authorization', `Bearer ${account.token}`)
          .set('x-workspace-id', account.workspaceId)
          .send(body);
      const setup = await as('/auth/2fa/setup', { password: 'Test123!@#' }).expect(succeeded);
      matches(TwoFactorSetup, setup.body);
      const enabled = await as('/auth/2fa/enable', {
        code: generateSync({ secret: setup.body.secret }),
      }).expect(succeeded);
      matches(RecoveryCodes, enabled.body);
      matches(
        RecoveryCodes,
        (await as('/auth/2fa/recovery-codes', { password: 'Test123!@#' }).expect(succeeded)).body,
      );
      await deleteUserByEmail(dataSource, second);
    });

    it('report and table previews, tables from a source', async () => {
      matches(
        ReportPreview,
        (
          await call('post', '/reports/preview', {
            templateId: 'pnl',
            dateFrom: '2026-01-01',
            dateTo: '2026-12-31',
            format: 'pdf',
          }).expect(succeeded)
        ).body,
      );
      // The three newer templates go through other builders, so each is read
      // through the contract too, in a language other than English.
      for (const templateId of ['category-by-month', 'budget-vs-actual', 'investment-holdings']) {
        matches(
          ReportPreview,
          (
            await call('post', '/reports/preview', {
              templateId,
              dateFrom: '2026-01-01',
              dateTo: '2026-12-31',
              format: 'pdf',
              locale: 'de',
            }).expect(succeeded)
          ).body,
        );
        await call('post', '/reports/generate', {
          templateId,
          dateFrom: '2026-01-01',
          dateTo: '2026-12-31',
          format: 'pdf',
        }).expect(succeeded);
      }
      matches(
        SourcePreview,
        (await call('post', '/custom-tables/source-preview', { kind: 'transactions' }).expect(succeeded)).body,
      );
      const created = await call('post', '/custom-tables/from-source', {
        kind: 'transactions',
        name: 'From source',
      }).expect(succeeded);
      matches(CreatedFromSource, created.body);
      matches(
        RefreshedFromSource,
        (await call('post', `/custom-tables/${created.body.tableId}/refresh-from-source`).expect(succeeded)).body,
      );
      matches(
        FormulaPreview,
        (
          await call('post', `/custom-tables/${created.body.tableId}/formula-preview`, {
            expression: '1 + 2',
          }).expect(succeeded)
        ).body,
      );
    });

    it('review approvals, notes, goal contributions and income-tax finalize and reopen', async () => {
      const rows = await get('/transactions');
      matches(
        ReviewApproved,
        (await call('post', '/review-inbox/transactions/approve', { ids: [rows.body.data[0].id] }).expect(succeeded))
          .body,
      );
      const statementId = (await get('/storage/files')).body[0].id;
      matches(
        StatementApproved,
        (await call('post', `/review-inbox/statements/${statementId}/approve`).expect(succeeded)).body,
      );
      const note = await call('post', '/notes', {
        entityType: 'transaction',
        entityId: rows.body.data[0].id,
        body: 'Checked',
      }).expect(succeeded);
      matches(NoteItem, note.body);
      matches(NoteItem, (await call('patch', `/notes/${note.body.id}`, { resolved: true }).expect(succeeded)).body);
      matches(
        NoteCounts,
        (
          await call('post', '/notes/counts', {
            entityType: 'transaction',
            entityIds: [rows.body.data[0].id],
          }).expect(succeeded)
        ).body,
      );
      const goal = await call('post', '/goals', { name: 'Contribution goal', targetAmount: 100 }).expect(succeeded);
      matches(
        GoalDetail,
        (await call('post', `/goals/${goal.body.id}/contributions`, { amount: 25 }).expect(succeeded)).body,
      );
      await call('post', '/income-tax/disclaimer').expect(succeeded);
      matches(IncomeTaxDraft, (await call('post', '/income-tax/returns/2025/finalize').expect(succeeded)).body);
      matches(IncomeTaxDraft, (await call('post', '/income-tax/returns/2025/reopen').expect(succeeded)).body);
    });

    it('imports, a webhook endpoint, a chat, an invoice and semantic search', async () => {
      matches(
        ImportSuggestion,
        (
          await call('post', '/entity-imports/suggest', {
            headers: ['Vendor', 'Amount', 'Due'],
            samples: [['Office rent', '1200', '2026-11-01']],
          }).expect(succeeded)
        ).body,
      );
      matches(
        EntityImportResult,
        (
          await call('post', '/entity-imports', {
            target: 'payables',
            mapping: { vendor: 0, amount: 1, dueDate: 2 },
            rows: [['Office rent', '1200', '2026-11-01']],
            dryRun: true,
          }).expect(succeeded)
        ).body,
      );
      matches(
        CreatedWebhookEndpoint,
        (await call('post', '/webhook-endpoints', { name: 'Action endpoint' }).expect(succeeded)).body,
      );
      const clients = await get('/clients');
      // A write answers with the bare row; the page reads the invoice back whole.
      const invoice = await call('post', '/invoices', {
            clientId: clients.body[0].id,
            currency: 'USD',
            issueDate: '2026-10-01',
            dueDate: '2026-10-31',
            lineItems: [{ description: 'Consulting', quantity: 1, unitPrice: 100 }],
          }).expect(succeeded);
      matches(InvoiceCreated, invoice.body);
      matches(XRechnungCheck, (await get(`/invoices/${invoice.body.id}/xrechnung/check`)).body);
    });
  });

  describe('answers the strict api client reads', () => {
    // Actions answer 200 or 201 by their own convention: any success will do.
    const succeeded = (res: request.Response) => {
      if (res.status >= 300) {
        throw new Error(`${res.status} ${JSON.stringify(res.body)}`);
      }
    };
    const call = (method: 'post' | 'patch' | 'put' | 'delete', url: string, body?: object) => {
      const req = request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId);
      return body ? req.send(body) : req;
    };
    // A 1x1 transparent PNG.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );

    it('GET /statements and /transactions as pages, with the parser notes typed', async () => {
      const statements = await get('/statements?page=1&limit=50');
      matches(StatementListPage, statements.body);
      expect(statements.body.data.length).toBeGreaterThan(0);
      const manual = statements.body.data.find(
        (row: { parsingDetails: { importPreview?: { source?: string } } | null }) =>
          row.parsingDetails?.importPreview?.source === 'manual-expense',
      );
      expect(manual).toBeDefined();
      const transactions = await get('/transactions?page=1&limit=50');
      matches(TransactionListPage, transactions.body);
      expect(transactions.body.data[0]).toHaveProperty('statementId');
      const ledger = await get('/transactions?page=1&limit=50&running_balance=1');
      matches(TransactionListPage, ledger.body);
      expect(ledger.body.data[0]).toHaveProperty('runningBalance');
      const overview = await get('/transactions/overview');
      matches(TransactionsOverview, overview.body);
      expect(overview.body.months).toHaveLength(12);
    });

    it("never hands out server paths or other members' account rows", async () => {
      const internal = ['filePath', 'fileHash'];
      const account = ['tokenVersion', 'telegramChatId', 'lastLogin', 'isActive'];
      const statements = await get('/statements?page=1&limit=50');
      for (const row of statements.body.data) {
        for (const key of internal) expect(row).not.toHaveProperty(key);
        for (const key of account) expect(row.user ?? {}).not.toHaveProperty(key);
      }
      const statementId = statements.body.data[0].id;
      const one = await get(`/statements/${statementId}`);
      for (const key of internal) expect(one.body).not.toHaveProperty(key);
      const files = await get('/storage/files');
      for (const row of files.body) {
        for (const key of internal) expect(row).not.toHaveProperty(key);
      }
      const details = await get(`/storage/files/${files.body[0].id}`);
      for (const key of internal) expect(details.body.statement).not.toHaveProperty(key);
      for (const permission of details.body.permissions) {
        for (const key of account) expect(permission.user).not.toHaveProperty(key);
      }
      const audit = await get('/audit-events?limit=50');
      expect(audit.body.data.length).toBeGreaterThan(0);
      // The trail names its actor by id and label; the account row stays home.
      for (const event of audit.body.data) {
        expect(event).not.toHaveProperty('actor');
      }
      const history = await get('/reports/history');
      for (const row of history.body) {
        for (const key of internal) expect(row).not.toHaveProperty(key);
      }
      // The link the storage block above made, with its password.
      const [link] = await dataSource.query(
        "SELECT token FROM shared_links WHERE status = 'active' LIMIT 1",
      );
      const shared = await request(app.getHttpServer())
        .get(`/storage/shared/${link.token}`)
        .set('x-share-password', 'contract-share')
        .expect(200);
      expect(Object.keys(shared.body.statement).sort()).toEqual([
        'accountNumber',
        'bankName',
        'fileName',
        'fileSize',
      ]);
    });

    it('decodes query strings as the DTOs did', async () => {
      const status = (url: string) =>
        request(app.getHttpServer())
          .get(url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .then(res => res.status);
      // An empty value is absent; numbers, booleans and lists arrive as strings.
      expect(await status('/statements?page=&limit=5&approved=true&statuses=completed,error')).toBe(200);
      expect(await status('/statements?statuses=completed&statuses=error')).toBe(200);
      // Unknown keys and values out of range are refused, as forbidNonWhitelisted had it.
      expect(await status('/statements?sortBy=date')).toBe(400);
      expect(await status('/payees?limit=500')).toBe(400);
      expect(await status('/review-inbox?kind=nonsense')).toBe(400);
      expect(await status('/view-preferences/nonsense')).toBe(400);
    });

    it('the setup progress, view preferences, the welcome tutorial and page hints', async () => {
      matches(SetupProgress, (await get('/dashboard/setup-progress')).body);
      matches(ViewPreferenceState, (await get('/view-preferences/transactions')).body);
      await call('put', '/view-preferences/transactions', { state: { owner: 'me' } }).expect(
        succeeded,
      );
      const saved = await get('/view-preferences/transactions');
      matches(ViewPreferenceState, saved.body);
      expect(saved.body.state).toEqual({ owner: 'me' });
      const seen = await call('post', '/users/me/welcome-tutorial').expect(succeeded);
      matches(WelcomeTutorialSeen, seen.body);
      expect(seen.body.welcomeTutorialSeenAt).toEqual(expect.any(String));
      const hints = await call('post', '/users/me/page-hints', { page: 'budgets', version: 1 }).expect(
        succeeded,
      );
      matches(PageHintsSeen, hints.body);
      expect(hints.body.pageHintsSeen).toEqual({ budgets: 1 });
      const reset = await call('delete', '/users/me/page-hints').expect(succeeded);
      matches(PageHintsSeen, reset.body);
      expect(reset.body.pageHintsSeen).toEqual({});
    });

    it('branches, category usage, an uploaded icon and a file category', async () => {
      matches(BranchList, (await get('/branches')).body);
      const usage = await get('/categories/usage/counts');
      matches(CategoryUsageCounts, usage.body);
      const used = Object.values(
        usage.body as Record<string, { transactions: number; lastUsedAt: string | null }>,
      ).filter(entry => entry.transactions > 0);
      expect(used.length).toBeGreaterThan(0);
      for (const entry of used) {
        expect(entry.lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      const icon = await request(app.getHttpServer())
        .post('/data-entry/custom-fields/icon')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .attach('icon', png, { filename: 'icon.png', contentType: 'image/png' })
        .expect(succeeded);
      matches(UploadedIcon, icon.body);
      const statementId = (await get('/storage/files')).body[0].id;
      const categories = await get('/categories?type=expense');
      const moved = await call('patch', `/storage/files/${statementId}/category`, {
        categoryId: categories.body[0].id,
      }).expect(succeeded);
      matches(FileCategoryUpdate, moved.body);
      expect(moved.body.category.id).toBe(categories.body[0].id);
      expect(moved.body).not.toHaveProperty('filePath');
    });

    it('the business logo, a workspace favourite and the custom-tables report', async () => {
      const logo = await request(app.getHttpServer())
        .post('/business-profile/logo')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .attach('logo', png, { filename: 'logo.png', contentType: 'image/png' })
        .expect(succeeded);
      matches(BusinessProfileLogo, logo.body);
      matches(
        WorkspaceFavorite,
        (await call('patch', `/workspaces/${owner.workspaceId}/favorite`).expect(succeeded)).body,
      );
      const report = await call('post', '/reports/custom-tables/report', { days: 365 }).expect(
        succeeded,
      );
      matches(CustomTablesReport, report.body);
      matches(
        CustomTablesReportDrillDown,
        (
          await call('post', '/reports/custom-tables/report/drill-down', {
            counterparty: 'Contract Coffee',
            days: 365,
          }).expect(succeeded)
        ).body,
      );
    });

    it('rows added in a batch, an integration status and the ledger revaluation', async () => {
      const tables = await get('/custom-tables');
      const tableId = tables.body.items[0].id;
      const batch = await call('post', `/custom-tables/${tableId}/rows/batch`, {
        rows: [{ data: {} }, { data: {} }],
      }).expect(succeeded);
      matches(CustomTableRowBatch, batch.body);
      expect(batch.body.rows).toHaveLength(2);
      matches(IntegrationConnection, (await get('/integrations/imap/status')).body);
      // The rows booked above reach the ledger in the background; a revaluation waits for them.
      for (let attempt = 0; attempt < 60; attempt++) {
        if ((await get('/ledger/integrity')).body.upToDate) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      const today = new Date().toISOString().slice(0, 10);
      matches(
        RevaluationResult,
        (await call('post', '/ledger/revaluations', { date: today }).expect(succeeded)).body,
      );
    }, 60_000);

    it('a payee renamed, set on a transaction, and the duplicates marked', async () => {
      const rows = (await get('/transactions')).body.data;
      const transactionId = rows[0].id;
      const set = await call('put', `/transactions/${transactionId}/payee`, {
        name: 'Contract Payee',
      }).expect(succeeded);
      matches(TransactionPayeeResult, set.body);
      const renamed = await call('patch', `/payees/${set.body.payee.id}`, {
        name: 'Contract Payee Renamed',
      }).expect(succeeded);
      matches(PayeeRecord, renamed.body);
      const marked = await call('post', '/transactions/duplicates/mark', {
        groups: [{ masterId: transactionId, duplicateIds: [rows[1].id] }],
      }).expect(succeeded);
      matches(DuplicatesMarked, marked.body);
    });

    it('a receipt edited, its place settled, and an upload', async () => {
      const [receipt] = await dataSource.query(
        'SELECT id FROM receipts WHERE workspace_id = $1 LIMIT 1',
        [owner.workspaceId],
      );
      const statementId = (await get('/storage/files')).body[0].id;
      const edited = await call('patch', `/receipts/${receipt.id}`, {
        parsedData: { vendor: 'Contract Market' },
      }).expect(succeeded);
      matches(ReceiptRecordUpdate, edited.body);
      // A place the user picked is settled: no lookup, and nothing to ask.
      await dataSource.query(
        "UPDATE receipts SET statement_id = $2, location_source = 'manual', location_lat = 52.52, location_lng = 13.4 WHERE id = $1",
        [receipt.id, statementId],
      );
      const suggestions = await call('post', '/receipts/place-suggestions', {
        statementId,
        latitude: 52.52,
        longitude: 13.4,
        accuracy: 20,
      }).expect(succeeded);
      matches(PlaceSuggestions, suggestions.body);
      expect(suggestions.body).toEqual({ needed: false });
      const upload = await request(app.getHttpServer())
        .post('/receipts/upload')
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .attach('files', png, { filename: 'receipt.png', contentType: 'image/png' })
        .expect(succeeded);
      matches(ReceiptUploadResult, upload.body);
    }, 60_000);

    it('the audit trail of an edited category, and its rollback', async () => {
      const created = await call('post', '/categories', {
        name: 'Audited',
        type: 'expense',
      }).expect(succeeded);
      await call('put', `/categories/${created.body.id}`, { name: 'Audited again' });
      const page = await get('/audit-events?limit=20');
      matches(AuditEventPage, page.body);
      const history = await get(`/audit-events/entity/category/${created.body.id}`);
      matches(AuditEventList, history.body);
      expect(history.body.length).toBeGreaterThan(0);
      const rollback = await call('post', `/audit-events/${history.body[0].id}/rollback`).expect(
        succeeded,
      );
      matches(AuditRollbackResult, rollback.body);
    });

    it('a backup downloaded, previewed and restored', async () => {
      const run = await call('post', '/backups/runs').expect(succeeded);
      const archive = await request(app.getHttpServer())
        .get(`/backups/runs/${run.body.id}/download`)
        .set('Authorization', `Bearer ${owner.token}`)
        .set('x-workspace-id', owner.workspaceId)
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        })
        .expect(200);
      const upload = (url: string) =>
        request(app.getHttpServer())
          .post(url)
          .set('Authorization', `Bearer ${owner.token}`)
          .set('x-workspace-id', owner.workspaceId)
          .field('password', 'contract-backup-pass')
          .attach('file', archive.body as Buffer, { filename: 'backup.seneca' });
      const preview = await upload('/backups/import/preview').expect(succeeded);
      matches(BackupImportPreview, preview.body);
      const restored = await upload(`/backups/imports/${preview.body.importId}/restore`).expect(
        succeeded,
      );
      matches(BackupRestoreResult, restored.body);
      // Rows with no workspace column of their own come back with their parents.
      const counts = async (workspaceId: string) => {
        const [row] = await dataSource.query(
          `SELECT
                   (SELECT count(*) FROM journal_lines l JOIN journal_entries e ON e.id = l.entry_id
                     WHERE e.workspace_id = $1 AND e.status <> 'draft')::int AS "bookedLines",
                   (SELECT count(*) FROM invoice_line_items l JOIN invoices i ON i.id = l.invoice_id
                     WHERE i.workspace_id = $1)::int AS "invoiceLines",
                   (SELECT count(*) FROM transaction_tags l JOIN transactions t ON t.id = l.transaction_id
                     WHERE t.workspace_id = $1)::int AS "transactionTags",
                   (SELECT count(*) FROM receipt_tags l JOIN receipts r ON r.id = l.receipt_id
                     WHERE r.workspace_id = $1)::int AS "receiptTags",
                   (SELECT count(*) FROM payable_tags l JOIN payables p ON p.id = l.payable_id
                     WHERE p.workspace_id = $1)::int AS "payableTags"`,
          [workspaceId],
        );
        return row;
      };
      const source = await counts(owner.workspaceId);
      expect(source.bookedLines).toBeGreaterThan(0);
      expect(source.invoiceLines).toBeGreaterThan(0);
      expect(source.receiptTags).toBeGreaterThan(0);
      expect(source.payableTags).toBeGreaterThan(0);
      expect(await counts(restored.body.workspaceId)).toEqual(source);
    }, 120_000);

    it('an invitation accepted, and the email and password changes', async () => {
      const inviteeEmail = `contracts-joiner-${Date.now()}@example.com`;
      const invitee = await registerAccount(app, inviteeEmail, 'Joiner');
      const invite = await call('post', `/workspaces/${owner.workspaceId}/invitations`, {
        email: inviteeEmail,
        role: 'member',
      }).expect(succeeded);
      const accepted = await request(app.getHttpServer())
        .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
        .set('Authorization', `Bearer ${invitee.token}`)
        .expect(succeeded);
      matches(InvitationAccepted, accepted.body);
      const as = (url: string, body: object) =>
        request(app.getHttpServer())
          .patch(url)
          .set('Authorization', `Bearer ${invitee.token}`)
          .send(body);
      matches(
        MessageResult,
        (
          await as('/users/me/email', {
            email: `contracts-moved-${Date.now()}@example.com`,
            currentPassword: 'Test123!@#',
          }).expect(succeeded)
        ).body,
      );
      matches(
        MessageResult,
        (
          await as('/users/me/password', {
            currentPassword: 'Test123!@#',
            newPassword: 'Test456!@#x',
          }).expect(succeeded)
        ).body,
      );
      await deleteUserByEmail(dataSource, inviteeEmail);
    });
  });
});
