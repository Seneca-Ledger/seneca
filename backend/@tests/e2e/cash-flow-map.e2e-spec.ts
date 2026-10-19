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

/** Where the money went in a period, with subcategories rolled up, a comparison and a CSV. */
describe('Cash-flow map (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `cfm-owner-${stamp}@example.com`,
    other: `cfm-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let foodId: string;
  let groceriesId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const day = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  async function book(categoryId: string, amount: number, date: string): Promise<void> {
    await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', 'USD')
      .field('merchant', `Shop ${amount}`)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'CFM Owner');
    other = await registerAccount(app, emails.other, 'CFM Other');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const food = await as(owner, request(server()).post('/categories'))
      .send({ name: `Food ${stamp}`, type: 'expense' })
      .expect(201);
    foodId = food.body.id;
    const groceries = await as(owner, request(server()).post('/categories'))
      .send({ name: `Groceries ${stamp}`, type: 'expense', parentId: foodId })
      .expect(201);
    groceriesId = groceries.body.id;

    await book(groceriesId, 40, day(-2));
    await book(foodId, 10, day(-1));
    // Last period, for the comparison.
    await book(groceriesId, 25, day(-12));
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('rolls the subcategory into its parent and compares with the period before', async () => {
    const res = await as(
      owner,
      request(server()).get(`/reports/cash-flow-map?dateFrom=${day(-6)}&dateTo=${day(0)}&compare=true`),
    ).expect(200);

    expect(res.body.currency).toBe('USD');
    expect(res.body.expense.total).toBe(50);
    const food = res.body.expense.categories.find((item: { id: string }) => item.id === foodId);
    expect(food).toMatchObject({ amount: 50, previousAmount: 25 });
    expect(food.children).toEqual([
      expect.objectContaining({ id: groceriesId, amount: 40, previousAmount: 25 }),
    ]);
    expect(res.body.previous).toEqual({ income: 0, expense: 25, net: -25 });
    expect(res.body.sankey.links).toContainEqual({
      source: `cat:${foodId}`,
      target: `sub:${groceriesId}`,
      value: 40,
    });
    expect(res.body.availableCategories.map((item: { id: string }) => item.id)).toContain(foodId);
  });

  it('filters by category and exports the table as CSV', async () => {
    const filtered = await as(
      owner,
      request(server()).get(
        `/reports/cash-flow-map?dateFrom=${day(-6)}&dateTo=${day(0)}&categories=${groceriesId}`,
      ),
    ).expect(200);
    expect(filtered.body.expense.total).toBe(40);

    const csv = await as(
      owner,
      request(server()).get(`/reports/cash-flow-map?dateFrom=${day(-6)}&dateTo=${day(0)}&format=csv`),
    ).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('category,subcategory,amount_USD');
    expect(csv.text).toContain(`"Food ${stamp}","Groceries ${stamp}",40.00`);
  });

  it('shows another workspace nothing', async () => {
    const res = await as(other, request(server()).get('/reports/cash-flow-map')).expect(200);
    expect(res.body.expense.total).toBe(0);
    expect(res.body.sankey.links).toEqual([]);
  });
});
