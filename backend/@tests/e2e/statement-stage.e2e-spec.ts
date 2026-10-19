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
 * The review-workflow stage lives on the statement row, so a move made through
 * POST /statements/stage is what every device and teammate sees afterwards.
 */
describe('POST /statements/stage (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;
  let outsider: E2eAccount;

  const emails = {
    owner: 'stage-owner@example.com',
    outsider: 'stage-outsider@example.com',
  };

  const server = () => app.getHttpServer();

  const moveStage = (account: E2eAccount, statementIds: string[], stage: string) =>
    request(server())
      .post('/statements/stage')
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', account.workspaceId)
      .send({ statementIds, stage });

  async function insertStatement(account: E2eAccount, name: string): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO statements
         (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash, bank_name, status, currency)
       VALUES ($1, $2, $3::text, '/dev/null', 'csv', 1, md5($3::text), 'other', 'completed', 'USD')
       RETURNING id`,
      [account.userId, account.workspaceId, name],
    );
    return row.id;
  }

  async function insertTransaction(
    account: E2eAccount,
    statementId: string,
    categoryId: string | null,
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO transactions
         (transaction_date, counterparty_name, payment_purpose, transaction_type,
          workspace_id, statement_id, category_id, currency)
       VALUES ('2026-09-01', 'Probe vendor', 'Probe purchase', 'expense', $1, $2, $3, 'USD')`,
      [account.workspaceId, statementId, categoryId],
    );
  }

  async function stageOf(statementId: string): Promise<string> {
    const [row] = await dataSource.query('SELECT stage FROM statements WHERE id = $1', [
      statementId,
    ]);
    return row.stage;
  }

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

    await deleteUserByEmail(dataSource, emails.owner);
    await deleteUserByEmail(dataSource, emails.outsider);
    owner = await registerAccount(app, emails.owner, 'Stage Owner');
    outsider = await registerAccount(app, emails.outsider, 'Stage Outsider');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, emails.owner);
      await deleteUserByEmail(dataSource, emails.outsider);
    }
    await app.close();
  });

  it('starts every statement in submit', async () => {
    const id = await insertStatement(owner, 'fresh.csv');
    expect(await stageOf(id)).toBe('submit');
  });

  it('submits categorised statements and skips the one with an uncategorised transaction', async () => {
    const [category] = await dataSource.query(
      'SELECT id FROM categories WHERE workspace_id = $1 AND is_enabled = true LIMIT 1',
      [owner.workspaceId],
    );
    const ready = await insertStatement(owner, 'ready.csv');
    const blocked = await insertStatement(owner, 'blocked.csv');
    await insertTransaction(owner, ready, category.id);
    await insertTransaction(owner, blocked, category.id);
    await insertTransaction(owner, blocked, null);

    const res = await moveStage(owner, [ready, blocked], 'approve').expect(200);

    expect(res.body.updated).toEqual([ready]);
    expect(res.body.skipped).toEqual([{ id: blocked, code: 'UNCATEGORIZED_TRANSACTIONS' }]);
    expect(await stageOf(ready)).toBe('approve');
    expect(await stageOf(blocked)).toBe('submit');

    const [audit] = await dataSource.query(
      `SELECT diff FROM audit_events WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ready],
    );
    expect(audit.diff).toEqual({ before: { stage: 'submit' }, after: { stage: 'approve' } });
  });

  it('counts a disabled category as missing', async () => {
    const [category] = await dataSource.query(
      `INSERT INTO categories (name, type, user_id, workspace_id, is_enabled)
       VALUES ('Stage probe disabled', 'expense', $1, $2, false)
       RETURNING id`,
      [owner.userId, owner.workspaceId],
    );
    const id = await insertStatement(owner, 'disabled-category.csv');
    await insertTransaction(owner, id, category.id);

    const res = await moveStage(owner, [id], 'approve').expect(200);

    expect(res.body.skipped).toEqual([{ id, code: 'UNCATEGORIZED_TRANSACTIONS' }]);
  });

  it('walks approve → pay → approve → submit and refuses skipping a stage', async () => {
    const id = await insertStatement(owner, 'walk.csv');

    expect((await moveStage(owner, [id], 'pay').expect(200)).body.skipped).toEqual([
      { id, code: 'INVALID_STAGE_TRANSITION' },
    ]);

    await moveStage(owner, [id], 'approve').expect(200);
    await moveStage(owner, [id], 'pay').expect(200);
    expect(await stageOf(id)).toBe('pay');

    expect((await moveStage(owner, [id], 'submit').expect(200)).body.skipped).toEqual([
      { id, code: 'INVALID_STAGE_TRANSITION' },
    ]);

    await moveStage(owner, [id], 'approve').expect(200);
    await moveStage(owner, [id], 'submit').expect(200);
    expect(await stageOf(id)).toBe('submit');
  });

  it('answers a repeated request the same way without a second change', async () => {
    const id = await insertStatement(owner, 'retry.csv');

    await moveStage(owner, [id], 'approve').expect(200);
    const again = await moveStage(owner, [id], 'approve').expect(200);

    expect(again.body).toEqual({ updated: [id], skipped: [] });
    const [{ count }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM audit_events WHERE entity_id = $1',
      [id],
    );
    expect(count).toBe(1);
  });

  it('does not touch statements of another workspace', async () => {
    const foreign = await insertStatement(outsider, 'foreign.csv');

    const res = await moveStage(owner, [foreign], 'approve').expect(200);

    expect(res.body.skipped).toEqual([{ id: foreign, code: 'STATEMENT_NOT_FOUND' }]);
    expect(await stageOf(foreign)).toBe('submit');
  });

  it('rejects an unknown stage and a non-uuid id', async () => {
    const id = await insertStatement(owner, 'validation.csv');
    await moveStage(owner, [id], 'archived').expect(400);
    await moveStage(owner, ['not-a-uuid'], 'approve').expect(400);
    await moveStage(owner, [], 'approve').expect(400);
  });
});
