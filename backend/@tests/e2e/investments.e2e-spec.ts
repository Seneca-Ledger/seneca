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
 * An investment account with manual holdings: its value lands on the balance
 * sheet and in net worth, an expense can be marked as a contribution (and
 * leaves spending), and the asset-class split and all-time high read it.
 */
describe('Investments (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `invest-owner-${stamp}@example.com`,
    other: `invest-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let accountId: string;
  let holdingId: string;
  let expenseId: string;

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

    owner = await registerAccount(app, emails.owner, 'Invest Owner');
    other = await registerAccount(app, emails.other, 'Invest Other');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '1000')
      .field('currency', 'USD')
      .field('merchant', 'Broker top-up')
      .field('categoryId', categories.body[0].id)
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    expenseId = listed.body.data[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('creates a retirement account under the Investments section', async () => {
    const res = await as(owner, request(server()).post('/investments/accounts'))
      .send({ name: 'Pension', kind: 'retirement' })
      .expect(201);
    accountId = res.body.id;
    expect(res.body).toMatchObject({ name: 'Pension', kind: 'retirement', value: 0, holdings: [] });
  });

  it('values a manual holding and writes it to the balance sheet', async () => {
    const res = await as(owner, request(server()).post(`/investments/accounts/${accountId}/holdings`))
      .send({ name: 'World ETF', assetClass: 'etf', quantity: 10, price: 120.5, priceCurrency: 'USD' })
      .expect(201);
    holdingId = res.body.id;
    expect(res.body.value).toBe(1205);

    const accounts = await as(owner, request(server()).get('/investments')).expect(200);
    expect(accounts.body[0].value).toBe(1205);

    const netWorth = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(
      200,
    );
    expect(netWorth.body.byAssetClass).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'etf', amount: 1205 })]),
    );
    expect(netWorth.body.allTimeHigh).toEqual(expect.objectContaining({ value: expect.any(Number) }));
    expect(netWorth.body.allTimeHigh.value).toBeGreaterThanOrEqual(1205 - 1000);
  });

  it('turns an expense into a contribution that leaves spending', async () => {
    const res = await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: expenseId, accountId })
      .expect(201);
    expect(res.body).toMatchObject({
      investmentAccountId: accountId,
      transferPairKind: 'investment',
      transferPairId: expenseId,
    });

    const accounts = await as(owner, request(server()).get('/investments')).expect(200);
    expect(accounts.body[0]).toMatchObject({ contributed: 1000, gain: 205 });

    // Listed with the transfers, where the spending aggregates do not look.
    const transfers = await as(owner, request(server()).get('/transactions?type=transfer')).expect(
      200,
    );
    expect(transfers.body.data.map((row: { id: string }) => row.id)).toContain(expenseId);

    await as(owner, request(server()).delete(`/investments/contributions/${expenseId}`)).expect(200);
    const after = await as(owner, request(server()).get('/investments')).expect(200);
    expect(after.body[0].contributed).toBe(0);
  });

  it('updates and removes a holding, keeping the sheet in step', async () => {
    const updated = await as(owner, request(server()).patch(`/investments/holdings/${holdingId}`))
      .send({ quantity: 20 })
      .expect(200);
    expect(updated.body.value).toBe(2410);

    await as(owner, request(server()).delete(`/investments/holdings/${holdingId}`)).expect(204);
    const accounts = await as(owner, request(server()).get('/investments')).expect(200);
    expect(accounts.body[0].value).toBe(0);
  });

  it('accepts the new net-worth ranges and keeps everything inside the workspace', async () => {
    await as(owner, request(server()).get('/reports/net-worth?range=180d')).expect(200);
    await as(owner, request(server()).get('/reports/net-worth?range=3y')).expect(200);
    await as(owner, request(server()).get('/reports/net-worth?range=2y')).expect(400);

    const foreign = await as(other, request(server()).get('/investments')).expect(200);
    expect(foreign.body).toEqual([]);
    await as(other, request(server()).post(`/investments/accounts/${accountId}/holdings`))
      .send({ name: 'Hijack', quantity: 1, price: 1 })
      .expect(404);
  });
});
