jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { WebhookDelivery } from '../../src/entities/webhook-delivery.entity';
import { WebhookEvent, WebhookSubscription } from '../../src/entities/webhook-subscription.entity';
import { PayablesService } from '../../src/modules/payables/payables.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>USD
<BANKACCTFROM><ACCTID>444555666</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20260901<DTEND>20260930
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260904<TRNAMT>-18.20<FITID>W1<NAME>BOOK STORE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260926<TRNAMT>2500.00<FITID>W2<NAME>ACME PAYROLL</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

/**
 * What happens in the app reaches a subscription as a queued delivery: single
 * new rows, imported batches, paid and overdue bills, budgets going over.
 */
describe('Webhook events (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `hook-events-${stamp}@example.com` };
  let owner: E2eAccount;
  let subscriptionId: string;
  let categoryId: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();
  const today = () => new Date().toISOString().slice(0, 10);

  /** Deliveries queued for `event`, waiting for the asynchronous listeners. */
  const deliveriesOf = async (
    event: WebhookEvent,
    match: (payload: Record<string, unknown>) => boolean = () => true,
  ): Promise<Array<Record<string, unknown>>> => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const rows = await dataSource
        .getRepository(WebhookDelivery)
        .find({ where: { subscriptionId, event } });
      const payloads = rows.map(row => row.payload as Record<string, unknown>).filter(match);
      if (payloads.length > 0) {
        return payloads;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return [];
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Hook Events');
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(200);
    categoryId = categories.body[0].id;

    // `.invalid` never resolves, so the processor cannot deliver anything out of the test.
    const subscription = await dataSource.getRepository(WebhookSubscription).save({
      workspaceId: owner.workspaceId,
      name: 'Everything',
      url: 'https://hooks.invalid/lumio',
      secret: 'a-secret-of-at-least-16',
      events: Object.values(WebhookEvent),
      isActive: true,
    });
    subscriptionId = subscription.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query('DELETE FROM webhook_subscriptions WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await dataSource.query('DELETE FROM payables WHERE workspace_id = $1', [owner.workspaceId]);
      await dataSource.query('DELETE FROM budgets WHERE workspace_id = $1', [owner.workspaceId]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('announces a manual expense, and the budget it pushes over', async () => {
    await as(owner, request(server()).post('/budgets'))
      .send({ name: 'Tiny', categoryId, limitAmount: 1, periodType: 'monthly' })
      .expect(201);

    const statement = await as(owner, request(server()).post('/statements/manual-expense'))
      .field('amount', '12.50')
      .field('currency', 'EUR')
      .field('merchant', 'Hook Cafe')
      .field('categoryId', categoryId)
      .field('date', today())
      .expect(201);

    const [created] = await deliveriesOf(
      WebhookEvent.TRANSACTION_CREATED,
      payload => payload.statementId === statement.body.id,
    );
    expect(created).toMatchObject({
      event: 'transaction.created',
      workspaceId: owner.workspaceId,
      source: 'manual_expense',
      amount: 12.5,
      currency: 'EUR',
      counterpartyName: 'Hook Cafe',
      categoryId,
      transactionDate: today(),
    });

    const [exceeded] = await deliveriesOf(WebhookEvent.BUDGET_EXCEEDED);
    expect(exceeded).toMatchObject({ name: 'Tiny', limitAmount: 1, categoryId });
  });

  it('announces an uploaded statement, its processing and the batch of rows it made', async () => {
    const uploaded = await as(owner, request(server()).post('/statements'))
      .attach('file', Buffer.from(OFX, 'utf-8'), {
        filename: `hooks-${stamp}.ofx`,
        contentType: 'application/octet-stream',
      })
      .expect(201);
    const statementId = uploaded.body.id;

    const [uploadedEvent] = await deliveriesOf(
      WebhookEvent.STATEMENT_UPLOADED,
      payload => payload.statementId === statementId,
    );
    expect(uploadedEvent).toMatchObject({ statementName: expect.stringContaining('hooks-') });

    let statement = uploaded.body;
    for (let attempt = 0; attempt < 40 && statement.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
      statement = (await as(owner, request(server()).get(`/statements/${statementId}`)).expect(200))
        .body;
    }
    expect(statement.status).toBe('completed');

    const [processed] = await deliveriesOf(
      WebhookEvent.STATEMENT_PROCESSED,
      payload => payload.statementId === statementId,
    );
    expect(processed).toMatchObject({ transactionCount: 2 });

    const rows = await as(owner, request(server()).get(`/transactions?statementId=${statementId}`)).expect(
      200,
    );
    const [batch] = await deliveriesOf(
      WebhookEvent.TRANSACTIONS_IMPORTED,
      payload => payload.statementId === statementId,
    );
    expect(batch).toMatchObject({ source: 'statement', count: 2, truncated: false });
    expect([...(batch.transactionIds as string[])].sort()).toEqual(
      rows.body.data.map((row: { id: string }) => row.id).sort(),
    );
  });

  it('announces a bill paid in cash: the bill and the transaction booked for it', async () => {
    const bill = await as(owner, request(server()).post('/payables'))
      .send({ vendor: 'Hook Landlord', amount: 700, currency: 'EUR', dueDate: today() })
      .expect(201);

    await as(owner, request(server()).put(`/payables/${bill.body.id}/mark-paid`))
      .send({ inHand: true, categoryId })
      .expect(200);

    const [paid] = await deliveriesOf(
      WebhookEvent.BILL_PAID,
      payload => payload.payableId === bill.body.id,
    );
    expect(paid).toMatchObject({
      event: 'bill.paid',
      direction: 'payable',
      vendor: 'Hook Landlord',
      amount: 700,
      currency: 'EUR',
    });
    const [booked] = await deliveriesOf(
      WebhookEvent.TRANSACTION_CREATED,
      payload => payload.source === 'payment' && payload.counterpartyName === 'Hook Landlord',
    );
    expect(booked).toMatchObject({ amount: 700, transactionType: 'expense' });

    // Paying again changes nothing, so nothing new is announced.
    await as(owner, request(server()).put(`/payables/${bill.body.id}/mark-paid`))
      .send({ inHand: true, categoryId })
      .expect(200);
    expect(
      await deliveriesOf(WebhookEvent.BILL_PAID, payload => payload.payableId === bill.body.id),
    ).toHaveLength(1);
  });

  it('announces an invoice owed to the workspace when it goes overdue', async () => {
    const invoice = await as(owner, request(server()).post('/payables'))
      .send({
        direction: 'receivable',
        vendor: 'Hook Client',
        amount: 300,
        currency: 'EUR',
        dueDate: '2026-01-05',
      })
      .expect(201);

    await app.get(PayablesService).markOverduePayables();

    const [overdue] = await deliveriesOf(
      WebhookEvent.INVOICE_OVERDUE,
      payload => payload.payableId === invoice.body.id,
    );
    expect(overdue).toMatchObject({
      direction: 'receivable',
      vendor: 'Hook Client',
      outstanding: 300,
      dueDate: '2026-01-05',
    });
  });
});
