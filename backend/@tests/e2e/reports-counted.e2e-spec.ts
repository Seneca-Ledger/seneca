import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ReportsService } from '../../src/modules/reports/reports.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A report counts a confirmed row once: a suspected duplicate, a transfer
 * between the user's own accounts, a row still waiting in Review and a row of
 * a trashed statement are all left out. Run against Postgres, since the
 * trash check is raw SQL inside the query.
 */
describe('What a report counts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;
  const email = 'reports-counted@example.com';
  const day = '2026-08-10';

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);

  async function insertStatement(trashed: boolean): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash,
          bank_name, status, currency, deleted_at)
       VALUES ($1, $2, 'bank.csv', '/dev/null', 'csv', 1, md5(random()::text), 'other',
               'completed', 'EUR', CASE WHEN $3 THEN now() ELSE NULL END)
       RETURNING id`,
      [owner.userId, owner.workspaceId, trashed],
    );
    return row.id;
  }

  async function insertExpense(
    statementId: string,
    name: string,
    amount: number,
    currency: string,
    flags: { verified?: boolean; duplicate?: boolean; transfer?: boolean } = {},
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          statement_id, amount, debit, currency, is_verified, is_duplicate, transfer_pair_id)
       VALUES ($1, $2, $3, 'expense', $4, $5, $6, $7, $8, $9, $10,
               CASE WHEN $11 THEN gen_random_uuid() ELSE NULL END)`,
      [
        day,
        name,
        name,
        owner.workspaceId,
        statementId,
        amount,
        amount,
        currency,
        flags.verified ?? true,
        flags.duplicate ?? false,
        flags.transfer ?? false,
      ],
    );
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    await deleteUserByEmail(dataSource, email);
    owner = await registerAccount(app, email, 'Reports Counted Owner');
    // Booked in the workspace currency, so no exchange rate is involved.
    const [{ currency }] = await dataSource.query('SELECT currency FROM workspaces WHERE id = $1', [
      owner.workspaceId,
    ]);

    const active = await insertStatement(false);
    const trashed = await insertStatement(true);
    await insertExpense(active, 'Kept', 10, currency);
    // Two kept rows, so a total built by string concatenation ("010.005.00") shows.
    await insertExpense(active, 'Kept too', 5, currency);
    await insertExpense(active, 'Duplicate', 20, currency, { duplicate: true });
    await insertExpense(active, 'Transfer', 40, currency, { transfer: true });
    await insertExpense(active, 'Unconfirmed', 80, currency, { verified: false });
    await insertExpense(trashed, 'Trashed', 160, currency);
  });

  afterAll(async () => {
    if (dataSource && owner) {
      await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
        owner.workspaceId,
      ]);
      await dataSource.query('DELETE FROM statements WHERE workspace_id = $1', [owner.workspaceId]);
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('the daily report counts the kept rows only, as numbers', async () => {
    const res = await as(request(app.getHttpServer()).get(`/reports/daily?date=${day}`)).expect(
      200,
    );

    expect(res.body.expense).toMatchObject({ totalAmount: 15, transactionCount: 2 });
  });

  it('the daily report without a date opens on the latest counted day', async () => {
    const res = await as(request(app.getHttpServer()).get('/reports/daily')).expect(200);

    expect(res.body.date).toBe(day);
  });

  it('the monthly report counts the kept rows only, as numbers', async () => {
    const res = await as(
      request(app.getHttpServer()).get('/reports/monthly?year=2026&month=8'),
    ).expect(200);

    expect(res.body.comparison.currentPeriod.expense).toBe(15);
  });

  it('the custom report counts the kept rows only, as numbers', async () => {
    const res = await as(
      request(app.getHttpServer())
        .post('/reports/custom')
        .send({ dateFrom: '2026-08-01', dateTo: '2026-08-31' }),
    ).expect(201);

    expect(res.body.summary).toMatchObject({ totalExpense: 15, transactionCount: 2 });
  });

  it('the statements summary counts the kept rows only', async () => {
    const res = await as(
      request(app.getHttpServer()).get('/reports/statements/summary?days=3650'),
    ).expect(200);

    expect(res.body.totals).toMatchObject({ expense: 15, rows: 2 });
  });

  it('template reports load the kept rows only', async () => {
    const reports = app.get(ReportsService);

    const { rows } = await (
      reports as unknown as {
        loadReportRows: (
          workspaceId: string,
          dto: object,
        ) => Promise<{ rows: Array<{ counterparty: string }> }>;
      }
    ).loadReportRows(owner.workspaceId, {
      templateId: 'pnl',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
    });

    expect(rows.map(row => row.counterparty).sort()).toEqual(['Kept', 'Kept too']);
  });

  it('the spend flow counts the kept rows only', async () => {
    const res = await as(
      request(app.getHttpServer()).get('/reports/spend-flow?dateFrom=2026-08-01&dateTo=2026-08-31'),
    ).expect(200);

    expect(res.body.total).toBe(15);
  });

  it("the dashboard's top merchants are the kept rows only", async () => {
    const res = await as(
      request(app.getHttpServer()).get('/dashboard?range=month&date=2026-08-20'),
    ).expect(200);

    const names = (res.body.topMerchants as Array<{ name: string }>).map(row => row.name).sort();
    expect(names).toEqual(['Kept', 'Kept too']);
  });
});
