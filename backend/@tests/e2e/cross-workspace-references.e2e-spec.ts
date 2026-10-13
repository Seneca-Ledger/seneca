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
});
