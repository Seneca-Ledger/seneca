jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TransactionList } from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

interface ListedTransaction {
  id: string;
  statementId: string;
  transactionDate: string;
}

/**
 * Transactions end to end: listing and filtering within a workspace, editing
 * and deleting, and that another workspace can neither see nor touch them.
 * The fixtures are manual expenses, each of which books one transaction.
 */
describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `tx-owner-${stamp}@example.com`,
    other: `tx-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  const statementIds: string[] = [];
  const transactionIds: string[] = [];

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();

  async function bookExpense(categoryId: string, amount: string, merchant: string, date: string) {
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'KZT')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
    statementIds.push(statement.body.id);

    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    expect(listed.body.data).toHaveLength(1);
    transactionIds.push(listed.body.data[0].id);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Transactions Owner');
    other = await registerAccount(app, emails.other, 'Transactions Other');

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const categoryId: string = categories.body[0].id;

    await bookExpense(categoryId, '100', 'Coffee shop', '2026-01-10');
    await bookExpense(categoryId, '250', 'Book store', '2026-02-15');
    await bookExpense(categoryId, '900', 'Hardware store', '2026-03-20');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('GET /transactions', () => {
    it('lists the workspace transactions with paging details', async () => {
      const res = await as(owner, request(server()).get('/transactions')).expect(200);
      expect(res.body.total).toBe(3);
      expect(res.body.data).toHaveLength(3);
      expect(res.body.items).toEqual(res.body.data);
      expect(res.body).toMatchObject({ page: 1, limit: 50 });
      // The statement edit page checks the rows against the same contract in dev.
      Schema.decodeUnknownSync(TransactionList)(res.body.data);
    });

    it('filters by statement', async () => {
      const res = await as(
        owner,
        request(server()).get(`/transactions?statementId=${statementIds[1]}`),
      ).expect(200);
      expect(res.body.data.map((tx: ListedTransaction) => tx.id)).toEqual([transactionIds[1]]);
    });

    it('filters by date range', async () => {
      const res = await as(
        owner,
        request(server()).get('/transactions?startDate=2026-02-01&endDate=2026-02-28'),
      ).expect(200);
      expect(res.body.data.map((tx: ListedTransaction) => tx.id)).toEqual([transactionIds[1]]);
    });

    it('paginates', async () => {
      const res = await as(owner, request(server()).get('/transactions?limit=2&page=2')).expect(
        200,
      );
      expect(res.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(res.body.data).toHaveLength(1);
    });

    it('requires authentication', () => {
      return request(server()).get('/transactions').expect(401);
    });

    it('shows another workspace none of them', async () => {
      const res = await as(other, request(server()).get('/transactions')).expect(200);
      const ids = res.body.data.map((tx: ListedTransaction) => tx.id);
      expect(ids).not.toEqual(expect.arrayContaining([transactionIds[0]]));
    });

    it('refuses a workspace the caller is not a member of', () => {
      return as(other, request(server()).get('/transactions'), owner.workspaceId).expect(403);
    });
  });

  describe('GET /transactions/:id', () => {
    it('returns the transaction', async () => {
      const res = await as(
        owner,
        request(server()).get(`/transactions/${transactionIds[0]}`),
      ).expect(200);
      expect(res.body).toMatchObject({ id: transactionIds[0], statementId: statementIds[0] });
    });

    it('does not find it from another workspace', () => {
      return as(other, request(server()).get(`/transactions/${transactionIds[0]}`)).expect(404);
    });
  });

  describe('PUT /transactions/:id', () => {
    it('updates the transaction', async () => {
      const res = await as(owner, request(server()).put(`/transactions/${transactionIds[0]}`))
        .send({ counterpartyName: 'Corner coffee' })
        .expect(200);
      expect(res.body.counterpartyName).toBe('Corner coffee');
    });

    it('rejects invalid data', () => {
      return as(owner, request(server()).put(`/transactions/${transactionIds[0]}`))
        .send({ debit: 'not-a-number' })
        .expect(400);
    });

    it('does not let another workspace change it', () => {
      return as(other, request(server()).put(`/transactions/${transactionIds[0]}`))
        .send({ counterpartyName: 'Tampered' })
        .expect(404);
    });
  });

  describe('POST /transactions/bulk-update', () => {
    it('updates several transactions at once', async () => {
      const res = await as(owner, request(server()).post('/transactions/bulk-update'))
        .send({
          items: [
            { id: transactionIds[0], updates: { counterpartyName: 'Bulk A' } },
            { id: transactionIds[1], updates: { counterpartyName: 'Bulk B' } },
          ],
        })
        .expect(200);
      expect(res.body.map((tx: { counterpartyName: string }) => tx.counterpartyName).sort()).toEqual([
        'Bulk A',
        'Bulk B',
      ]);
    });

    it('rejects a body in neither supported shape', () => {
      return as(owner, request(server()).post('/transactions/bulk-update')).send({}).expect(400);
    });
  });

  describe('DELETE /transactions/:id', () => {
    it('does not let another workspace delete it', () => {
      return as(other, request(server()).delete(`/transactions/${transactionIds[2]}`)).expect(404);
    });

    it('deletes the transaction', async () => {
      await as(owner, request(server()).delete(`/transactions/${transactionIds[2]}`)).expect(204);
      await as(owner, request(server()).get(`/transactions/${transactionIds[2]}`)).expect(404);
    });
  });
});
