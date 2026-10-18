import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BudgetList,
  CustomTableDetail,
  CustomTableList,
  DashboardResponse,
  GoalList,
  MonthGoalList,
  NetWorthResponse,
  ReviewInboxCounts,
  StatementListPage,
  StoicBalance,
  SubscriptionList,
  WorkspaceSummary,
} from '../../src/contracts';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/** Tables the demo fills; each row in them must belong to the demo workspace. */
const DEMO_TABLES = [
  'wallets',
  'statements',
  'transactions',
  'budgets',
  'subscriptions',
  'subscription_charges',
  'goals',
  'goal_contributions',
  'balance_snapshots',
  'custom_tables',
];

/**
 * `POST /workspaces/demo`: one demo per user, filled with a year of sample
 * data that every page reads through its own contract, the same data for
 * the same anchor, and gone with the workspace when it is deleted.
 */
describe('Demo workspace (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = [`demo-a-${stamp}@example.com`, `demo-b-${stamp}@example.com`];
  let a: E2eAccount;
  let b: E2eAccount;
  let demoId: string;
  const anchor = '2026-09-28';
  const previousAnchor = process.env.DEMO_DATA_ANCHOR_DATE;

  const server = () => app.getHttpServer();
  const createDemo = (account: E2eAccount, name = 'Demo') =>
    request(server())
      .post('/workspaces/demo')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ name });
  const read = (account: E2eAccount, workspaceId: string, url: string) =>
    request(server())
      .get(url)
      .set('Authorization', `Bearer ${account.token}`)
      .set('x-workspace-id', workspaceId)
      .expect(200);
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>, {
      onExcessProperty: 'ignore',
    })(body);
  /** The demo's rows in a stable order, without ids or creation times. */
  const contentOf = (workspaceId: string) =>
    dataSource.query(
      `SELECT t.transaction_date::text, t.counterparty_name, t.payment_purpose, t.amount::text,
              t.transaction_type, t.is_verified, c.name AS category, w.name AS wallet
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         JOIN wallets w ON w.id = t.wallet_id
        WHERE t.workspace_id = $1
        ORDER BY 1, 8, 2, 4, 3`,
      [workspaceId],
    );

  beforeAll(async () => {
    process.env.DEMO_DATA_ANCHOR_DATE = anchor;
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    a = await registerAccount(app, emails[0], 'Demo A');
    b = await registerAccount(app, emails[1], 'Demo B');
  });

  afterAll(async () => {
    if (previousAnchor === undefined) delete process.env.DEMO_DATA_ANCHOR_DATE;
    else process.env.DEMO_DATA_ANCHOR_DATE = previousAnchor;
    if (dataSource) {
      for (const email of emails) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('creates the demo as an ordinary workspace the caller owns', async () => {
    const res = await createDemo(a, 'Демо').expect(201);
    matches(WorkspaceSummary, res.body);
    expect(res.body).toMatchObject({ name: 'Демо', currency: 'EUR', memberRole: 'owner' });
    demoId = res.body.id;

    const [marked] = await dataSource.query(
      'SELECT demo_of_user_id, owner_id FROM workspaces WHERE id = $1',
      [demoId],
    );
    expect(marked).toEqual({ demo_of_user_id: a.userId, owner_id: a.userId });
    const list = await read(a, a.workspaceId, '/workspaces');
    expect(list.body.map((workspace: { id: string }) => workspace.id)).toContain(demoId);
  });

  it('answers the same workspace when asked again, also when asked twice at once', async () => {
    const again = await createDemo(a).expect(200);
    matches(WorkspaceSummary, again.body);
    expect(again.body.id).toBe(demoId);

    const [first, second] = await Promise.all([createDemo(b), createDemo(b)]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.id).toBe(second.body.id);
    expect(first.body.id).not.toBe(demoId);
    const owned = await dataSource.query('SELECT id FROM workspaces WHERE owner_id = $1', [
      b.userId,
    ]);
    // Their own workspace and one demo: the loser of the race removed its copy.
    expect(owned).toHaveLength(2);
  });

  it('keeps every row in the demo workspace', async () => {
    for (const table of DEMO_TABLES) {
      const [counts] = await dataSource.query(
        `SELECT count(*) FILTER (WHERE workspace_id = $1)::int AS mine,
                count(*) FILTER (WHERE workspace_id IN (SELECT id FROM workspaces WHERE owner_id = $2) AND workspace_id <> $1)::int AS elsewhere
           FROM ${table}`,
        [demoId, a.userId],
      );
      expect({ table, ...counts }).toEqual({ table, mine: expect.any(Number), elsewhere: 0 });
      expect(counts.mine).toBeGreaterThan(0);
    }
  });

  it('fills the same data for the same anchor, whoever asks', async () => {
    const [demoB] = await dataSource.query('SELECT id FROM workspaces WHERE demo_of_user_id = $1', [
      b.userId,
    ]);
    const mine = await contentOf(demoId);
    expect(mine.length).toBeGreaterThan(250);
    expect(await contentOf(demoB.id)).toEqual(mine);
    expect(mine.every((row: { transaction_date: string }) => row.transaction_date <= anchor)).toBe(
      true,
    );
  });

  it('gives every sidebar page data that matches its contract', async () => {
    const month = anchor.slice(0, 7);
    const dashboard = await read(a, demoId, `/dashboard?range=30d`);
    matches(DashboardResponse, dashboard.body);

    const statements = await read(a, demoId, '/statements?page=1&limit=50');
    matches(StatementListPage, statements.body);
    expect(statements.body.data).toHaveLength(24);
    const file = await read(a, demoId, `/statements/${statements.body.data[0].id}/file`);
    expect(String(file.text ?? file.body)).toContain('Date;Counterparty;Purpose;Amount');

    const counts = await read(a, demoId, '/review-inbox/counts');
    matches(ReviewInboxCounts, counts.body);
    expect(counts.body.total).toBeGreaterThanOrEqual(5);

    const budgets = await read(a, demoId, `/budgets?date=${anchor}`);
    matches(BudgetList, budgets.body);
    expect(budgets.body).toHaveLength(5);
    const over = budgets.body.filter((budget: { percentUsed: number }) => budget.percentUsed > 100);
    expect(over).toHaveLength(1);
    matches(StoicBalance, (await read(a, demoId, '/budgets/stoic-balance')).body);

    const subscriptions = await read(a, demoId, '/subscriptions');
    matches(SubscriptionList, subscriptions.body);
    expect(subscriptions.body).toHaveLength(7);

    matches(GoalList, (await read(a, demoId, '/goals')).body);
    const monthGoals = await read(a, demoId, `/goals?month=${month}`);
    matches(MonthGoalList, monthGoals.body);
    expect(monthGoals.body).toHaveLength(2);

    const netWorth = await read(a, demoId, '/reports/net-worth?range=1y');
    matches(NetWorthResponse, netWorth.body);

    const tables = await read(a, demoId, '/custom-tables');
    matches(CustomTableList, tables.body);
    expect(tables.body.items).toHaveLength(1);
    const table = await read(a, demoId, `/custom-tables/${tables.body.items[0].id}`);
    matches(CustomTableDetail, table.body);
    expect(table.body.columns).toHaveLength(5);
  });

  it('is not readable from another account', async () => {
    await request(server())
      .get(`/workspaces/${demoId}`)
      .set('Authorization', `Bearer ${b.token}`)
      .expect(403);
  });

  it('goes with its workspace, and the next request makes a fresh one', async () => {
    await request(server())
      .delete(`/workspaces/${demoId}`)
      .set('Authorization', `Bearer ${a.token}`)
      .expect(200);
    for (const table of DEMO_TABLES) {
      const [{ n }] = await dataSource.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE workspace_id = $1`,
        [demoId],
      );
      expect({ table, n }).toEqual({ table, n: 0 });
    }

    const fresh = await createDemo(a).expect(201);
    expect(fresh.body.id).not.toBe(demoId);
  });
});
