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

interface FlowNode {
  id: string;
  kind: string;
  name: string | null;
  amount: number;
  share: number;
}

/**
 * The top-spenders sankey end to end: total → category → merchant from real
 * transactions, the income side, the statement filters, and tenant isolation.
 */
describe('Spend flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `flow-owner-${stamp}@example.com`,
    other: `flow-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let currency: string;
  let categoryId: string;
  const statementIds: string[] = [];

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();
  const flow = (account: E2eAccount, query = '') =>
    as(account, request(server()).get(`/reports/spend-flow${query}`));

  async function bookExpense(amount: string, merchant: string, date: string) {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', currency)
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
    statementIds.push(statement.body.id);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Flow Owner');
    other = await registerAccount(app, emails.other, 'Flow Other');

    // Book in the workspace currency so no exchange rate is involved.
    const empty = await flow(owner).expect(200);
    currency = empty.body.currency;
    expect(empty.body).toMatchObject({ total: 0, nodes: [], links: [] });

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    categoryId = categories.body[0].id;

    await bookExpense('100', 'Coffee shop', '2026-01-10');
    await bookExpense('50', 'Coffee shop', '2026-01-12');
    await bookExpense('250', 'Book store', '2026-02-15');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('sums merchants under their category and the category under the total', async () => {
    const res = await flow(owner).expect(200);
    const nodes: FlowNode[] = res.body.nodes;

    expect(res.body.total).toBe(400);
    expect(nodes.find(node => node.id === 'total')).toMatchObject({ amount: 400, share: 1 });
    expect(nodes.find(node => node.id === `cat:${categoryId}`)).toMatchObject({ amount: 400 });
    expect(nodes.find(node => node.name === 'Coffee shop')).toMatchObject({
      kind: 'merchant',
      amount: 150,
      share: 0.375,
    });
    expect(res.body.links).toContainEqual({
      source: `cat:${categoryId}`,
      target: 'm:' + categoryId + ':coffee shop',
      value: 150,
    });
  });

  it('draws merchants straight under the total for top merchants', async () => {
    const res = await flow(owner, '?groupBy=merchant').expect(200);
    const nodes: FlowNode[] = res.body.nodes;

    expect(res.body.total).toBe(400);
    expect(nodes.some(node => node.kind === 'category')).toBe(false);
    expect(nodes.find(node => node.id === 'm:coffee shop')).toMatchObject({ amount: 150 });
    expect(res.body.links.every((link: { source: string }) => link.source === 'total')).toBe(true);
  });

  it('breaks categories into subcategories for top categories', async () => {
    const res = await flow(owner, '?groupBy=category-subcategory').expect(200);
    const nodes: FlowNode[] = res.body.nodes;

    expect(res.body.total).toBe(400);
    expect(nodes.some(node => node.kind === 'merchant')).toBe(false);
    expect(nodes.find(node => node.id === `cat:${categoryId}`)).toMatchObject({ amount: 400 });
  });

  it('honours the date window', async () => {
    const res = await flow(owner, '?dateFrom=2026-02-01&dateTo=2026-02-28').expect(200);
    expect(res.body.total).toBe(250);
    expect(res.body).toMatchObject({ dateFrom: '2026-02-01', dateTo: '2026-02-28' });
  });

  it('filters by statement status, type and uploader', async () => {
    await flow(owner, '?statuses=error').expect(200).expect(res => {
      expect(res.body.total).toBe(0);
    });
    // The page offers statuses that are not enum members; they match nothing.
    await flow(owner, '?statuses=unreported&bankNames=no-such-bank').expect(200).expect(res => {
      expect(res.body.total).toBe(0);
    });
    await flow(owner, '?statuses=completed').expect(200).expect(res => {
      expect(res.body.total).toBe(400);
    });
    const [{ file_type: fileType }] = await dataSource.query(
      'SELECT file_type FROM statements WHERE id = $1',
      [statementIds[0]],
    );
    const otherType = fileType === 'pdf' ? 'csv' : 'pdf';
    await flow(owner, `?documentType=${fileType}`).expect(200).expect(res => {
      expect(res.body.total).toBe(400);
    });
    await flow(owner, `?documentType=${otherType}`).expect(200).expect(res => {
      expect(res.body.total).toBe(0);
    });
    await flow(owner, '?documentType=trip').expect(200).expect(res => {
      expect(res.body.total).toBe(0);
    });
    const ownerId = (
      await dataSource.query('SELECT id FROM users WHERE email = $1', [emails.owner])
    )[0].id as string;
    await flow(owner, `?userIds=${ownerId}`).expect(200).expect(res => {
      expect(res.body.total).toBe(400);
    });
    await flow(owner, '?userIds=00000000-0000-0000-0000-000000000000').expect(200).expect(res => {
      expect(res.body.total).toBe(0);
    });
  });

  it('switches to the income side', async () => {
    await dataSource.query(
      `UPDATE transactions SET transaction_type = 'income' WHERE statement_id = $1`,
      [statementIds[2]],
    );
    const income = await flow(owner, '?type=income').expect(200);
    expect(income.body).toMatchObject({ type: 'income', total: 250 });
    const expense = await flow(owner).expect(200);
    expect(expense.body.total).toBe(150);
  });

  it('rejects invalid query values', async () => {
    await flow(owner, '?type=transfer').expect(400);
    await flow(owner, '?groupBy=weekday').expect(400);
    await flow(owner, '?merchantsPerCategory=50').expect(400);
  });

  it('shows another workspace none of it', async () => {
    const res = await flow(other).expect(200);
    expect(res.body.total).toBe(0);
  });

  it('refuses a workspace the caller is not a member of', () => {
    return as(other, request(server()).get('/reports/spend-flow'), owner.workspaceId).expect(403);
  });
});
