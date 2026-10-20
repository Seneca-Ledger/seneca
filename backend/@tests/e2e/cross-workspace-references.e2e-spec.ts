jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Receipt, ReceiptSource, ReceiptStatus } from '../../src/entities/receipt.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';
import { seedWorkspace } from './helpers/seed-workspace';

/**
 * A record of A's may not point at one of B's: an id in a request body is
 * looked up in the caller's workspace, not anywhere. Each case here passed
 * an unscoped lookup once, and the answer then carried B's data.
 */
describe('Cross-workspace references (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = [`xref-a-${stamp}@example.com`, `xref-b-${stamp}@example.com`];
  const bMarker = `bxref${stamp}`;
  let a: E2eAccount;
  let b: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${a.token}`).set('x-workspace-id', a.workspaceId);
  const server = () => app.getHttpServer();
  /** The id of one of `owner`'s rows in `table`, picked by `where`. */
  const idIn = async (owner: E2eAccount, table: string, where = 'TRUE'): Promise<string> => {
    const [row] = await dataSource.query(
      `SELECT id FROM "${table}" WHERE workspace_id = $1 AND ${where} LIMIT 1`,
      [owner.workspaceId],
    );
    return row.id;
  };
  const theirCategory = () => idIn(b, 'categories', `name LIKE '${bMarker}%'`);
  const theirWallet = () => idIn(b, 'wallets', `name LIKE '${bMarker}%'`);
  const theirBranch = () => idIn(b, 'branches', `name LIKE '${bMarker}%'`);
  /** A dated receipt of A's, ready to approve, carrying `parsedData` on top. */
  const receiptOfA = (parsedData: Record<string, unknown> = {}) =>
    dataSource.getRepository(Receipt).save({
      userId: a.userId,
      workspaceId: a.workspaceId,
      source: ReceiptSource.SCAN,
      subject: 'Xref receipt',
      sender: 'scan',
      receivedAt: new Date(),
      status: ReceiptStatus.NEEDS_REVIEW,
      parsedData: { amount: 7, currency: 'USD', vendor: 'Xref shop', date: '2026-01-02', ...parsedData },
    });
  const reloaded = (receipt: Receipt) =>
    dataSource.getRepository(Receipt).findOneByOrFail({ id: receipt.id });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    a = await registerAccount(app, emails[0], 'Xref A');
    b = await registerAccount(app, emails[1], 'Xref B');
    await seedWorkspace(app, dataSource, a, `axref${stamp}`);
    await seedWorkspace(app, dataSource, b, bMarker);
  }, 120_000);

  afterAll(async () => {
    if (dataSource) {
      for (const email of emails) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('tests a rule against A’s transactions only', async () => {
    const res = await as(request(server()).post('/categorization-rules/test'))
      .send({
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: bMarker }],
        transactionIds: [await idIn(b, 'transactions')],
      })
      .expect(200);
    expect(res.body).toMatchObject({ totalTransactions: 0, matchedTransactions: 0 });
    expect(res.text).not.toContain(bMarker);
  });

  it('does not budget against B’s category', async () => {
    await as(request(server()).post('/budgets'))
      .send({
        name: 'Theirs',
        categoryId: await idIn(b, 'categories', `name LIKE '${bMarker}%'`),
        limitAmount: 10,
        periodType: 'weekly',
      })
      .expect(404);
  });

  it('does not file a subscription under B’s category', async () => {
    await as(request(server()).post('/subscriptions'))
      .send({
        vendorName: 'Theirs',
        amount: 5,
        frequency: 'monthly',
        currency: 'USD',
        categoryId: await idIn(b, 'categories', `name LIKE '${bMarker}%'`),
      })
      .expect(404);
  });

  it('does not hang a tax rule on B’s category', async () => {
    await as(request(server()).post('/tax/rules'))
      .send({
        categoryId: await idIn(b, 'categories', `name LIKE '${bMarker}%'`),
        taxRateCode: 'DE_STANDARD',
        direction: 'income',
      })
      .expect(404);
  });

  it('does not file A’s category under B’s', async () => {
    const theirs = await idIn(b, 'categories', `name LIKE '${bMarker}%'`);
    await as(request(server()).post('/categories'))
      .send({ name: 'Mine under theirs', type: 'expense', parentId: theirs })
      .expect(404);
    const mine = await idIn(a, 'categories', `name LIKE 'axref%'`);
    await as(request(server()).put(`/categories/${mine}`))
      .send({ parentId: theirs })
      .expect(404);
  });

  it('does not tag A’s file with B’s tag', async () => {
    const res = await as(
      request(server()).patch(`/storage/files/${await idIn(a, 'statements')}/tags`),
    ).send({ tagIds: [await idIn(b, 'tags')] });
    expect(res.status).toBe(404);
    expect(res.text).not.toContain(bMarker);
  });

  it('does not price A’s invoice with B’s tax rate', async () => {
    const res = await as(request(server()).post('/invoices')).send({
      clientId: await idIn(a, 'clients'),
      issueDate: '2026-01-05',
      lineItems: [
        {
          description: 'Work',
          quantity: 1,
          unitPrice: 100,
          taxRateId: await idIn(b, 'tax_rates', `name LIKE '${bMarker}%'`),
        },
      ],
    });
    expect(res.status).toBe(404);
    expect(res.text).not.toContain(bMarker);
  });

  it('does not save a rule that files rows under B’s category, wallet or branch', async () => {
    for (const result of [
      { categoryId: await theirCategory() },
      { walletId: await theirWallet() },
      { branchId: await theirBranch() },
    ]) {
      await as(request(server()).post('/categorization-rules'))
        .send({
          name: 'Xref theirs',
          conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'x' }],
          result,
        })
        .expect(404);
    }
    const mine = await idIn(a, 'categorization_rules');
    await as(request(server()).put(`/categorization-rules/${mine}`))
      .send({ result: { categoryId: await theirCategory() } })
      .expect(404);
    const rules = await dataSource.query(
      `SELECT name, result FROM categorization_rules WHERE workspace_id = $1`,
      [a.workspaceId],
    );
    expect(rules.map((rule: { name: string }) => rule.name)).not.toContain('Xref theirs');
    expect(JSON.stringify(rules)).not.toContain(await theirCategory());
  });

  it('passes over a stored rule that names B’s wallet and category', async () => {
    const transactionId = await idIn(a, 'transactions');
    await dataSource.query(
      `INSERT INTO categorization_rules (user_id, workspace_id, name, conditions, result, priority, is_active)
       VALUES ($1, $2, 'Xref stored', $3, $4, 999, true)`,
      [
        a.userId,
        a.workspaceId,
        JSON.stringify([{ field: 'counterparty_name', operator: 'contains', value: 'axref' }]),
        JSON.stringify({ categoryId: await theirCategory(), walletId: await theirWallet() }),
      ],
    );
    const res = await as(
      request(server()).post(`/classification/transaction/${transactionId}`),
    ).expect(200);
    const [row] = await dataSource.query(
      'SELECT category_id, wallet_id, owner_member_id FROM transactions WHERE id = $1',
      [transactionId],
    );
    expect(row.category_id).not.toBe(await theirCategory());
    expect(row.wallet_id).not.toBe(await theirWallet());
    expect(res.text).not.toContain(bMarker);
  });

  it('does not put B’s category on A’s receipt', async () => {
    const receipt = await receiptOfA();
    await as(request(server()).patch(`/receipts/${receipt.id}`))
      .send({ parsedData: { categoryId: await theirCategory() } })
      .expect(404);
    expect((await reloaded(receipt)).parsedData.categoryId).toBeUndefined();
  });

  it('does not take server-owned receipt fields from the client', async () => {
    const receipt = await receiptOfA();
    await as(request(server()).patch(`/receipts/${receipt.id}`))
      .send({ parsedData: { categorySource: 'manual', validationIssues: [] } })
      .expect(400);
  });

  it('does not book a receipt under B’s category', async () => {
    const receipt = await receiptOfA();
    await as(request(server()).post('/receipts/bulk-approve'))
      .send({ receiptIds: [receipt.id], categoryId: await theirCategory() })
      .expect(404);
    // A category stored before the check existed is refused at approval too.
    const stored = await receiptOfA({ categoryId: await theirCategory() });
    await as(request(server()).post(`/receipts/${stored.id}/approve`))
      .send({})
      .expect(404);
    for (const id of [receipt.id, stored.id]) {
      const after = await dataSource.getRepository(Receipt).findOneByOrFail({ id });
      expect(after.transactionId).toBeNull();
      expect(after.status).toBe(ReceiptStatus.NEEDS_REVIEW);
    }
  });

  it('does not convert a dropped row into one of B’s wallet, category or branch', async () => {
    const statementId = await idIn(a, 'statements');
    const count = async () =>
      (
        await dataSource.query('SELECT count(*)::int AS n FROM transactions WHERE statement_id = $1', [
          statementId,
        ])
      )[0].n;
    const before = await count();
    for (const ref of [
      { walletId: await theirWallet() },
      { categoryId: await theirCategory() },
      { branchId: await theirBranch() },
    ]) {
      await as(request(server()).post(`/statements/${statementId}/convert-dropped-sample`))
        .send({
          index: 0,
          warning: 'xref',
          transaction: { transactionDate: '2026-01-01', debit: 1, ...ref },
        })
        .expect(404);
    }
    expect(await count()).toBe(before);
  });

  it('does not file A’s invoice line under B’s category', async () => {
    const res = await as(request(server()).post('/invoices')).send({
      clientId: await idIn(a, 'clients'),
      issueDate: '2026-01-05',
      lineItems: [
        { description: 'Xref work', quantity: 1, unitPrice: 100, categoryId: await theirCategory() },
      ],
    });
    expect(res.status).toBe(404);
    const lines = await dataSource.query(
      `SELECT id FROM invoice_line_items WHERE description = 'Xref work'`,
    );
    expect(lines).toHaveLength(0);
  });

  it('does not hand A’s metal lot to B’s owner', async () => {
    const res = await as(request(server()).post('/metals/lots')).send({
      metal: 'XAG',
      quantity: 1,
      unitWeight: 1,
      weightUnit: 'ozt',
      ownerUserId: b.userId,
      price: 30,
    });
    expect(res.status).toBe(404);
    const held = await dataSource.query(
      'SELECT id FROM investment_holdings WHERE workspace_id = $1 AND owner_user_id = $2',
      [a.workspaceId, b.userId],
    );
    expect(held).toHaveLength(0);
  });

  it('does not point A’s inbound webhook at B’s wallet or branch', async () => {
    await as(request(server()).post('/webhook-endpoints'))
      .send({ name: 'Xref hook', defaultWalletId: await theirWallet() })
      .expect(404);
    await as(request(server()).post('/webhook-endpoints'))
      .send({ name: 'Xref hook', defaultBranchId: await theirBranch() })
      .expect(404);
    const mine = await idIn(a, 'webhook_endpoints');
    await as(request(server()).patch(`/webhook-endpoints/${mine}`))
      .send({ defaultWalletId: await theirWallet() })
      .expect(404);
    const [endpoint] = await dataSource.query(
      'SELECT default_wallet_id FROM webhook_endpoints WHERE id = $1',
      [mine],
    );
    expect(endpoint.default_wallet_id).toBeNull();
  });
});
