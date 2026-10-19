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
 * The small-business pack: a bill meets the bank row that paid it, ageing
 * buckets, duplicate bills, a dunning reminder and the owners report.
 */
describe('Small-business pack (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `smb-owner-${stamp}@example.com`,
    other: `smb-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let rentId: string;
  let rentTransactionId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const day = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'SMB Owner');
    other = await registerAccount(app, emails.other, 'SMB Other');
    await as(owner, request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ currency: 'USD' })
      .expect(200);

    const rent = await as(owner, request(server()).post('/payables'))
      .send({ vendor: 'Landlord LLC', amount: 500, currency: 'USD', dueDate: day(-3) })
      .expect(201);
    rentId = rent.body.id;
    // A second identical bill a day later: a duplicate.
    await as(owner, request(server()).post('/payables'))
      .send({ vendor: 'Landlord LLC', amount: 500, currency: 'USD', dueDate: day(-2) })
      .expect(201);
    // Long overdue, for the ageing table.
    await as(owner, request(server()).post('/payables'))
      .send({ vendor: 'Old supplier', amount: 120, currency: 'USD', dueDate: day(-100) })
      .expect(201);

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '500')
      .field('currency', 'USD')
      .field('merchant', 'LANDLORD LLC rent')
      .field('categoryId', categories.body[0].id)
      .field('date', day(-1))
      .expect(201);
    const listed = await as(
      owner,
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    rentTransactionId = listed.body.data[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('pairs the bill with its bank row, ages the rest and flags the duplicate', async () => {
    const res = await as(owner, request(server()).get('/reconciliation')).expect(200);

    expect(res.body.currency).toBe('USD');
    const match = res.body.matches.find((item: { transactionId: string }) => item.transactionId === rentTransactionId);
    expect(match).toBeDefined();
    expect(match.item.vendor).toBe('Landlord LLC');
    expect(match.reasons).toEqual(expect.arrayContaining(['amount', 'vendor', 'date']));

    const payables = res.body.ageing.find((row: { direction: string }) => row.direction === 'payable');
    expect(payables.buckets.d90_plus).toBe(120);
    expect(payables.total).toBe(1120);

    expect(res.body.duplicates).toEqual([
      expect.objectContaining({ vendor: 'Landlord LLC', amount: 500, itemIds: expect.any(Array) }),
    ]);
    expect(res.body.duplicates[0].itemIds).toHaveLength(2);
  });

  it('settles the bill on confirm', async () => {
    const res = await as(owner, request(server()).post('/reconciliation/confirm'))
      .send({ payableId: rentId, transactionId: rentTransactionId })
      .expect(200);
    expect(res.body).toMatchObject({ status: 'paid', linkedTransactionId: rentTransactionId });

    const after = await as(owner, request(server()).get('/reconciliation')).expect(200);
    expect(after.body.matches.map((m: { transactionId: string }) => m.transactionId)).not.toContain(
      rentTransactionId,
    );
  });

  it('refuses a reminder without SMTP, and only for a sent invoice', async () => {
    const client = await as(owner, request(server()).post('/clients'))
      .send({ name: 'Acme', email: 'billing@example.com' })
      .expect(201);
    const invoice = await as(owner, request(server()).post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: day(-10),
        dueDate: day(-1),
        currency: 'USD',
        lineItems: [{ description: 'Work', quantity: 1, unitPrice: 300 }],
      })
      .expect(201);
    // Draft: nothing to remind about yet.
    await as(owner, request(server()).post(`/invoices/${invoice.body.id}/remind`)).expect(400);

    // An invoice is only sent once the seller's details are on it.
    await as(owner, request(server()).put('/business-profile'))
      .send({ legalName: 'Owner Studio', addressLines: '1 Main St' })
      .expect(200);

    await as(owner, request(server()).put(`/invoices/${invoice.body.id}/send`)).expect(200);
    // No mail server in the test environment: told so, not silently skipped.
    await as(owner, request(server()).post(`/invoices/${invoice.body.id}/remind`)).expect(409);
  });

  it('lists active subscriptions with owner and monthly cost, as JSON and CSV', async () => {
    const created = await as(owner, request(server()).post('/subscriptions'))
      .send({ vendorName: 'Slack', amount: 120, frequency: 'annual', currency: 'USD' })
      .expect(201);
    await as(owner, request(server()).post(`/subscriptions/${created.body.id}/confirm`)).expect(201);

    const report = await as(owner, request(server()).get('/subscriptions/business-report')).expect(
      200,
    );
    expect(report.body.rows).toEqual([
      expect.objectContaining({ vendorName: 'Slack', monthlyCost: 10, owner: null }),
    ]);
    expect(report.body.totalMonthlyCost).toBe(10);

    const csv = await as(
      owner,
      request(server()).get('/subscriptions/business-report?format=csv'),
    ).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('"Slack","",10.00,120.00,"USD","annual"');
  });

  it('keeps everything inside the workspace', async () => {
    const res = await as(other, request(server()).get('/reconciliation')).expect(200);
    expect(res.body.matches).toEqual([]);
    expect(res.body.unmatchedItems).toEqual([]);
    await as(other, request(server()).post('/reconciliation/confirm'))
      .send({ payableId: rentId, transactionId: rentTransactionId })
      .expect(404);
  });
});
