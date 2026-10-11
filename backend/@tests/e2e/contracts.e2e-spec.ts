jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BalanceSheetResponse,
  BudgetList,
  CategoryList,
  CryptoGains,
  CryptoHistory,
  CryptoNetworkList,
  CryptoSummary,
  CryptoTransactionList,
  CryptoWalletList,
  CurrentUser,
  DashboardCommitmentsResponse,
  DashboardHealthHistoryResponse,
  DashboardMonthlyCashFlowResponse,
  DashboardResponse,
  DashboardTrendsResponse,
  GoalFlowResponse,
  GoalList,
  GoalPlanResponse,
  InsightList,
  InvestmentAccountList,
  MetalReceiptList,
  MetalsSummary,
  MonthGoalList,
  NetWorthResponse,
  NotificationList,
  ReviewInboxCounts,
  SubscriptionChargeCalendar,
  SubscriptionDuplicateGroups,
  SubscriptionList,
  SubscriptionSummary,
  UnreadCount,
  WalletList,
  WorkspaceDetail,
  WorkspaceList,
  WorkspaceOverview,
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
});
