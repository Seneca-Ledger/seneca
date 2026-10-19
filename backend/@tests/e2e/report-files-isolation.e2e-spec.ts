import * as fs from 'node:fs';
import * as path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { resolveUploadsDir } from '../../src/common/utils/uploads.util';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A generated report is a file on disk that the History tab serves again
 * later. Two workspaces generating the same template for the same period
 * used to share one file name, so the later run overwrote the earlier one and
 * a history download handed one workspace the other's ledger.
 */
describe('Generated report files stay in their workspace (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let alpha: E2eAccount;
  let bravo: E2eAccount;
  const emails = ['report-files-alpha@example.com', 'report-files-bravo@example.com'];
  const day = '2026-07-14';
  const range = { dateFrom: '2026-07-01', dateTo: '2026-07-31' };
  const sharedFile = path.join(resolveUploadsDir(), 'reports', `e2e-shared-${Date.now()}.csv`);

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);

  async function seedExpense(account: E2eAccount, merchant: string): Promise<void> {
    const [{ currency }] = await dataSource.query('SELECT currency FROM workspaces WHERE id = $1', [
      account.workspaceId,
    ]);
    const [statement] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash,
          bank_name, status, currency)
       VALUES ($1, $2, 'bank.csv', '/dev/null', 'csv', 1, md5(random()::text), 'other',
               'completed', $3)
       RETURNING id`,
      [account.userId, account.workspaceId, currency],
    );
    await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type, workspace_id,
          statement_id, amount, debit, currency, is_verified)
       VALUES ($1, $2, $3, 'expense', $4, $5, 25, 25, $6, true)`,
      [day, merchant, merchant, account.workspaceId, statement.id, currency],
    );
  }

  const binary = (res: request.Response, done: (err: Error | null, body: Buffer) => void) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => done(null, Buffer.concat(chunks)));
  };

  async function generate(account: E2eAccount): Promise<void> {
    await as(account, request(app.getHttpServer()).post('/reports/generate'))
      .send({ templateId: 'transaction-register', format: 'csv', ...range })
      .buffer(true)
      .parse(binary)
      .expect(201);
  }

  async function latestHistoryId(account: E2eAccount): Promise<string> {
    const res = await as(account, request(app.getHttpServer()).get('/reports/history')).expect(
      200,
    );
    return res.body[0].id;
  }

  async function download(account: E2eAccount, reportId: string): Promise<request.Response> {
    return as(
      account,
      request(app.getHttpServer()).get(`/reports/history/${reportId}/download`),
    )
      .buffer(true)
      .parse(binary);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    for (const email of emails) {
      await deleteUserByEmail(dataSource, email);
    }
    alpha = await registerAccount(app, emails[0], 'Report Files Alpha');
    bravo = await registerAccount(app, emails[1], 'Report Files Bravo');
    await seedExpense(alpha, 'Alpha Only Merchant');
    await seedExpense(bravo, 'Bravo Only Merchant');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const account of [alpha, bravo].filter(Boolean)) {
        const rows: Array<{ file_path: string }> = await dataSource.query(
          'SELECT file_path FROM report_history WHERE workspace_id = $1',
          [account.workspaceId],
        );
        for (const row of rows) {
          fs.rmSync(row.file_path, { force: true });
        }
        await dataSource.query('DELETE FROM report_history WHERE workspace_id = $1', [
          account.workspaceId,
        ]);
        await dataSource.query('DELETE FROM transactions WHERE workspace_id = $1', [
          account.workspaceId,
        ]);
        await dataSource.query('DELETE FROM statements WHERE workspace_id = $1', [
          account.workspaceId,
        ]);
        fs.rmSync(path.join(resolveUploadsDir(), 'reports', account.workspaceId), {
          recursive: true,
          force: true,
        });
      }
      for (const email of emails) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    fs.rmSync(sharedFile, { force: true });
    await app.close();
  });

  it('each workspace downloads its own report after both generated the same one', async () => {
    await generate(alpha);
    const alphaReport = await latestHistoryId(alpha);
    await generate(bravo);
    const bravoReport = await latestHistoryId(bravo);

    const alphaFile = await download(alpha, alphaReport);
    expect(alphaFile.status).toBe(200);
    expect(alphaFile.headers['content-disposition']).toContain(
      `transaction-register-${range.dateFrom}-${range.dateTo}.csv`,
    );
    expect(alphaFile.body.toString('utf-8')).toContain('Alpha Only Merchant');
    expect(alphaFile.body.toString('utf-8')).not.toContain('Bravo Only Merchant');

    const bravoFile = await download(bravo, bravoReport);
    expect(bravoFile.status).toBe(200);
    expect(bravoFile.body.toString('utf-8')).toContain('Bravo Only Merchant');
    expect(bravoFile.body.toString('utf-8')).not.toContain('Alpha Only Merchant');
  });

  it('refuses a history row whose file lies outside the workspace directory', async () => {
    // A row written before reports moved into per-workspace directories: its
    // shared path may hold whatever another workspace generated last.
    fs.mkdirSync(path.dirname(sharedFile), { recursive: true });
    fs.writeFileSync(sharedFile, 'Alpha Only Merchant');
    const [row] = await dataSource.query(
      `INSERT INTO report_history
         (workspace_id, user_id, template_id, template_name, date_from, date_to, format,
          file_name, file_path, file_size)
       VALUES ($1, $2, 'transaction-register', 'Transaction Register', $3, $4, 'csv',
               'old.csv', $5, 19)
       RETURNING id`,
      [bravo.workspaceId, bravo.userId, range.dateFrom, range.dateTo, sharedFile],
    );

    const res = await download(bravo, row.id);

    expect(res.status).toBe(404);
    expect(res.body.toString('utf-8')).not.toContain('Alpha Only Merchant');
  });
});
