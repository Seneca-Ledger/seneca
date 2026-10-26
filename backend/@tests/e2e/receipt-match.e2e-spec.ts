vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource, IsNull, Not } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A parsed receipt finds the bank row it documents; approving attaches to it
 * instead of booking the expense twice; its line items split that row by
 * category. A receipt with no plausible row still books a new transaction.
 */
describe('Receipt ↔ transaction (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const email = `receipt-match-${stamp}@example.com`;
  let owner: E2eAccount;
  let categoryIds: string[];
  let bankRowId: string;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const transactions = () => dataSource.getRepository(Transaction);

  async function insertReceipt(parsed: Record<string, unknown>): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO receipts
         (user_id, workspace_id, source, subject, sender, received_at, parsed_data, status)
       VALUES ($1, $2, 'scan', 'probe.jpg', 'scan', now(), $3::jsonb, 'draft')
       RETURNING id`,
      [owner.userId, owner.workspaceId, JSON.stringify(parsed)],
    );
    return row.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Receipt Match Owner');
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    categoryIds = categories.body.map((category: { id: string }) => category.id);

    // The bank row: an imported card charge for the same shop.
    const statement = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', '80')
      .field('currency', 'KZT')
      .field('merchant', 'TARGET STORE 1234')
      .field('categoryId', categoryIds[0])
      .field('date', '2026-07-10')
      .expect(201);
    const listed = await as(
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    bankRowId = listed.body.data[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('offers the bank row as the match and approving attaches to it', async () => {
    const receiptId = await insertReceipt({
      amount: 80,
      currency: 'KZT',
      date: '2026-07-11',
      vendor: 'Target',
      transactionType: 'expense',
      lineItems: [
        { description: 'Milk 1L', amount: 20 },
        { description: 'Bread', amount: 12 },
        { description: 'Shampoo', amount: 48 },
      ],
    });

    const matches = await as(
      request(server()).get(`/receipts/${receiptId}/transaction-matches`),
    ).expect(200);
    expect(matches.body.suggestion).toMatchObject({ transactionIds: [bankRowId], kind: 'single' });
    expect(matches.body.data[0].id).toBe(bankRowId);

    const before = await transactions().count({ where: { workspaceId: owner.workspaceId } });
    const approved = await as(request(server()).post(`/receipts/${receiptId}/approve`))
      .send({})
      .expect(201);
    expect(approved.body.attached).toBe(true);
    expect(approved.body.transaction.id).toBe(bankRowId);
    const after = await transactions().count({ where: { workspaceId: owner.workspaceId } });
    expect(after).toBe(before);

    const [receipt] = await dataSource.query(
      'SELECT transaction_id, status FROM receipts WHERE id = $1',
      [receiptId],
    );
    expect(receipt.transaction_id).toBe(bankRowId);
    expect(receipt.status).toBe('approved');

    // The same receipt is now the one documenting that row.
    const suggestion = await as(request(server()).get(`/receipts/${receiptId}/split-suggestion`)).expect(
      200,
    );
    expect(suggestion.body.transactionId).toBe(bankRowId);
    expect(suggestion.body.total).toBe(80);
    expect(suggestion.body.items).toHaveLength(3);
    expect(
      suggestion.body.parts.reduce((sum: number, part: { amount: number }) => sum + part.amount, 0),
    ).toBeCloseTo(80, 2);

    // A preview that is not this receipt's lines is refused and books nothing.
    await as(request(server()).post(`/receipts/${receiptId}/split`))
      .send({ items: [{ description: 'Milk 1L', amount: 99, categoryId: categoryIds[0] }] })
      .expect(400);

    // The categories the user settled on in the preview are the ones booked.
    await as(request(server()).post(`/receipts/${receiptId}/split`))
      .send({
        items: [
          { description: 'Milk 1L', amount: 20, categoryId: categoryIds[1] },
          { description: 'Bread', amount: 12, categoryId: categoryIds[1] },
          { description: 'Shampoo', amount: 48, categoryId: categoryIds[2] },
        ],
      })
      .expect(201);
    const parts = await transactions().find({
      where: { workspaceId: owner.workspaceId, splitGroupId: Not(IsNull()) },
      order: { splitIndex: 'ASC' },
    });
    expect(parts.map(part => [part.categoryId, Number(part.amount)])).toEqual([
      [categoryIds[2], 48],
      [categoryIds[1], 32],
    ]);

    const again = await as(
      request(server()).get(`/receipts/${receiptId}/split-suggestion`),
    ).expect(200);
    expect(again.body.alreadySplit).toBe(true);

    // Undo puts the bank row back whole, still documented by the receipt.
    await as(request(server()).post(`/transactions/${bankRowId}/unsplit`)).expect(200);
    const restored = await transactions().findOneByOrFail({ id: bankRowId });
    expect(Number(restored.amount)).toBe(80);
    expect(restored.splitGroupId).toBeNull();
    const [stillLinked] = await dataSource.query(
      'SELECT transaction_id FROM receipts WHERE id = $1',
      [receiptId],
    );
    expect(stillLinked.transaction_id).toBe(bankRowId);
  });

  it('a second receipt for the same row is not offered that row', async () => {
    const receiptId = await insertReceipt({
      amount: 80,
      currency: 'KZT',
      date: '2026-07-11',
      vendor: 'Target',
      transactionType: 'expense',
    });
    const matches = await as(
      request(server()).get(`/receipts/${receiptId}/transaction-matches`),
    ).expect(200);
    expect(matches.body.suggestion).toBeNull();
    expect(matches.body.data.map((row: { id: string }) => row.id)).not.toContain(bankRowId);
  });

  it('books a new transaction when told so, and when nothing matches', async () => {
    const receiptId = await insertReceipt({
      amount: 15,
      currency: 'KZT',
      date: '2026-07-12',
      vendor: 'Kiosk',
      transactionType: 'expense',
    });
    const before = await transactions().count({ where: { workspaceId: owner.workspaceId } });
    const approved = await as(request(server()).post(`/receipts/${receiptId}/approve`))
      .send({ transactionId: null })
      .expect(201);
    expect(approved.body.attached).toBe(false);
    const after = await transactions().count({ where: { workspaceId: owner.workspaceId } });
    expect(after).toBe(before + 1);
  });

  it('refuses to attach to a row another receipt already documents', async () => {
    const receiptId = await insertReceipt({
      amount: 80,
      currency: 'KZT',
      date: '2026-07-11',
      vendor: 'Target',
      transactionType: 'expense',
    });
    const res = await as(request(server()).post(`/receipts/${receiptId}/approve`)).send({
      transactionId: bankRowId,
    });
    if (res.status !== 409) {
      throw new Error(`expected 409, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    await as(request(server()).post(`/receipts/${receiptId}/approve`))
      .send({ transactionId: 'not-a-uuid' })
      .expect(400);
  });

  it("takes the receipt's category over the import's guess, never over a person's pick", async () => {
    const insertBankRow = async (merchant: string, source: string) => {
      const [row] = await dataSource.query(
        `INSERT INTO transactions
           (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
            amount, debit, currency, is_verified, category_id, category_source)
         VALUES ('2026-08-01', $1, $5, 'expense', $2, 15, 15, 'KZT', false, $3, $4)
         RETURNING id`,
        [merchant, owner.workspaceId, categoryIds[0], source, merchant],
      );
      return row.id as string;
    };
    const guessed = await insertBankRow('RAILWAY 001', 'ai');
    const picked = await insertBankRow('RAILWAY 002', 'manual');
    const receiptFor = () =>
      insertReceipt({
        amount: 15,
        currency: 'KZT',
        date: '2026-08-01',
        vendor: 'Railway Corporation',
        transactionType: 'expense',
        categoryId: categoryIds[1],
        categorySource: 'history',
        categoryReason: 'Railway Corporation',
      });

    for (const transactionId of [guessed, picked]) {
      await as(request(server()).post(`/receipts/${await receiptFor()}/approve`))
        .send({ transactionId })
        .expect(201);
    }

    const rows = await dataSource.query(
      'SELECT id, category_id, category_source, is_verified FROM transactions WHERE id = ANY($1)',
      [[guessed, picked]],
    );
    const byId = Object.fromEntries(rows.map((row: { id: string }) => [row.id, row]));
    expect(byId[guessed]).toMatchObject({
      category_id: categoryIds[1],
      category_source: 'history',
      is_verified: true,
    });
    expect(byId[picked]).toMatchObject({
      category_id: categoryIds[0],
      category_source: 'manual',
      is_verified: true,
    });
  });
});
