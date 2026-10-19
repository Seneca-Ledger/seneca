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
 * A scan books its transaction the moment it is uploaded. Approving the
 * receipt afterwards confirms that transaction, it never books a second one.
 */
describe('Approving a scanned receipt (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;

  const email = 'receipt-scan-approve@example.com';

  const server = () => app.getHttpServer();
  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);

  /** What the scan upload leaves behind: a statement, its one transaction and the receipt. */
  async function insertScan(parsed: Record<string, unknown>) {
    const [statement] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash,
          bank_name, status, currency, parsing_details)
       VALUES ($1, $2, 'scan.jpg', '/dev/null', 'image', 1, md5(random()::text), 'other',
               'completed', 'EUR', '{"detectedBy":"receipt-scan"}'::jsonb)
       RETURNING id`,
      [owner.userId, owner.workspaceId],
    );
    const [transaction] = await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type,
          workspace_id, statement_id, amount, debit, currency, is_verified)
       VALUES ('2026-09-01', 'Scan probe', 'Scan probe', 'expense', $1, $2, 12.5, 12.5, 'EUR', false)
       RETURNING id`,
      [owner.workspaceId, statement.id],
    );
    const [receipt] = await dataSource.query(
      `INSERT INTO receipts
         (user_id, workspace_id, source, subject, sender, received_at, parsed_data, statement_id, status)
       VALUES ($1, $2, 'scan', 'scan.jpg', 'camera-scan', now(), $3::jsonb, $4, 'draft')
       RETURNING id`,
      [owner.userId, owner.workspaceId, JSON.stringify(parsed), statement.id],
    );
    return {
      statementId: statement.id as string,
      transactionId: transaction.id as string,
      receiptId: receipt.id as string,
    };
  }

  const transactionRow = async (id: string) =>
    (
      await dataSource.query(
        `SELECT amount::float AS amount, counterparty_name, transaction_date::text AS date,
                is_duplicate, duplicate_of_id, is_verified
           FROM transactions WHERE id = $1`,
        [id],
      )
    )[0];

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

    await dataSource.query(
      'DELETE FROM receipts WHERE user_id IN (SELECT id FROM users WHERE email = $1)',
      [email],
    );
    await deleteUserByEmail(dataSource, email);
    owner = await registerAccount(app, email, 'Scan Approve Owner');
  });

  afterAll(async () => {
    if (dataSource && owner) {
      await dataSource.query('DELETE FROM receipts WHERE user_id = $1', [owner.userId]);
      await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await dataSource.query('DELETE FROM statements WHERE workspace_id = $1', [owner.workspaceId]);
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('confirms the transaction the scan booked, with the receipt as edited', async () => {
    const scan = await insertScan({ amount: 14, date: '2026-09-02', vendor: 'Scan probe edited' });

    const res = await as(request(server()).post(`/receipts/${scan.receiptId}/approve`)).expect(201);

    expect(res.body.transaction.id).toBe(scan.transactionId);
    const [{ total }] = await dataSource.query(
      'SELECT COUNT(*)::int AS total FROM transactions WHERE workspace_id = $1',
      [owner.workspaceId],
    );
    expect(total).toBe(1);
    expect(await transactionRow(scan.transactionId)).toMatchObject({
      amount: 14,
      counterparty_name: 'Scan probe edited',
      date: '2026-09-02',
      is_verified: true,
    });
    // Confirmed with update(), which skips the entity hook: the key follows the edit anyway.
    const [{ payee_key }] = await dataSource.query(
      'SELECT payee_key FROM transactions WHERE id = $1',
      [scan.transactionId],
    );
    expect(payee_key).toBe('scan probe edited');
    const [receipt] = await dataSource.query(
      'SELECT status, transaction_id FROM receipts WHERE id = $1',
      [scan.receiptId],
    );
    expect(receipt).toEqual({ status: 'approved', transaction_id: scan.transactionId });
  });

  it('refuses to confirm a receipt without a date, leaving its transaction unconfirmed', async () => {
    const scan = await insertScan({ amount: 5, vendor: 'Dateless probe' });

    await as(request(server()).post(`/receipts/${scan.receiptId}/approve`)).expect(400);

    expect(await transactionRow(scan.transactionId)).toMatchObject({
      date: '2026-09-01',
      is_verified: false,
    });
    const [receipt] = await dataSource.query('SELECT status FROM receipts WHERE id = $1', [
      scan.receiptId,
    ]);
    expect(receipt.status).toBe('draft');
  });

  it('attaches a receipt without a date to a bank row, which keeps its own date', async () => {
    const scan = await insertScan({ amount: 7, vendor: 'Dateless bank probe' });
    const [bankRow] = await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type,
          workspace_id, amount, debit, currency)
       VALUES ('2026-08-30', 'DATELESS BANK PROBE', 'card', 'expense', $1, 7, 7, 'EUR')
       RETURNING id`,
      [owner.workspaceId],
    );

    await as(
      request(server())
        .post(`/receipts/${scan.receiptId}/approve`)
        .send({ transactionId: bankRow.id }),
    ).expect(201);

    expect(await transactionRow(bankRow.id)).toMatchObject({
      date: '2026-08-30',
      is_verified: true,
    });
  });

  it('marks the scan transaction a duplicate when the receipt documents a bank row', async () => {
    const scan = await insertScan({ amount: 9, date: '2026-09-03', vendor: 'Bank probe' });
    const [bankRow] = await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type,
          workspace_id, amount, debit, currency)
       VALUES ('2026-09-03', 'BANK PROBE', 'card', 'expense', $1, 9, 9, 'EUR')
       RETURNING id`,
      [owner.workspaceId],
    );

    const res = await as(
      request(server())
        .post(`/receipts/${scan.receiptId}/approve`)
        .send({ transactionId: bankRow.id }),
    ).expect(201);

    expect(res.body.transaction.id).toBe(bankRow.id);
    expect(await transactionRow(scan.transactionId)).toMatchObject({
      is_duplicate: true,
      duplicate_of_id: bankRow.id,
    });
    expect(await transactionRow(bankRow.id)).toMatchObject({ is_verified: true });
  });

  it('books a confirmed transaction for a receipt that had none', async () => {
    const [receipt] = await dataSource.query(
      `INSERT INTO receipts
         (user_id, workspace_id, source, subject, sender, received_at, parsed_data, status)
       VALUES ($1, $2, 'gmail', 'mail', 'shop@example.com', now(), $3::jsonb, 'draft')
       RETURNING id`,
      [
        owner.userId,
        owner.workspaceId,
        JSON.stringify({ amount: 6, date: '2026-09-04', vendor: 'Mail probe' }),
      ],
    );

    const res = await as(request(server()).post(`/receipts/${receipt.id}/approve`)).expect(201);

    expect(await transactionRow(res.body.transaction.id)).toMatchObject({
      amount: 6,
      is_verified: true,
    });
  });
});
