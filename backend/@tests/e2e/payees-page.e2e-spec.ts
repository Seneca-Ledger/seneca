jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * The Payees page end to end: who was paid how much in a month, the payee
 * card, its rows, applying its category to the past, telling a name apart,
 * suggesting duplicates, and merging without losing a subscription's rule.
 */
describe('Payees page (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `payees-page-${stamp}@example.com`,
    other: `payees-page-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let currency: string;
  let categoryIds: string[];

  const month = '2026-05';
  const store = 'ACME Store';
  const bakery = 'Example Bakery';

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const transactions = () => dataSource.getRepository(Transaction);

  const book = (counterpartyName: string, amount: number, fields: Partial<Transaction> = {}) => {
    const income = fields.transactionType === TransactionType.INCOME;
    return transactions().save(
      transactions().create({
        workspaceId: owner.workspaceId,
        transactionDate: new Date(`${month}-10`),
        counterpartyName,
        paymentPurpose: counterpartyName,
        debit: income ? null : amount,
        credit: income ? amount : null,
        amount,
        currency,
        transactionType: TransactionType.EXPENSE,
        isVerified: true,
        ...fields,
      }),
    );
  };

  const overview = async (query: string) =>
    (await as(owner, request(server()).get(`/payees/overview?${query}`)).expect(200)).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    other = await registerAccount(app, emails.other, 'Member Two');
    currency = (await as(owner, request(server()).get('/wallets/summary')).expect(200)).body
      .currency;
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    categoryIds = categories.body.map((category: { id: string }) => category.id);

    await book(store, 30);
    await book(store, 20);
    await book(bakery, 5);
    await book(store, 100, { transactionType: TransactionType.INCOME });
    // Neither counts: a move between own accounts, and a row still in Review.
    await book(store, 999, { transferPairId: randomUUID() });
    await book(store, 777, { isVerified: false });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('ranks payees by what was paid to them in the month, transfers and Review left out', async () => {
    const spent = await overview(`month=${month}`);
    expect(spent).toMatchObject({ currency, totalPayees: 2, totalAmount: 55, missingRates: [] });
    expect(spent.rows.map((row: { name: string; amount: number; count: number }) => [row.name, row.amount, row.count])).toEqual([
      [store, 50, 2],
      [bakery, 5, 1],
    ]);
    expect(spent.months).toContainEqual({ month, count: 3 });

    const received = await overview(`month=${month}&direction=income`);
    expect(received.rows).toEqual([expect.objectContaining({ name: store, amount: 100 })]);

    const searched = await overview(`month=${month}&search=bak`);
    expect(searched.rows.map((row: { name: string }) => row.name)).toEqual([bakery]);
  });

  it('opens a payee with its months, its names and its rows', async () => {
    const [storeRow] = (await overview(`month=${month}`)).rows;

    const summary = (
      await as(owner, request(server()).get(`/payees/${storeRow.id}/summary`)).expect(200)
    ).body;
    expect(summary.months).toContainEqual({ month, spent: 50, received: 100 });
    expect(summary).toMatchObject({ count: 3, averageSpent: 25, currency });
    expect(summary.aliases).toEqual([expect.objectContaining({ example: store })]);

    const listed = (
      await as(owner, request(server()).get(`/transactions?payeeId=${storeRow.id}&limit=50`)).expect(200)
    ).body.data as Array<{ counterpartyName: string }>;
    // Every row of the payee, the uncounted ones too: this is the list, not a total.
    expect(listed).toHaveLength(5);
    expect(listed.every(row => row.counterpartyName === store)).toBe(true);
  });

  it('files past rows under the pinned category, leaving a hand-picked one alone', async () => {
    const [storeRow] = (await overview(`month=${month}`)).rows;
    const [pinned, handPicked] = categoryIds;
    const chosen = await book(store, 7, {
      categoryId: handPicked,
      categorySource: TransactionCategorySource.MANUAL,
    });

    await as(
      owner,
      request(server())
        .patch(`/payees/${storeRow.id}`)
        .send({ mode: 'always', categoryId: pinned }),
    ).expect(200);
    const applied = (
      await as(owner, request(server()).post(`/payees/${storeRow.id}/apply-category`)).expect(201)
    ).body;
    // Every row of the store but the hand-picked one: none had a category anybody chose.
    const ofStore = await transactions().countBy({ workspaceId: owner.workspaceId, payeeId: storeRow.id });
    expect(applied.updated).toBe(ofStore - 1);

    const rows = await transactions().findBy({ workspaceId: owner.workspaceId, payeeId: storeRow.id });
    expect(rows.find(row => row.id === chosen.id)?.categoryId).toBe(handPicked);
    expect(
      rows.filter(row => row.id !== chosen.id).every(row => row.categoryId === pinned),
    ).toBe(true);
  });

  it('tells a name apart into a payee of its own', async () => {
    const branch = await book('ACME Store Berlin', 12);
    const storeId = (await overview(`month=${month}`)).rows[0].id as string;
    await as(
      owner,
      request(server())
        .post(`/payees/${storeId}/merge`)
        .send({ sourceIds: [branch.payeeId] }),
    ).expect(201);
    const merged = (
      await as(owner, request(server()).get(`/payees/${storeId}/summary`)).expect(200)
    ).body;
    const branchAlias = merged.aliases.find(
      (alias: { example: string }) => alias.example === 'ACME Store Berlin',
    );
    expect(branchAlias).toBeDefined();

    const split = (
      await as(
        owner,
        request(server()).delete(`/payees/${storeId}/aliases/${encodeURIComponent(branchAlias.key)}`),
      ).expect(200)
    ).body;
    expect(split).toEqual({ updated: 1 });
    const moved = await transactions().findOneByOrFail({ id: branch.id });
    expect(moved.payeeId).not.toBe(storeId);
    expect(moved.payeeId).toBeTruthy();

    // The name is no longer the store's: asking again finds nothing to split.
    await as(
      owner,
      request(server()).delete(`/payees/${storeId}/aliases/${encodeURIComponent(branchAlias.key)}`),
    ).expect(404);
  });

  it('suggests payees that look like one business, and a merge keeps the subscription rule', async () => {
    const duplicate = await book('Example Bakery GmbH', 4);
    const groups = (await as(owner, request(server()).get('/payees/duplicates')).expect(200)).body;
    const bakeryGroup = groups.find((group: { payees: Array<{ name: string }> }) =>
      group.payees.some(payee => payee.name === bakery),
    );
    expect(bakeryGroup.payees.map((payee: { name: string }) => payee.name).sort()).toEqual([
      bakery,
      'Example Bakery GmbH',
    ]);

    const [{ id: subscriptionId }] = await dataSource.query(
      `INSERT INTO subscriptions (workspace_id, vendor_name, amount, currency, frequency)
       VALUES ($1, $2, 4, $3, 'monthly') RETURNING id`,
      [owner.workspaceId, 'Example Bakery Club', currency],
    );
    await dataSource.query(
      'INSERT INTO subscription_payees (workspace_id, subscription_id, payee_id) VALUES ($1, $2, $3)',
      [owner.workspaceId, subscriptionId, duplicate.payeeId],
    );
    const bakeryId = bakeryGroup.payees.find((payee: { name: string }) => payee.name === bakery).id;
    await as(
      owner,
      request(server())
        .post(`/payees/${bakeryId}/merge`)
        .send({ sourceIds: [duplicate.payeeId] }),
    ).expect(201);

    const summary = (
      await as(owner, request(server()).get(`/payees/${bakeryId}/summary`)).expect(200)
    ).body;
    expect(summary.subscriptions).toEqual([{ id: subscriptionId, name: 'Example Bakery Club' }]);
  });

  it('shows another workspace none of it', async () => {
    const [storeRow] = (await overview(`month=${month}`)).rows;
    const othersView = (
      await as(other, request(server()).get(`/payees/overview?month=${month}`)).expect(200)
    ).body;
    expect(othersView.rows).toEqual([]);
    await as(other, request(server()).get(`/payees/${storeRow.id}/summary`)).expect(404);
    await as(other, request(server()).post(`/payees/${storeRow.id}/apply-category`)).expect(404);
    const listed = (
      await as(other, request(server()).get(`/transactions?payeeId=${storeRow.id}`)).expect(200)
    ).body.data;
    expect(listed).toEqual([]);
  });
});
