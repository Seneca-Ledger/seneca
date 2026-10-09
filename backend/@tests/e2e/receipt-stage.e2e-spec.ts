import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TransactionType } from '../../src/entities/transaction.entity';
import { ReceiptsService } from '../../src/modules/receipts/receipts.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * Receipts share the Submit → Approve flow with statements, and approving a
 * receipt into a transaction must happen once however often it is requested.
 */
describe('Receipt stage and approval (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;
  let outsider: E2eAccount;

  const emails = {
    owner: 'receipt-stage-owner@example.com',
    outsider: 'receipt-stage-outsider@example.com',
  };

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);

  async function insertReceipt(
    account: E2eAccount,
    options: { withData?: boolean; statementId?: string | null } = {},
  ): Promise<string> {
    const parsed =
      options.withData === false ? {} : { amount: 12.5, date: '2026-09-01', vendor: 'Probe Café' };
    const [row] = await dataSource.query(
      `INSERT INTO receipts
         (user_id, workspace_id, source, subject, sender, received_at, parsed_data, statement_id)
       VALUES ($1, $2, 'scan', 'probe.jpg', 'scan', now(), $3::jsonb, $4)
       RETURNING id`,
      [account.userId, account.workspaceId, JSON.stringify(parsed), options.statementId ?? null],
    );
    return row.id;
  }

  async function insertStatement(account: E2eAccount): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash, bank_name, status, currency)
       VALUES ($1, $2, 'scan.jpg', '/dev/null', 'image', 1, md5(random()::text), 'other', 'completed', 'USD')
       RETURNING id`,
      [account.userId, account.workspaceId],
    );
    return row.id;
  }

  const stageOf = async (table: 'receipts' | 'statements', id: string): Promise<string> =>
    (await dataSource.query(`SELECT stage FROM ${table} WHERE id = $1`, [id]))[0].stage;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    for (const email of Object.values(emails)) {
      await dataSource.query(
        'DELETE FROM receipts WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
        [email],
      );
      await deleteUserByEmail(dataSource, email);
    }
    owner = await registerAccount(app, emails.owner, 'Receipt Stage Owner');
    outsider = await registerAccount(app, emails.outsider, 'Receipt Stage Outsider');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const account of [owner, outsider].filter(Boolean)) {
        await dataSource.query('DELETE FROM receipts WHERE user_id = $1', [account.userId]);
        await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
          account.workspaceId,
        ]);
      }
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('moves a receipt to approve together with the statement its scan created', async () => {
    const statementId = await insertStatement(owner);
    const receiptId = await insertReceipt(owner, { statementId });

    const res = await as(
      owner,
      request(server()).post('/receipts/stage').send({ receiptIds: [receiptId], stage: 'approve' }),
    ).expect(200);

    expect(res.body).toEqual({ updated: [receiptId], skipped: [] });
    expect(await stageOf('receipts', receiptId)).toBe('approve');
    expect(await stageOf('statements', statementId)).toBe('approve');

    await as(
      owner,
      request(server()).post('/receipts/stage').send({ receiptIds: [receiptId], stage: 'submit' }),
    ).expect(200);
    expect(await stageOf('receipts', receiptId)).toBe('submit');
    expect(await stageOf('statements', statementId)).toBe('submit');
  });

  it('keeps a receipt without amount or date in submit and refuses pay', async () => {
    const empty = await insertReceipt(owner, { withData: false });
    const ready = await insertReceipt(owner);

    const res = await as(
      owner,
      request(server())
        .post('/receipts/stage')
        .send({ receiptIds: [empty, ready], stage: 'approve' }),
    ).expect(200);
    expect(res.body).toEqual({
      updated: [ready],
      skipped: [{ id: empty, code: 'MISSING_RECEIPT_DATA' }],
    });

    const pay = await as(
      owner,
      request(server()).post('/receipts/stage').send({ receiptIds: [ready], stage: 'pay' }),
    ).expect(200);
    expect(pay.body.skipped).toEqual([{ id: ready, code: 'INVALID_STAGE_TRANSITION' }]);
  });

  it('lists receipts of the requested stage only', async () => {
    const inApprove = await insertReceipt(owner);
    const inSubmit = await insertReceipt(owner);
    await as(
      owner,
      request(server()).post('/receipts/stage').send({ receiptIds: [inApprove], stage: 'approve' }),
    ).expect(200);

    const list = await as(
      owner,
      request(server()).get('/integrations/gmail/receipts').query({ stage: 'submit', limit: 100 }),
    ).expect(200);
    const ids = (list.body.receipts as Array<{ id: string }>).map(receipt => receipt.id);

    expect(ids).toContain(inSubmit);
    expect(ids).not.toContain(inApprove);
  });

  it('does not touch receipts of another workspace', async () => {
    const foreign = await insertReceipt(outsider);

    const res = await as(
      owner,
      request(server()).post('/receipts/stage').send({ receiptIds: [foreign], stage: 'approve' }),
    ).expect(200);

    expect(res.body.skipped).toEqual([{ id: foreign, code: 'RECEIPT_NOT_FOUND' }]);
    expect(await stageOf('receipts', foreign)).toBe('submit');
  });

  it('books one transaction however many times a receipt is approved', async () => {
    const receiptId = await insertReceipt(owner);
    const approve = () =>
      as(owner, request(server()).post(`/receipts/${receiptId}/approve`)).expect(201);

    const [first, second, third] = await Promise.all([approve(), approve(), approve()]);

    const transactionIds = new Set(
      [first, second, third].map(res => res.body.transaction.id as string),
    );
    expect(transactionIds.size).toBe(1);
    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*)::int AS count FROM transactions
        WHERE workspace_id = $1 AND counterparty_name = 'Probe Café'
          AND id = (SELECT transaction_id FROM receipts WHERE id = $2)`,
      [owner.workspaceId, receiptId],
    );
    expect(count).toBe(1);
    const [{ total }] = await dataSource.query(
      `SELECT COUNT(*)::int AS total FROM transactions
        WHERE workspace_id = $1 AND counterparty_name = 'Probe Café'`,
      [owner.workspaceId],
    );
    expect(total).toBe(1);
  });

  it('books one transaction when approvals race each other', async () => {
    const receiptId = await insertReceipt(owner);
    const receipts = app.get(ReceiptsService);

    // Started in the same tick, so every call opens its DB transaction before any commits.
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        receipts.approveOnce(receiptId, owner.workspaceId, () => ({
          workspaceId: owner.workspaceId,
          transactionDate: new Date('2026-09-03'),
          counterpartyName: 'Race probe',
          paymentPurpose: 'Race probe',
          amount: 3,
          currency: 'USD',
          transactionType: TransactionType.EXPENSE,
        })),
      ),
    );

    expect(results.filter(result => result?.created)).toHaveLength(1);
    const [{ total }] = await dataSource.query(
      `SELECT COUNT(*)::int AS total FROM transactions
        WHERE workspace_id = $1 AND counterparty_name = 'Race probe'`,
      [owner.workspaceId],
    );
    expect(total).toBe(1);
  });

  it('keeps the Gmail approve endpoint to one transaction as well', async () => {
    const receiptId = await insertReceipt(owner);
    const body = { amount: 7, date: '2026-09-02', description: 'Gmail probe', currency: 'EUR' };
    const approve = () =>
      as(
        owner,
        request(server()).post(`/integrations/gmail/receipts/${receiptId}/approve`).send(body),
      ).expect(201);

    await approve();
    await approve();

    const [{ total }] = await dataSource.query(
      `SELECT COUNT(*)::int AS total FROM transactions
        WHERE workspace_id = $1 AND counterparty_name = 'Gmail probe'`,
      [owner.workspaceId],
    );
    expect(total).toBe(1);
  });
});
