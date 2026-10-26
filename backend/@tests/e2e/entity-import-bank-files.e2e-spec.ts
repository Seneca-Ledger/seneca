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
 * A bank export brought in through the import wizard: the rows of a CSV or
 * XLSX file (read in the browser) become one statement, the column roles are
 * remembered for the next file with the same header row, and importing the
 * same rows again creates nothing.
 */
describe('Bank file import (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `bank-file-owner-${stamp}@example.com`,
    viewer: `bank-file-viewer-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let viewer: E2eAccount;

  // A US export: month-first dates, money out and money in in separate columns.
  const headers = ['Date', 'Payee', 'Debit', 'Credit'];
  const rows = [
    ['01/02/2026', 'ACME Store - Wireless Buds', '19.99', ''],
    ['01/13/2026', 'Employer One', '', '1500.00'],
    ['01/20/2026', 'Corner Cafe', '4.50', ''],
  ];
  const mapping = { date: 0, merchant: 1, amount: 2, credit: 3 };

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();
  const runImport = (dryRun = false) =>
    as(owner, request(server()).post('/entity-imports')).send({
      target: 'transactions',
      mapping,
      rows,
      fileName: 'bank-export.csv',
      dryRun,
      options: { currency: 'USD', categorize: false },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    viewer = await registerAccount(app, emails.viewer, 'Member Two');
    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: viewer.email, role: 'viewer' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${viewer.token}`)
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('suggests the separate debit and credit columns', async () => {
    const res = await as(owner, request(server()).post('/entity-imports/suggest'))
      .send({ headers, samples: rows })
      .expect(201);
    expect(res.body.target).toBe('transactions');
    const roles = Object.fromEntries(
      res.body.columns.map((column: { index: number; role: string | null }) => [
        column.index,
        column.role,
      ]),
    );
    expect(roles).toEqual({ 0: 'date', 1: 'merchant', 2: 'amount', 3: 'credit' });
  });

  it('imports the rows as one statement, money in as income, dates month-first', async () => {
    const preview = await runImport(true).expect(201);
    expect(preview.body.counts).toMatchObject({ created: 3, errors: 0 });

    const res = await runImport().expect(201);
    expect(res.body.counts).toMatchObject({ created: 3, skipped: 0, errors: 0 });
    expect(res.body.createdIds).toHaveLength(1);

    const saved: Array<{ date: string; type: string; debit: string | null; credit: string | null }> =
      await dataSource.query(
        `SELECT to_char(transaction_date, 'YYYY-MM-DD') AS date, transaction_type AS type, debit, credit
           FROM transactions WHERE statement_id = $1 ORDER BY transaction_date`,
        [res.body.createdIds[0]],
      );
    expect(saved.map(row => [row.date, row.type])).toEqual([
      ['2026-01-02', 'expense'],
      ['2026-01-13', 'income'],
      ['2026-01-20', 'expense'],
    ]);
    expect(Number(saved[1].credit)).toBe(1500);
  });

  it('creates nothing when the same rows are imported again', async () => {
    const preview = await runImport(true).expect(201);
    expect(preview.body.counts).toMatchObject({ created: 0, skipped: 3 });
    expect(
      preview.body.rows.every((row: { reason?: string }) => row.reason === 'duplicate'),
    ).toBe(true);

    const res = await runImport().expect(400);
    expect(res.body.error.code).toBe('IMPORT_NO_VALID_ROWS');
    const [{ count }] = await dataSource.query(
      'SELECT count(*)::int AS count FROM statements WHERE workspace_id = $1 AND file_name LIKE $2',
      [owner.workspaceId, 'bank-export%'],
    );
    expect(count).toBe(1);
  });

  it('remembers the mapping for the header row and finds it again', async () => {
    const empty = await as(owner, request(server()).post('/entity-imports/mapping-profiles/match'))
      .send({ target: 'transactions', headers })
      .expect(200);
    expect(empty.body.profile).toBeNull();

    const saved = await as(owner, request(server()).put('/entity-imports/mapping-profiles'))
      .send({ target: 'transactions', headers, mapping: { ...mapping, notAField: 1 } })
      .expect(200);
    expect(saved.body).toMatchObject({ target: 'transactions', mapping });

    // Saving again for the same header row replaces the mapping, it does not add a row.
    await as(owner, request(server()).put('/entity-imports/mapping-profiles'))
      .send({ target: 'transactions', headers, mapping })
      .expect(200);
    const [{ count }] = await dataSource.query(
      'SELECT count(*)::int AS count FROM import_mapping_profiles WHERE workspace_id = $1',
      [owner.workspaceId],
    );
    expect(count).toBe(1);

    // The next export from the same bank: same titles, other case and spacing.
    const found = await as(owner, request(server()).post('/entity-imports/mapping-profiles/match'))
      .send({ target: 'transactions', headers: [' date', 'PAYEE', 'Debit ', 'credit', ''] })
      .expect(200);
    expect(found.body.profile).toEqual({ id: saved.body.id, target: 'transactions', mapping });

    // Another target keeps its own mappings.
    const otherTarget = await as(
      owner,
      request(server()).post('/entity-imports/mapping-profiles/match'),
    )
      .send({ target: 'payables', headers })
      .expect(200);
    expect(otherTarget.body.profile).toBeNull();
  });

  it('lets a viewer read the mapping but not change it', async () => {
    await as(viewer, request(server()).post('/entity-imports/mapping-profiles/match'))
      .send({ target: 'transactions', headers })
      .expect(200);
    await as(viewer, request(server()).put('/entity-imports/mapping-profiles'))
      .send({ target: 'transactions', headers, mapping })
      .expect(403);
  });

  it('forgets the mapping, and forgetting it twice is not an error', async () => {
    const found = await as(owner, request(server()).post('/entity-imports/mapping-profiles/match'))
      .send({ target: 'transactions', headers })
      .expect(200);
    const url = `/entity-imports/mapping-profiles/${found.body.profile.id}`;
    await as(owner, request(server()).delete(url)).expect(200, { ok: true });
    await as(owner, request(server()).delete(url)).expect(200, { ok: true });
    const gone = await as(owner, request(server()).post('/entity-imports/mapping-profiles/match'))
      .send({ target: 'transactions', headers })
      .expect(200);
    expect(gone.body.profile).toBeNull();
  });
});
