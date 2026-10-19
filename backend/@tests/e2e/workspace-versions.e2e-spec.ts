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
 * Workspace versions over HTTP: take one, list it, open it read only, look
 * around inside it, and keep it as a copy — every answer read through its
 * contract.
 */
describe('Workspace versions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `versions-owner-${stamp}@example.com`,
    other: `versions-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let other: E2eAccount;
  const created: string[] = [];

  const server = () => app.getHttpServer();
  const as = (account: E2eAccount, workspaceId: string, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);
    owner = await registerAccount(app, emails.owner, 'Versions Owner');
    other = await registerAccount(app, emails.other, 'Someone Else');
  });

  afterAll(async () => {
    if (dataSource) {
      for (const id of created) await dataSource.query('DELETE FROM workspaces WHERE id = $1', [id]);
      for (const email of Object.values(emails)) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('takes a version, opens it read only and keeps it as a copy', async () => {
    await as(owner, owner.workspaceId, request(server()).post('/goals'))
      .send({ name: 'Laptop', targetAmount: 2000 })
      .expect(201);

    const taken = await as(owner, owner.workspaceId, request(server()).post('/versions')).expect(201);
    expect(taken.body).toMatchObject({ status: 'ready', trigger: 'manual' });
    expect(taken.body.rowCounts.goals).toBe(1);
    expect(taken.body).not.toHaveProperty('wrappedDataKey');

    const list = await as(owner, owner.workspaceId, request(server()).get('/versions')).expect(200);
    expect(list.body.map((version: { id: string }) => version.id)).toContain(taken.body.id);

    // A goal added afterwards is not in the version.
    await as(owner, owner.workspaceId, request(server()).post('/goals'))
      .send({ name: 'Holiday', targetAmount: 900 })
      .expect(201);

    const opened = await as(
      owner,
      owner.workspaceId,
      request(server()).post(`/versions/${taken.body.id}/open`),
    ).expect(200);
    const versionWorkspace = opened.body.workspaceId;
    created.push(versionWorkspace);

    const goals = await as(owner, versionWorkspace, request(server()).get('/goals')).expect(200);
    const names = (Array.isArray(goals.body) ? goals.body : goals.body.data).map(
      (goal: { name: string }) => goal.name,
    );
    expect(names).toEqual(['Laptop']);
    const refused = await as(owner, versionWorkspace, request(server()).post('/goals'))
      .send({ name: 'Car', targetAmount: 1 })
      .expect(403);
    expect(refused.body.error.code).toBe('VERSION_READ_ONLY');

    const workspaces = await request(server())
      .get('/workspaces')
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    const listed = workspaces.body.find((item: { id: string }) => item.id === versionWorkspace);
    expect(listed).toMatchObject({
      kind: 'version',
      version: { id: taken.body.id, sourceWorkspaceId: owner.workspaceId },
    });

    // "Save as copy", asked from inside the version being looked at.
    const copy = await as(
      owner,
      versionWorkspace,
      request(server()).post(`/versions/${taken.body.id}/copy`),
    )
      .send({ name: 'Books as of the laptop' })
      .expect(200);
    expect(copy.body).toEqual({ workspaceId: versionWorkspace, name: 'Books as of the laptop' });
    await as(owner, versionWorkspace, request(server()).post('/goals'))
      .send({ name: 'Car', targetAmount: 1 })
      .expect(201);
  });

  it('keeps versions to the owner', async () => {
    await as(other, other.workspaceId, request(server()).get('/versions')).expect(200);
    const list = await as(owner, owner.workspaceId, request(server()).get('/versions')).expect(200);
    const [version] = list.body;
    const res = await as(
      other,
      other.workspaceId,
      request(server()).post(`/versions/${version.id}/open`),
    ).expect(403);
    expect(res.body.error.code).toBe('VERSION_LIST_OWNER_ONLY');
  });
});
