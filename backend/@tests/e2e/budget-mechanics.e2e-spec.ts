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
 * Budget mechanics: a budget on a parent category counts its subcategories,
 * rollover carries what was not spent, and "what would this expense do"
 * answers before the entry is booked. Another workspace sees nothing.
 */
describe('Budget mechanics (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `budget-owner-${stamp}@example.com`,
    other: `budget-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let foodId: string;
  let groceriesId: string;
  let budgetId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const today = () => new Date().toISOString().slice(0, 10);

  async function bookExpense(categoryId: string, amount: number): Promise<void> {
    await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', String(amount))
      .field('currency', 'USD')
      .field('merchant', `Shop ${amount}`)
      .field('categoryId', categoryId)
      .field('date', today())
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

    owner = await registerAccount(app, emails.owner, 'Budget Owner');
    other = await registerAccount(app, emails.other, 'Budget Other');

    const food = await as(owner, request(server()).post('/categories'))
      .send({ name: `Food ${stamp}`, type: 'expense' })
      .expect(201);
    foodId = food.body.id;
    const groceries = await as(owner, request(server()).post('/categories'))
      .send({ name: `Groceries ${stamp}`, type: 'expense', parentId: foodId })
      .expect(201);
    groceriesId = groceries.body.id;

    const budget = await as(owner, request(server()).post('/budgets'))
      .send({
        name: 'Food',
        categoryId: foodId,
        limitAmount: 100,
        periodType: 'monthly',
        currency: 'USD',
        rolloverMode: 'carry',
      })
      .expect(201);
    budgetId = budget.body.id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('counts a subcategory expense against the parent budget', async () => {
    await bookExpense(groceriesId, 80);

    const res = await as(owner, request(server()).get(`/budgets/${budgetId}`)).expect(200);
    expect(res.body.rolloverMode).toBe('carry');
    expect(Number(res.body.spentAmount)).toBe(80);
    // Created this period: nothing to carry yet, so available equals the limit.
    expect(res.body.availableAmount).toBe(100);
    expect(res.body.carriedAmount).toBe(0);
    expect(res.body.percentUsed).toBe(80);
  });

  it('warns that one more expense pushes the budget over and the account into the red', async () => {
    await as(owner, request(server()).post('/wallets'))
      .send({ name: 'Cash', currency: 'USD', initialBalance: 10 })
      .expect(201);

    const res = await as(
      owner,
      request(server()).get(
        `/budgets/impact?categoryId=${groceriesId}&amount=30&currency=USD&date=${today()}`,
      ),
    ).expect(200);

    expect(res.body.budgets).toEqual([
      expect.objectContaining({ id: budgetId, remainingAfter: -10, exceeds: true }),
    ]);
    expect(res.body.account).toEqual(
      expect.objectContaining({ name: 'Cash', balanceAfter: -20, overdraws: true }),
    );
  });

  it('switches the rollover mode on an existing budget', async () => {
    const res = await as(owner, request(server()).put(`/budgets/${budgetId}`))
      .send({ rolloverMode: 'refill' })
      .expect(200);
    expect(res.body.rolloverMode).toBe('refill');
  });

  it('keeps the impact inside the workspace', async () => {
    const res = await as(
      other,
      request(server()).get(`/budgets/impact?categoryId=${groceriesId}&amount=30&currency=USD`),
    ).expect(200);
    expect(res.body).toEqual({ budgets: [], account: null });
  });
});
