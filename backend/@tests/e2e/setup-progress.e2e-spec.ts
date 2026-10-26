import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The dashboard's Getting Started checklist: what a workspace has already set
 * up, read from its own data and never from another workspace's.
 */
describe('Dashboard setup progress (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    first: `setup-first-${stamp}@example.com`,
    second: `setup-second-${stamp}@example.com`,
  };
  let first: E2eAccount;
  let second: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    first = await registerAccount(app, emails.first, 'Setup First');
    second = await registerAccount(app, emails.second, 'Setup Second');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('starts with nothing done in a new workspace', async () => {
    const res = await as(first, request(server()).get('/dashboard/setup-progress')).expect(200);
    expect(res.body).toEqual({
      hasUpload: false,
      hasCustomCategories: false,
      hasBudget: false,
      hasGoal: false,
      hasWallet: false,
      telegramAvailable: false,
      hasTelegram: false,
    });
  });

  it('ticks off a goal once one exists', async () => {
    await as(first, request(server()).post('/goals'))
      .send({ name: 'Emergency fund', targetAmount: 1000 })
      .expect(201);

    const res = await as(first, request(server()).get('/dashboard/setup-progress')).expect(200);
    expect(res.body.hasGoal).toBe(true);
  });

  it('does not see another workspace’s goal', async () => {
    const res = await as(second, request(server()).get('/dashboard/setup-progress')).expect(200);
    expect(res.body.hasGoal).toBe(false);
  });

  it('remembers the checklist under the onboarding view scope', async () => {
    await as(first, request(server()).put('/view-preferences/onboarding'))
      .send({ state: { gettingStartedDismissedAt: '2026-10-11T00:00:00.000Z' } })
      .expect(200);
    const res = await as(first, request(server()).get('/view-preferences/onboarding')).expect(200);
    expect(res.body.state).toEqual({ gettingStartedDismissedAt: '2026-10-11T00:00:00.000Z' });
  });
});
