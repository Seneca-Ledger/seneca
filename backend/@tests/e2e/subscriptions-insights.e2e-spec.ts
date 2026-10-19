jest.mock('franc', () => ({
  franc: () => 'und',
}));

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
 * Subscriptions 2.0: cost per use from taps, a savings goal for an annual
 * charge, duplicate plans of one service, and bills next to subscriptions in
 * the charge calendar. Another workspace sees none of it.
 */
describe('Subscriptions insights (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `subs-owner-${stamp}@example.com`,
    other: `subs-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let monthlyId: string;
  let annualId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const inAMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
  };

  async function createSubscription(body: Record<string, unknown>): Promise<string> {
    const res = await as(owner, request(server()).post('/subscriptions'))
      .send({ currency: 'USD', nextChargeDate: inAMonth(), ...body })
      .expect(201);
    await as(owner, request(server()).post(`/subscriptions/${res.body.id}/confirm`)).expect(201);
    return res.body.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Subs Owner');
    other = await registerAccount(app, emails.other, 'Subs Other');

    monthlyId = await createSubscription({
      vendorName: 'Netflix Premium',
      amount: 20,
      frequency: 'monthly',
    });
    annualId = await createSubscription({
      vendorName: 'Adobe',
      amount: 240,
      frequency: 'annual',
    });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('turns "I used it" taps into a cost per use', async () => {
    const first = await as(
      owner,
      request(server()).post(`/subscriptions/${monthlyId}/usage`),
    ).expect(200);
    expect(first.body.usageCount).toBe(1);
    expect(first.body.costPerUse).toBe(20);

    const second = await as(
      owner,
      request(server()).post(`/subscriptions/${monthlyId}/usage`),
    ).expect(200);
    expect(second.body.usageCount).toBe(2);
    expect(second.body.costPerUse).toBe(10);

    const listed = await as(owner, request(server()).get('/subscriptions?status=active')).expect(
      200,
    );
    const row = listed.body.find((item: { id: string }) => item.id === monthlyId);
    expect(row.costPerUse).toBe(10);
  });

  it('creates one savings goal for an annual charge and refuses monthly ones', async () => {
    const funds = await as(owner, request(server()).get('/subscriptions/sinking-funds')).expect(
      200,
    );
    expect(funds.body).toHaveLength(1);
    expect(funds.body[0]).toMatchObject({ subscriptionId: annualId, goalId: null });
    expect(funds.body[0].monthlySetAside).toBeGreaterThan(0);

    const created = await as(
      owner,
      request(server()).post(`/subscriptions/${annualId}/sinking-fund`),
    ).expect(200);
    expect(created.body.created).toBe(true);
    expect(created.body.goalId).toEqual(expect.any(String));

    const again = await as(
      owner,
      request(server()).post(`/subscriptions/${annualId}/sinking-fund`),
    ).expect(200);
    expect(again.body).toMatchObject({ created: false, goalId: created.body.goalId });

    const goal = await as(owner, request(server()).get(`/goals/${created.body.goalId}`)).expect(
      200,
    );
    expect(Number(goal.body.targetAmount)).toBe(240);

    await as(owner, request(server()).post(`/subscriptions/${monthlyId}/sinking-fund`)).expect(
      400,
    );
  });

  it('groups two plans of one service as a possible duplicate', async () => {
    await createSubscription({ vendorName: 'Netflix Basic', amount: 8, frequency: 'monthly' });

    const duplicates = await as(owner, request(server()).get('/subscriptions/duplicates')).expect(
      200,
    );
    expect(duplicates.body).toHaveLength(1);
    expect(duplicates.body[0].items.map((item: { vendorName: string }) => item.vendorName).sort()).toEqual(
      ['Netflix Basic', 'Netflix Premium'],
    );

    const summary = await as(owner, request(server()).get('/subscriptions/summary')).expect(200);
    expect(summary.body.duplicateCount).toBe(1);
  });

  it('shows bills next to subscriptions in the charge calendar', async () => {
    await as(owner, request(server()).post('/payables'))
      .send({ vendor: 'Landlord', amount: 500, currency: 'USD', dueDate: inAMonth() })
      .expect(201);

    const calendar = await as(
      owner,
      request(server()).get('/subscriptions/charge-calendar?months=3'),
    ).expect(200);
    const kinds = calendar.body.rows.map((row: { vendorName: string; kind: string }) => [
      row.vendorName,
      row.kind,
    ]);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ['Landlord', 'payable'],
        ['Netflix Premium', 'subscription'],
      ]),
    );
  });

  it('keeps every insight inside the workspace', async () => {
    await as(other, request(server()).post(`/subscriptions/${monthlyId}/usage`)).expect(404);
    const duplicates = await as(other, request(server()).get('/subscriptions/duplicates')).expect(
      200,
    );
    expect(duplicates.body).toEqual([]);
    const funds = await as(other, request(server()).get('/subscriptions/sinking-funds')).expect(
      200,
    );
    expect(funds.body).toEqual([]);
  });
});
