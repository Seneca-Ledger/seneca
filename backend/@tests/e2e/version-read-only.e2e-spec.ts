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
 * A past version of a workspace is looked at, never changed: every write is
 * refused with a code the client can tell apart from lost access, reads and
 * the few POSTs that only read still answer, and the workspace routes that
 * name it in their path refuse too. Only its owner may open it.
 */
describe('A past version is read only (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `version-owner-${stamp}@example.com`,
    other: `version-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  let versionId: string;

  const server = () => app.getHttpServer();
  const inVersion = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', versionId);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Version Owner');
    other = await registerAccount(app, emails.other, 'Someone Else');

    // A version workspace as opening one makes it: owned by the opener, kind 'version'.
    const [workspace] = await dataSource.query(
      `INSERT INTO workspaces (name, currency, owner_id, kind) VALUES ('Books on 12 Oct', 'EUR', $1, 'version') RETURNING id`,
      [owner.userId],
    );
    versionId = workspace.id;
    await dataSource.query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'admin')`,
      [versionId, owner.userId, other.userId],
    );
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query('DELETE FROM workspaces WHERE id = $1', [versionId]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('answers reads', async () => {
    await inVersion(owner, request(server()).get('/goals')).expect(200);
    await inVersion(owner, request(server()).get('/budgets')).expect(200);
  });

  it('refuses writes with VERSION_READ_ONLY, and the data stays as it was', async () => {
    const goal = await inVersion(owner, request(server()).post('/goals'))
      .send({ name: 'Emergency fund', targetAmount: 1000 })
      .expect(403);
    expect(goal.body.error?.code).toBe('VERSION_READ_ONLY');
    expect(goal.body.error?.message).not.toMatch(/workspace/);

    const category = await inVersion(owner, request(server()).post('/categories')).send({
      name: 'Travel',
      type: 'expense',
    });
    expect(category.status).toBe(403);
    expect(category.body.error?.code).toBe('VERSION_READ_ONLY');

    const [{ count }] = await dataSource.query(
      'SELECT COUNT(*)::int AS count FROM goals WHERE workspace_id = $1',
      [versionId],
    );
    expect(count).toBe(0);
  });

  it('lets through a POST that only reads', async () => {
    const res = await inVersion(owner, request(server()).post('/categorization-rules/test')).send({
      conditions: [],
    });
    expect(res.body.error?.code).not.toBe('VERSION_READ_ONLY');
  });

  it('refuses the workspace routes that name it in their path', async () => {
    const rename = await request(server())
      .patch(`/workspaces/${versionId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Renamed' })
      .expect(403);
    expect(rename.body.error?.code).toBe('VERSION_READ_ONLY');

    const favorite = await request(server())
      .patch(`/workspaces/${versionId}/favorite`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(403);
    expect(favorite.body.error?.code).toBe('VERSION_READ_ONLY');
  });

  it('is open to its owner alone', async () => {
    const res = await inVersion(other, request(server()).get('/goals')).expect(403);
    expect(res.body.error?.code).toBe('VERSION_OWNER_ONLY');
  });

  it('is listed with its kind, and is not remembered as the last workspace', async () => {
    await request(server())
      .post(`/workspaces/${versionId}/switch`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const [user] = await dataSource.query('SELECT last_workspace_id FROM users WHERE id = $1', [
      owner.userId,
    ]);
    expect(user.last_workspace_id).not.toBe(versionId);

    const list = await request(server())
      .get('/workspaces')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const listed = list.body.find((item: { id: string }) => item.id === versionId);
    expect(listed.kind).toBe('version');
  });
});
