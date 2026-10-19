jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

describe('Statements manual expense (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;
  let workspaceId: string;

  const testUser = {
    email: `manual-expense-e2e-${Date.now()}@example.com`,
    password: 'Test123!@#',
    name: 'Manual Expense E2E User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    const registerRes = await request(app.getHttpServer()).post('/auth/register').send(testUser);
    userId = registerRes.body.user.id;

    const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    accessToken = accessTokenOf(loginRes);
    workspaceId = loginRes.body.user.workspaceId;
  });

  afterAll(async () => {
    if (dataSource && userId) {
      await dataSource.query(
        'DELETE FROM transactions WHERE statement_id IN (SELECT id FROM statements WHERE user_id = $1)',
        [userId],
      );
      await dataSource.query('DELETE FROM statements WHERE user_id = $1', [userId]);
      await deleteUserByEmail(dataSource, testUser.email);
    }

    await app.close();
  });

  it('creates manual expense and stores related transaction', async () => {
    // A manual expense needs a category; registration seeds the workspace's defaults.
    const categories = await request(app.getHttpServer())
      .get('/categories?type=expense')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
    const categoryId: string = categories.body[0].id;

    const response = await request(app.getHttpServer())
      .post('/statements/manual-expense')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-workspace-id', workspaceId)
      .field('amount', '222')
      .field('currency', 'KZT')
      .field('merchant', 'adad')
      .field('description', 'ada')
      .field('date', '2026-02-20')
      .field('categoryId', categoryId)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.status).toBe('completed');
    expect(Number(response.body.totalTransactions)).toBe(1);
    expect(Number(response.body.totalDebit)).toBe(222);
    expect(response.body.currency).toBe('KZT');

    const transactionRows = await dataSource.query(
      `SELECT statement_id, counterparty_name, payment_purpose, debit, transaction_type, currency
       FROM transactions
       WHERE statement_id = $1`,
      [response.body.id],
    );

    expect(transactionRows).toHaveLength(1);
    expect(transactionRows[0].statement_id).toBe(response.body.id);
    expect(transactionRows[0].counterparty_name).toBe('adad');
    expect(transactionRows[0].payment_purpose).toBe('ada');
    expect(Number(transactionRows[0].debit)).toBe(222);
    expect(transactionRows[0].transaction_type).toBe('expense');
    expect(transactionRows[0].currency).toBe('KZT');
  });
});
