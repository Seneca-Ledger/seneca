jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A scoped API key reaches only what its scopes name; what it writes is
 * audited as the key, undoable; the in-app assistant's writes are audited
 * as the assistant.
 */
describe('API key scopes and trusted agents (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `scopes-owner-${stamp}@example.com` };
  let owner: E2eAccount;
  let categoryId: string;
  let readKey: string;
  let writeKey: string;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const withKey = (key: string, req: request.Test) => req.set('x-api-key', key);
  const server = () => app.getHttpServer();
  const today = () => new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Scopes Owner');
    // api_key.manage and the audit log belong to the admin role.
    await dataSource.getRepository(User).update({ email: emails.owner }, { role: UserRole.ADMIN });
    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    categoryId = categories.body[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('requires scopes on a new key and refuses the ones a key may never hold', async () => {
    await as(owner, request(server()).post('/api-keys')).send({ name: 'No scopes' }).expect(400);
    await as(owner, request(server()).post('/api-keys'))
      .send({ name: 'Too much', scopes: ['api_key.manage'] })
      .expect(400);

    const scopes = await as(owner, request(server()).get('/api-keys/scopes')).expect(200);
    expect(scopes.body.presets.read).toContain('transaction.view');
    expect(scopes.body.all).not.toContain('api_key.manage');

    const read = await as(owner, request(server()).post('/api-keys'))
      .send({ name: 'Reader', scopes: scopes.body.presets.read })
      .expect(201);
    readKey = read.body.key;
    expect(read.body.scopes).toContain('transaction.view');

    const write = await as(owner, request(server()).post('/api-keys'))
      .send({ name: 'Writer', scopes: ['statement.upload', 'transaction.view', 'transaction.edit'] })
      .expect(201);
    writeKey = write.body.key;

    const listed = await as(owner, request(server()).get('/api-keys')).expect(200);
    expect(listed.body.find((item: { name: string }) => item.name === 'Reader').scopes).toContain(
      'report.view',
    );
  });

  it('lets a read-only key read but not write', async () => {
    await withKey(readKey, request(server()).get('/transactions')).expect(200);
    const refused = await withKey(readKey, request(server()).post('/statements/manual-expense'))
      .field('amount', '5')
      .field('currency', 'USD')
      .field('merchant', 'Key shop')
      .field('categoryId', categoryId)
      .field('date', today())
      .expect(403);
    expect(refused.body.message ?? JSON.stringify(refused.body)).toMatch(/scope/i);
  });

  it('audits what a writing key does as that key, undoable', async () => {
    await withKey(writeKey, request(server()).post('/statements/manual-expense'))
      .field('amount', '7')
      .field('currency', 'USD')
      .field('merchant', 'Key shop')
      .field('categoryId', categoryId)
      .field('date', today())
      .expect(201);

    const events = await as(
      owner,
      request(server()).get('/audit-events?actorType=integration&limit=20'),
    ).expect(200);
    const rows = events.body.data ?? events.body;
    const mine = rows.find((event: { actorLabel: string }) => event.actorLabel.includes('Writer'));
    expect(mine).toBeDefined();
    expect(mine.actorType).toBe('integration');
    expect(mine.meta.onBehalfOfUserId).toBeTruthy();
    expect(mine.isUndoable).toBe(true);
  });
});
