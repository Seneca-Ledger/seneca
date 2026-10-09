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
 * Physical metal as a holding: a lot is entered as pieces, weight and
 * fineness, valued on its fine weight at the spot price of its metal, and
 * lands on the balance sheet and in the net-worth asset-class split.
 *
 * The spot price comes through the rate tables, so the suite enters XAU→USD by
 * hand instead of reaching a price provider over the network.
 */
describe('Precious metals (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `metals-owner-${stamp}@example.com`,
    other: `metals-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let lotId: string;
  let expenseId: string;
  let receiptId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  /** A lot of its own, for a test that runs after the first one is sold out. */
  const freshLot = async (): Promise<string> => {
    const created = await as(owner, request(server()).post('/metals/lots'))
      .send({ metal: 'XPT', quantity: 1, unitWeight: 1, weightUnit: 'ozt', price: 1000 })
      .expect(201);
    return created.body.id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Metals Owner');
    other = await registerAccount(app, emails.other, 'Metals Other');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);
    await as(owner, request(server()).post('/exchange-rates/manual'))
      .send({ from: 'XAU', to: 'USD', rate: 4000 })
      .expect(201);

    // An expense to mark as the purchase later on.
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '30000')
      .field('currency', 'USD')
      .field('merchant', 'Degussa')
      .field('categoryId', categories.body[0].id)
      .field('date', new Date().toISOString().slice(0, 10))
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    expenseId = listed.body.data[0].id;

    // A receipt to attach to a lot. Receipts normally arrive by scan or mail;
    // the suite only needs a row that belongs to this workspace.
    const inserted = await dataSource.query(
      `INSERT INTO receipts (user_id, workspace_id, source, subject, sender, received_at, parsed_data)
       VALUES ($1, $2, 'upload', 'Degussa invoice', 'shop@degussa.example', now(), $3::jsonb)
       RETURNING id`,
      [
        owner.userId,
        owner.workspaceId,
        JSON.stringify({ vendor: 'Degussa', amount: 41000, currency: 'USD', date: '2026-03-14' }),
      ],
    );
    receiptId = inserted[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('values a lot on its fine weight, not on what it weighs', async () => {
    const res = await as(owner, request(server()).post('/metals/lots'))
      .send({
        metal: 'XAU',
        name: 'Krugerrand',
        quantity: 10,
        unitWeight: 1,
        weightUnit: 'ozt',
        purity: 0.9167,
        costTotal: 30000,
        acquiredOn: '2026-03-14',
        counterparty: 'Degussa',
      })
      .expect(201);
    lotId = res.body.id;

    // Ten gross ounces of 22 carat gold are 9.167 ounces of gold.
    expect(res.body).toMatchObject({
      metal: 'XAU',
      fineOunces: 9.167,
      price: 4000,
      priceCurrency: 'USD',
      priceSource: 'auto',
      value: 36668,
      cost: 30000,
      gain: 6668,
      acquiredOn: '2026-03-14',
      counterparty: 'Degussa',
    });
  });

  it('sums the lots per metal and keeps the balance sheet in step', async () => {
    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body).toMatchObject({ currency: 'USD', value: 36668, cost: 30000, gain: 6668 });
    expect(summary.body.byMetal).toEqual([
      expect.objectContaining({ metal: 'XAU', fineOunces: 9.167, value: 36668 }),
    ]);

    const netWorth = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(
      200,
    );
    expect(netWorth.body.byAssetClass).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'metal', amount: 36668 })]),
    );
    expect(netWorth.body.assetsTotal).toBeGreaterThanOrEqual(36668);
  });

  it('refuses a fineness entered as 999 instead of 0.999', async () => {
    await as(owner, request(server()).post('/metals/lots'))
      .send({ metal: 'XAU', quantity: 1, unitWeight: 1, weightUnit: 'ozt', purity: 999 })
      .expect(400);
  });

  it('re-quotes the lot when the rate moves', async () => {
    await as(owner, request(server()).post('/exchange-rates/manual'))
      .send({ from: 'XAU', to: 'USD', rate: 4100 })
      .expect(201);

    const refreshed = await as(owner, request(server()).post('/metals/refresh-prices')).expect(200);
    expect(refreshed.body).toEqual({ updated: 1 });

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body.value).toBe(37584.7);
  });

  it('leaves a hand-entered price alone', async () => {
    const manual = await as(owner, request(server()).post('/metals/lots'))
      .send({
        metal: 'XAG',
        quantity: 1,
        unitWeight: 1,
        weightUnit: 'kg',
        purity: 0.999,
        price: 50,
      })
      .expect(201);
    expect(manual.body).toMatchObject({ priceSource: 'manual', price: 50 });

    // The refresh re-quotes the gold lot and only that one.
    const refreshed = await as(owner, request(server()).post('/metals/refresh-prices')).expect(200);
    expect(refreshed.body).toEqual({ updated: 1 });

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body.lots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: manual.body.id, price: 50, priceSource: 'manual' }),
      ]),
    );

    await as(owner, request(server()).delete(`/metals/lots/${manual.body.id}`)).expect(204);
  });

  it('keeps every lot inside its own workspace', async () => {
    const foreign = await as(other, request(server()).get('/metals')).expect(200);
    expect(foreign.body).toMatchObject({ value: 0, lots: [] });

    await as(other, request(server()).patch(`/metals/lots/${lotId}`))
      .send({ quantity: 1000 })
      .expect(404);
    await as(other, request(server()).delete(`/metals/lots/${lotId}`)).expect(404);
  });

  it('sells part of a lot: the pieces take their share of the cost with them', async () => {
    const sold = await as(owner, request(server()).post(`/metals/lots/${lotId}/sell`))
      .send({ quantity: 4, proceeds: 15000, soldOn: '2026-10-01', counterparty: 'Degussa' })
      .expect(201);

    expect(sold.body.sale).toMatchObject({
      metal: 'XAU',
      quantity: 4,
      proceeds: 15000,
      costBasis: 12000,
      realized: 3000,
      soldOn: '2026-10-01',
    });
    // Six pieces and 18 000 left: the cost per ounce did not move.
    expect(sold.body.lot).toMatchObject({ quantity: 6, costTotal: 18000 });

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body).toMatchObject({ realized: 3000, cost: 18000 });
    expect(summary.body.sales).toHaveLength(1);
    expect(summary.body.byMetal[0]).toMatchObject({ realized: 3000 });
    expect(summary.body.lots[0].costPerOunce).toBeCloseTo(18000 / (6 * 0.9167), 1);
  });

  it('prices a sale at what the dealer pays once a discount is set', async () => {
    const saved = await as(owner, request(server()).patch('/metals/settings'))
      .send({ dealerDiscount: { XAU: 5 } })
      .expect(200);
    expect(saved.body.dealerDiscount).toMatchObject({ XAU: 5, XAG: 0 });

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    const lot = summary.body.lots[0];
    expect(lot.dealerValue).toBeCloseTo(lot.value * 0.95, 1);
    expect(lot.roi).toBeCloseTo((lot.dealerValue / lot.cost - 1) * 100, 1);
    expect(summary.body.byMetal[0].dealerDiscount).toBe(5);

    await as(owner, request(server()).patch('/metals/settings'))
      .send({ dealerDiscount: { XAU: 0 } })
      .expect(200);
  });

  it('refuses to sell more pieces than the lot holds', async () => {
    await as(owner, request(server()).post(`/metals/lots/${lotId}/sell`))
      .send({ quantity: 99 })
      .expect(400);
  });

  it('counts a purchase as a transfer into the metals account, not as spending', async () => {
    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    const accountId = summary.body.accountId;
    expect(accountId).toEqual(expect.any(String));

    await as(owner, request(server()).post('/investments/contributions'))
      .send({ transactionId: expenseId, accountId })
      .expect(201);

    const transfers = await as(owner, request(server()).get('/transactions?type=transfer')).expect(
      200,
    );
    expect(transfers.body.data.map((row: { id: string }) => row.id)).toContain(expenseId);

    await as(owner, request(server()).delete(`/investments/contributions/${expenseId}`)).expect(200);
  });

  it('keeps sales and settings inside their own workspace', async () => {
    const foreign = await as(other, request(server()).get('/metals')).expect(200);
    expect(foreign.body).toMatchObject({ realized: 0, sales: [], accountId: null });
    expect(foreign.body.dealerDiscount).toMatchObject({ XAU: 0 });

    await as(other, request(server()).post(`/metals/lots/${lotId}/sell`))
      .send({ quantity: 1 })
      .expect(404);
  });

  it('sells the last piece: the lot goes, the realized result stays', async () => {
    const sold = await as(owner, request(server()).post(`/metals/lots/${lotId}/sell`))
      .send({ proceeds: 25000 })
      .expect(201);
    expect(sold.body.lot).toBeNull();
    expect(sold.body.sale).toMatchObject({ quantity: 6, costBasis: 18000, realized: 7000 });

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body).toMatchObject({ value: 0, cost: 0, realized: 10000 });
    expect(summary.body.lots).toEqual([]);
    expect(summary.body.sales).toHaveLength(2);

    const netWorth = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(
      200,
    );
    expect(netWorth.body.byAssetClass).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'metal' })]),
    );
  });

  it('keeps where the lot is kept, what it is insured for and the receipt that proves it', async () => {
    const id = await freshLot();
    const updated = await as(owner, request(server()).patch(`/metals/lots/${id}`))
      .send({ storageLocation: 'Bank vault 12', insuredValue: 45000, receiptId })
      .expect(200);

    expect(updated.body).toMatchObject({
      storageLocation: 'Bank vault 12',
      insuredValue: 45000,
      insured: 45000,
    });
    expect(updated.body.receipt).toMatchObject({ id: receiptId, vendor: 'Degussa', amount: 41000 });

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body.insured).toBe(45000);

    const options = await as(owner, request(server()).get('/metals/receipt-options')).expect(200);
    expect(options.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: receiptId })]),
    );

    await as(owner, request(server()).delete(`/metals/lots/${id}`)).expect(204);
  });

  it('refuses a receipt from another workspace', async () => {
    const foreign = await as(other, request(server()).get('/metals/receipt-options')).expect(200);
    expect(foreign.body).toEqual([]);

    const id = await freshLot();
    await as(owner, request(server()).patch(`/metals/lots/${id}`))
      .send({ receiptId: '11111111-1111-4111-8111-111111111111' })
      .expect(404);
    await as(owner, request(server()).delete(`/metals/lots/${id}`)).expect(204);
  });

  it('stores a photo of the lot and takes it away again', async () => {
    // Smallest valid PNG: one transparent pixel.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );

    const id = await freshLot();
    const uploaded = await as(owner, request(server()).post(`/metals/lots/${id}/photo`))
      .attach('photo', png, { filename: 'coin.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.photoUrl).toMatch(/^\/uploads\/metal-photos\/[0-9a-f-]+\.png$/);

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body.lots[0].photoUrl).toBe(uploaded.body.photoUrl);

    const removed = await as(owner, request(server()).delete(`/metals/lots/${id}/photo`)).expect(
      200,
    );
    expect(removed.body.photoUrl).toBeNull();

    await as(owner, request(server()).delete(`/metals/lots/${id}`)).expect(204);
  });

  it('refuses anything that is not a photo', async () => {
    const id = await freshLot();
    await as(owner, request(server()).post(`/metals/lots/${id}/photo`))
      .attach('photo', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' })
      .expect(400);
    await as(owner, request(server()).delete(`/metals/lots/${id}`)).expect(204);
  });

  it('measures the same net worth in ounces when asked', async () => {
    // Something has to be worth something before ounces mean anything.
    const id = await freshLot();
    const plain = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(200);
    expect(plain.body.current).toBeGreaterThan(0);
    expect(plain.body.denominated).toBeNull();

    const inGold = await as(
      owner,
      request(server()).get('/reports/net-worth?range=30d&denominate=XAU'),
    ).expect(200);
    expect(inGold.body.current).toBe(plain.body.current);
    expect(inGold.body.denominated).toMatchObject({ metal: 'XAU', unit: 'ozt' });
    expect(inGold.body.denominated.series.length).toBeGreaterThan(0);
    expect(inGold.body.denominated.current).toBeGreaterThan(0);

    await as(owner, request(server()).get('/reports/net-worth?range=30d&denominate=XXX')).expect(
      400,
    );

    await as(owner, request(server()).delete(`/metals/lots/${id}`)).expect(204);
  });

  it('keeps the purchase day and the owner on a sale after the lot is gone', async () => {
    const created = await as(owner, request(server()).post('/metals/lots'))
      .send({
        metal: 'XPD',
        quantity: 2,
        unitWeight: 1,
        weightUnit: 'ozt',
        price: 1000,
        costTotal: 1800,
        acquiredOn: '2026-02-01',
      })
      .expect(201);
    expect(created.body.ownerUserId).toBe(owner.userId);

    const sold = await as(owner, request(server()).post(`/metals/lots/${created.body.id}/sell`))
      .send({ proceeds: 2200, soldOn: '2026-09-15' })
      .expect(201);
    expect(sold.body.lot).toBeNull();
    expect(sold.body.sale).toMatchObject({
      acquiredOn: '2026-02-01',
      ownerUserId: owner.userId,
      realized: 400,
    });

    // The lot is gone; the sale still knows when its metal was bought.
    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    const sale = summary.body.sales.find((row: { metal: string }) => row.metal === 'XPD');
    expect(sale).toMatchObject({ acquiredOn: '2026-02-01', ownerUserId: owner.userId });
  });

  it('refuses an owner who is not a member of the workspace', async () => {
    const id = await freshLot();
    await as(owner, request(server()).patch(`/metals/lots/${id}`))
      .send({ ownerUserId: other.userId })
      .expect(404);
    await as(owner, request(server()).delete(`/metals/lots/${id}`)).expect(204);
  });

  it('removes a lot outright and takes its value off the sheet', async () => {
    const added = await as(owner, request(server()).post('/metals/lots'))
      .send({ metal: 'XPT', quantity: 1, unitWeight: 1, weightUnit: 'ozt', price: 1000 })
      .expect(201);

    await as(owner, request(server()).delete(`/metals/lots/${added.body.id}`)).expect(204);

    const summary = await as(owner, request(server()).get('/metals')).expect(200);
    expect(summary.body).toMatchObject({ value: 0, lots: [] });

    const netWorth = await as(owner, request(server()).get('/reports/net-worth?range=30d')).expect(
      200,
    );
    expect(netWorth.body.byAssetClass).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'metal' })]),
    );
  });
});
