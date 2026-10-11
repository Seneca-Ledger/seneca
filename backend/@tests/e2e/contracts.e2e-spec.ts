jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BackupRun, BackupRunStatus, BackupRunTrigger } from '../../src/entities/backup-run.entity';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../src/entities/receipt.entity';
import {
  AccountLedger,
  AdminUserList,
  AgeingReport,
  AvailableCustomTables,
  BackupConfiguration,
  BackupRunList,
  BalanceSheetResponse,
  BudgetList,
  BusinessProfileResponse,
  CategoryList,
  Client,
  ClientList,
  CreditNoteList,
  CryptoGains,
  CryptoHistory,
  CryptoNetworkList,
  CryptoSummary,
  CryptoTransactionList,
  CryptoWalletList,
  CurrentUser,
  CustomTableAggregates,
  CustomTableDetail,
  CustomTableGroups,
  CustomTableList,
  CustomTableRowPage,
  CustomTableSummaries,
  DashboardCommitmentsResponse,
  DashboardHealthHistoryResponse,
  DashboardMonthlyCashFlowResponse,
  DashboardResponse,
  DashboardTrendsResponse,
  DisclaimerStatus,
  ExchangeRateCoverage,
  ForecastResponse,
  GoalFlowResponse,
  GoalList,
  GoalPlanResponse,
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
  LedgerAccountList,
  LedgerIntegrity,
  LedgerSettings,
  LocalCategorizationStatus,
  MetalReceiptList,
  MetalsSummary,
  MonthGoalList,
  NetWorthResponse,
  NotificationList,
  NotificationPreferences,
  Payable,
  PayableListPage,
  PayablePaymentList,
  PayablesSummary,
  PayeePendingReview,
  PayeesPage,
  PaymentCandidateList,
  PushPublicKey,
  ReceiptListPage,
  ReceiptRecord,
  ReceiptSplitSuggestion,
  ReceiptTransactionMatches,
  ReconciliationResponse,
  ReviewInboxByStatement,
  ReviewInboxCounts,
  ReviewInboxPage,
  SharedFileAccess,
  SharedTableRows,
  SharedTableView,
  StatementDetail,
  StorageFileDetails,
  StorageFileList,
  StorageFolderList,
  StorageTagList,
  StorageViewList,
  SubscriptionChargeCalendar,
  SubscriptionDuplicateGroups,
  SubscriptionList,
  SubscriptionSummary,
  TaxJurisdictionList,
  TaxRateList,
  TaxReturnPreview,
  TaxReturnRecord,
  TaxRuleList,
  TaxThresholdStatus,
  TelegramBotStatus,
  TelegramReportPage,
  TransactionAttachmentList,
  TransactionList,
  TrialBalance,
  TwoFactorStatus,
  UnreadCount,
  UserPermissions,
  UserSessionList,
  WalletList,
  WorkspaceDetail,
  WorkspaceList,
  WorkspaceOverview,
  WorkspaceTaxSettings,
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

    it('GET /dashboard/health-history', async () => {
      matches(DashboardHealthHistoryResponse, (await get('/dashboard/health-history')).body);
    });

    it('GET /dashboard/commitments', async () => {
      matches(DashboardCommitmentsResponse, (await get('/dashboard/commitments?days=60')).body);
    });
  });

  describe('app shell', () => {
    it('GET /auth/me, without credentials or bookkeeping columns', async () => {
      const res = await get('/auth/me');
      matches(CurrentUser, res.body);
      for (const field of ['passwordHash', 'tokenVersion', 'googleId', 'twoFactorSecret', 'isActive']) {
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

    it('GET /payees and /payees/:id/pending-review', async () => {
      const res = await get('/payees');
      matches(PayeesPage, res.body);
      expect(res.body.data.length).toBeGreaterThan(0);
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
      const payable = await post('/payables', {
        vendor: 'Contract Coffee',
        amount: 120.4,
        currency: 'USD',
        dueDate: '2026-12-01',
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
      matches(Payable, (await get(`/payables/${payableId}`)).body);
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
      tagId = (await send('post', '/storage/tags', { name: 'Contracts', color: '#22c55e' }).expect(201))
        .body.id;
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
      matches(TaxThresholdStatus, (await get('/tax/settings/threshold')).body);
      matches(TaxRuleList, (await get('/tax/rules')).body);
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
      // The worker books the history in the background.
      for (let attempt = 0; attempt < 60; attempt++) {
        if ((await get('/ledger/integrity')).body.upToDate) {
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
});
