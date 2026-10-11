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
  CurrentUser,
  DashboardCommitmentsResponse,
  DashboardHealthHistoryResponse,
  DashboardMonthlyCashFlowResponse,
  DashboardResponse,
  DashboardTrendsResponse,
  InsightList,
  NotificationList,
  ReviewInboxCounts,
  UnreadCount,
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
});
