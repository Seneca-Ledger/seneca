jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { generateKeyPairSync } from 'node:crypto';
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

/** Web push: the public key the browser subscribes with, and the device list per user. */
describe('Push subscriptions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = { owner: `push-owner-${stamp}@example.com`, other: `push-other-${stamp}@example.com` };
  let owner: E2eAccount;
  let other: E2eAccount;
  const endpoint = `https://push.example.org/send/${stamp}`;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', account.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    // VAPID is a P-256 key pair; any one will do for subscribing (nothing is sent here).
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const toUrlBase64 = (buffer: Buffer) =>
      buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const publicRaw = pair.publicKey.export({ format: 'jwk' });
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = toUrlBase64(
      Buffer.concat([
        Buffer.from([4]),
        Buffer.from(publicRaw.x as string, 'base64url'),
        Buffer.from(publicRaw.y as string, 'base64url'),
      ]),
    );
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = toUrlBase64(
      Buffer.from((pair.privateKey.export({ format: 'jwk' }) as { d: string }).d, 'base64url'),
    );

    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Push Owner');
    other = await registerAccount(app, emails.other, 'Push Other');
  });

  afterAll(async () => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('tells the browser the server can push and which key to use', async () => {
    const res = await as(owner, request(server()).get('/push/public-key')).expect(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.publicKey).toBe(process.env.WEB_PUSH_VAPID_PUBLIC_KEY);
  });

  it('stores a device, lists it for its user only, and removes it by endpoint', async () => {
    await as(owner, request(server()).post('/push/subscriptions'))
      .send({ endpoint, keys: { p256dh: 'BPd', auth: 'auth' }, userAgent: 'Phone' })
      .expect(201);
    // Re-subscribing the same device is not a second device.
    await as(owner, request(server()).post('/push/subscriptions'))
      .send({ endpoint, keys: { p256dh: 'BPd2', auth: 'auth2' } })
      .expect(201);

    const mine = await as(owner, request(server()).get('/push/subscriptions')).expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({ endpoint, userAgent: 'Phone' });

    const theirs = await as(other, request(server()).get('/push/subscriptions')).expect(200);
    expect(theirs.body).toEqual([]);

    await as(owner, request(server()).delete('/push/subscriptions')).send({ endpoint }).expect(204);
    const after = await as(owner, request(server()).get('/push/subscriptions')).expect(200);
    expect(after.body).toEqual([]);
  });

  it('refuses an endpoint that is not https', () => {
    return as(owner, request(server()).post('/push/subscriptions'))
      .send({ endpoint: 'http://push.example.org/x', keys: { p256dh: 'p', auth: 'a' } })
      .expect(400);
  });

  it('accepts the push channel in the notification preferences', async () => {
    const res = await as(owner, request(server()).patch('/notifications/preferences'))
      .send({ channels: { uncategorizedItems: { inApp: true, push: true } } })
      .expect(200);
    expect(res.body.channels?.uncategorizedItems ?? res.body.data?.channels?.uncategorizedItems).toMatchObject(
      { push: true },
    );
  });
});
