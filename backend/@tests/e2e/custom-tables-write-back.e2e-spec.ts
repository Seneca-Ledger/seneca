vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CustomTableRowItem, RestoredTableDefault } from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';


/**
 * Cells of a table filled from app data write back to the records they show,
 * through the records' own services; "Restore to default" undoes that. Run
 * against Postgres: the journal, the tax lock and the permission rules are real.
 */
describe('Custom table write-back to app records (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;
  let member: E2eAccount;
  let stranger: E2eAccount;
  const emails = {
    owner: 'ct-write-back-owner@example.com',
    member: 'ct-write-back-member@example.com',
    stranger: 'ct-write-back-stranger@example.com',
  };

  let currency: string;
  /** Two currencies other than the workspace's, so every change really is one. */
  let otherA: string;
  let otherB: string;
  let rentId: string;
  let travelId: string;
  let txId: string;
  let lockedTxId: string;
  let tableId: string;
  /** Column key by source field. */
  let keys: Record<string, string>;
  let rowId: string;
  let lockedRowId: string;

  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>, {
      onExcessProperty: 'ignore',
    })(body);

  const as = (account: E2eAccount, workspaceId = owner.workspaceId) => {
    const server = app.getHttpServer();
    const sign = (req: request.Test) =>
      req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
    return {
      get: (url: string) => sign(request(server).get(url)),
      post: (url: string, body?: object) => sign(request(server).post(url)).send(body ?? {}),
      put: (url: string, body: object) => sign(request(server).put(url)).send(body),
      patch: (url: string, body: object) => sign(request(server).patch(url)).send(body),
    };
  };

  const transaction = async (id: string) => {
    const [row] = await dataSource.query(
      `SELECT transaction_type, amount::float, debit::float, credit::float, currency,
              category_id, category_source
         FROM transactions WHERE id = $1`,
      [id],
    );
    return row;
  };

  const rowsOf = async (table: string, account = owner) => {
    const res = await as(account).get(`/custom-tables/${table}/rows?limit=100`).expect(200);
    return res.body.items as Array<{ id: string; sourceKey: string | null; data: Record<string, unknown> }>;
  };

  const keysOf = async (table: string) => {
    const res = await as(owner).get(`/custom-tables/${table}`).expect(200);
    return Object.fromEntries(
      (res.body.columns as Array<{ key: string; config: { source?: { field?: string } } | null }>)
        .filter(column => column.config?.source?.field)
        .map(column => [column.config?.source?.field as string, column.key]),
    );
  };

  const editCell = (field: string, value: unknown, row = rowId, account = owner) =>
    as(account).patch(`/custom-tables/${tableId}/rows/${row}`, { data: { [keys[field]]: value } });

  async function insertTransaction(name: string, flags: { taxLocked?: boolean } = {}): Promise<string> {
    const [statement] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash,
          bank_name, status, currency)
       VALUES ($1, $2, 'bank.csv', '/dev/null', 'csv', 1, md5(random()::text), 'other',
               'completed', $3)
       RETURNING id`,
      [owner.userId, owner.workspaceId, currency],
    );
    const [row] = await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          statement_id, amount, debit, currency, is_verified, category_id, tax_locked, tax_amount)
       VALUES ('2026-08-10', $1, $7, 'expense', $2, $3, 650, 650, $4, true, $5, $6,
               CASE WHEN $6 THEN 0 ELSE NULL END)
       RETURNING id`,
      [name, owner.workspaceId, statement.id, currency, rentId, flags.taxLocked ?? false, name],
    );
    return row.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    for (const email of Object.values(emails)) {
      await deleteUserByEmail(dataSource, email);
    }
    owner = await registerAccount(app, emails.owner, 'Write Back Owner');
    member = await registerAccount(app, emails.member, 'Write Back Member');
    stranger = await registerAccount(app, emails.stranger, 'Write Back Stranger');
    [{ currency }] = await dataSource.query('SELECT currency FROM workspaces WHERE id = $1', [
      owner.workspaceId,
    ]);
    [otherA, otherB] = ['USD', 'GBP', 'CHF'].filter(code => code !== currency);

    rentId = (await as(owner).post('/categories', { name: 'WB Rent', type: 'expense' }).expect(201))
      .body.id;
    travelId = (
      await as(owner).post('/categories', { name: 'WB Travel', type: 'expense' }).expect(201)
    ).body.id;

    txId = await insertTransaction('WeWork');
    lockedTxId = await insertTransaction('Locked GmbH', { taxLocked: true });

    // A member who may edit tables but not statements.
    await dataSource.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
       VALUES ($1, $2, 'member', $3)`,
      [owner.workspaceId, member.userId, JSON.stringify({ canEditCustomTables: true, canEditStatements: false })],
    );

    tableId = (
      await as(owner).post('/custom-tables/from-source', { kind: 'transactions', name: 'WB' }).expect(201)
    ).body.tableId;
    keys = await keysOf(tableId);
    const rows = await rowsOf(tableId);
    rowId = rows.find(row => row.sourceKey === txId)?.id as string;
    lockedRowId = rows.find(row => row.sourceKey === lockedTxId)?.id as string;
  });

  afterAll(async () => {
    if (dataSource && owner) {
      await dataSource.query('DELETE FROM custom_tables WHERE workspace_id = $1', [owner.workspaceId]);
      await dataSource.query('DELETE FROM invoices WHERE workspace_id = $1', [owner.workspaceId]);
      await dataSource.query('DELETE FROM clients WHERE workspace_id = $1', [owner.workspaceId]);
      await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [owner.workspaceId]);
      await dataSource.query('DELETE FROM statements WHERE workspace_id = $1', [owner.workspaceId]);
      await dataSource.query('DELETE FROM workspace_members WHERE user_id = $1', [member.userId]);
    }
    if (dataSource && stranger) {
      await dataSource.query('DELETE FROM custom_tables WHERE workspace_id = $1', [stranger.workspaceId]);
    }
    for (const email of Object.values(emails)) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('the table shows both transactions with their source keys', () => {
    expect(rowId).toBeTruthy();
    expect(lockedRowId).toBeTruthy();
  });

  it('a category picked in the table becomes the transaction category, sticky as manual', async () => {
    const res = await editCell('category', 'WB Travel').expect(200);
    matches(CustomTableRowItem, res.body);
    expect(res.body.data[keys.category]).toBe('WB Travel');
    const tx = await transaction(txId);
    expect(tx.category_id).toBe(travelId);
    expect(tx.category_source).toBe('manual');
  });

  it('flipping the type moves the amount to the credit side and the reply flips its sign', async () => {
    const res = await editCell('type', 'income').expect(200);
    expect(res.body.data[keys.type]).toBe('income');
    expect(res.body.data[keys.amount]).toBe(650);
    const tx = await transaction(txId);
    expect(tx).toMatchObject({ transaction_type: 'income', credit: 650, debit: null, amount: 650 });
  });

  it('a negative amount goes to the debit side', async () => {
    const res = await editCell('amount', -700).expect(200);
    expect(res.body.data[keys.type]).toBe('expense');
    const tx = await transaction(txId);
    expect(tx).toMatchObject({ transaction_type: 'expense', debit: 700, credit: null, amount: 700 });
  });

  it('refuses the statement file name and changes nothing', async () => {
    const before = (await rowsOf(tableId)).find(row => row.id === rowId)?.data;
    const res = await editCell('statement', 'other.csv').expect(400);
    expect(res.body.error.code).toBe('SOURCE_FIELD_READ_ONLY');
    expect((await rowsOf(tableId)).find(row => row.id === rowId)?.data).toEqual(before);
  });

  it('refuses an unknown category without creating one', async () => {
    const res = await editCell('category', 'Does Not Exist').expect(400);
    expect(res.body.error.code).toBe('CATEGORY_NOT_FOUND');
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM categories WHERE workspace_id = $1 AND name = 'Does Not Exist'`,
      [owner.workspaceId],
    );
    expect(count).toBe(0);
  });

  it('a tax-locked transaction refuses the edit and the cell keeps its value', async () => {
    const res = await editCell('currency', otherA, lockedRowId).expect(400);
    expect(JSON.stringify(res.body)).toMatch(/tax|lock/i);
    expect((await transaction(lockedTxId)).currency).toBe(currency);
    const row = (await rowsOf(tableId)).find(item => item.id === lockedRowId);
    expect(row?.data[keys.currency]).toBe(currency);
  });

  it('a member without the statements permission cannot change transactions through a table', async () => {
    const res = await editCell('currency', otherA, rowId, member).expect(403);
    expect(res.body.error.code).toBe('SOURCE_EDIT_FORBIDDEN');
    expect((await transaction(txId)).currency).toBe(currency);
  });

  it("another workspace's table rows are out of reach", async () => {
    const res = await as(stranger, stranger.workspaceId)
      .patch(`/custom-tables/${tableId}/rows/${rowId}`, { data: { [keys.currency]: otherA } });
    expect([403, 404]).toContain(res.status);
    expect((await transaction(txId)).currency).toBe(currency);
  });

  it('a plain column of the same table still saves as a table cell only', async () => {
    const column = await as(owner)
      .post(`/custom-tables/${tableId}/columns`, { title: 'WB note', type: 'text' })
      .expect(201);
    const res = await as(owner)
      .patch(`/custom-tables/${tableId}/rows/${rowId}`, { data: { [column.body.key]: 'checked' } })
      .expect(200);
    expect(res.body.data[column.body.key]).toBe('checked');
  });

  it("a scanned receipt's document follows the new category; a bank statement does not", async () => {
    const [scan] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash,
          bank_name, status, currency, category_id, parsing_details)
       VALUES ($1, $2, 'grocery-receipt.webp', '/dev/null', 'image', 1, md5(random()::text),
               'other', 'completed', $3, $4, '{"detectedBy":"receipt-scan"}'::jsonb)
       RETURNING id`,
      [owner.userId, owner.workspaceId, currency, rentId],
    );
    const [scanTx] = await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          statement_id, amount, debit, currency, is_verified, category_id)
       VALUES ('2026-08-11', 'Grocer', 'Groceries', 'expense', $1, $2, 12, 12, $3, true, $4)
       RETURNING id`,
      [owner.workspaceId, scan.id, currency, rentId],
    );
    await as(owner).post(`/custom-tables/${tableId}/refresh-from-source`).expect(201);
    const scanRow = (await rowsOf(tableId)).find(row => row.sourceKey === scanTx.id);
    await editCell('category', 'WB Travel', scanRow?.id).expect(200);

    const [doc] = await dataSource.query('SELECT category_id FROM statements WHERE id = $1', [
      scan.id,
    ]);
    expect(doc.category_id).toBe(travelId);
    // The bank statement of the first transaction keeps its own (empty) category.
    const [bank] = await dataSource.query(
      'SELECT s.category_id FROM statements s JOIN transactions t ON t.statement_id = s.id WHERE t.id = $1',
      [txId],
    );
    expect(bank.category_id).toBeNull();

    // Put back, so the restore below finds this record as the table left it.
    await editCell('category', 'WB Rent', scanRow?.id).expect(200);
    const [after] = await dataSource.query('SELECT category_id FROM statements WHERE id = $1', [
      scan.id,
    ]);
    expect(after.category_id).toBe(rentId);
  });

  describe('restore to default', () => {
    it('undoes the table changes, leaves fields changed in the app since, and rebuilds the table', async () => {
      await editCell('currency', otherA).expect(200);
      // Someone changes the currency again on the transaction itself.
      await as(owner).put(`/transactions/${txId}`, { currency: otherB }).expect(200);

      const res = await as(owner).post(`/custom-tables/${tableId}/restore-default`).expect(201);
      matches(RestoredTableDefault, res.body);
      expect(res.body).toMatchObject({ tableId, skippedChanged: 1, failed: [] });
      expect(res.body.reverted).toBeGreaterThanOrEqual(2);

      const tx = await transaction(txId);
      expect(tx.category_id).toBe(rentId);
      expect(tx).toMatchObject({ transaction_type: 'expense', amount: 650, debit: 650 });
      expect(tx.currency).toBe(otherB);

      const table = await as(owner).get(`/custom-tables/${tableId}`).expect(200);
      const titles = (table.body.columns as Array<{ title: string }>).map(column => column.title);
      expect(titles).not.toContain('WB note');
      const row = (await rowsOf(tableId)).find(item => item.id === rowId);
      expect(row?.data[keys.category]).toBe('WB Rent');
      expect(row?.data[keys.currency]).toBe(otherB);
    });

    it('a second restore has nothing left to undo', async () => {
      const res = await as(owner).post(`/custom-tables/${tableId}/restore-default`).expect(201);
      expect(res.body).toMatchObject({ reverted: 0, skippedChanged: 0, failed: [] });
    });

    it('a table built by hand has nothing to restore', async () => {
      const manual = await as(owner).post('/custom-tables', { name: 'WB manual' }).expect(201);
      const res = await as(owner).post(`/custom-tables/${manual.body.id}/restore-default`).expect(400);
      expect(res.body.error.code).toBe('TABLE_NOT_LINKED_TO_SOURCE');
    });
  });

  describe('invoices', () => {
    let invoiceId: string;
    let invoiceTable: string;
    let invoiceRow: string;
    let invoiceKeys: Record<string, string>;

    beforeAll(async () => {
      const [client] = await dataSource.query(
        `INSERT INTO clients (workspace_id, name, currency) VALUES ($1, 'WB Client', $2) RETURNING id`,
        [owner.workspaceId, currency],
      );
      const [invoice] = await dataSource.query(
        `INSERT INTO invoices (workspace_id, client_id, issue_date, due_date, currency, status)
         VALUES ($1, $2, '2026-08-01', '2026-08-15', $3, 'draft') RETURNING id`,
        [owner.workspaceId, client.id, currency],
      );
      invoiceId = invoice.id;
      invoiceTable = (
        await as(owner).post('/custom-tables/from-source', { kind: 'invoices', name: 'WB invoices' }).expect(201)
      ).body.tableId;
      invoiceKeys = await keysOf(invoiceTable);
      invoiceRow = (await rowsOf(invoiceTable)).find(row => row.sourceKey === invoiceId)?.id as string;
    });

    it('writes a field of a draft invoice', async () => {
      await as(owner)
        .patch(`/custom-tables/${invoiceTable}/rows/${invoiceRow}`, {
          data: { [invoiceKeys.notes]: 'Thanks!' },
        })
        .expect(200);
      const [row] = await dataSource.query('SELECT notes FROM invoices WHERE id = $1', [invoiceId]);
      expect(row.notes).toBe('Thanks!');
    });

    it('refuses a sent invoice, as the invoice page does', async () => {
      await dataSource.query(`UPDATE invoices SET status = 'sent' WHERE id = $1`, [invoiceId]);
      const res = await as(owner)
        .patch(`/custom-tables/${invoiceTable}/rows/${invoiceRow}`, {
          data: { [invoiceKeys.notes]: 'Changed after sending' },
        })
        .expect(409);
      expect(res.body.error.code).toBe('INVOICE_NOT_DRAFT');
      const [row] = await dataSource.query('SELECT notes FROM invoices WHERE id = $1', [invoiceId]);
      expect(row.notes).toBe('Thanks!');
    });

    it('refuses the computed total', async () => {
      const res = await as(owner)
        .patch(`/custom-tables/${invoiceTable}/rows/${invoiceRow}`, {
          data: { [invoiceKeys.total]: 1 },
        })
        .expect(400);
      expect(res.body.error.code).toBe('SOURCE_FIELD_READ_ONLY');
    });
  });
});
