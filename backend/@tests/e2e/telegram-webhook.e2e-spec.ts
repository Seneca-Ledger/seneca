vi.mock('franc', () => ({
  franc: () => 'und',
}));

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { e2eTestingModule } from './helpers/e2e-app';

/**
 * Telegram writes these bodies, so they are decoded leniently, and a body that
 * does not fit is answered 200 and dropped: any other answer makes Telegram
 * retry the same update.
 */
describe('Telegram webhook (e2e)', () => {
  const secret = `telegram-e2e-${Date.now()}`;
  let app: INestApplication;
  let dataSource: DataSource;
  let previousSecret: string | undefined;

  const post = (body: unknown, token = secret) =>
    request(app.getHttpServer())
      .post('/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', token)
      .send(body as object);
  const statementCount = async () => Number((await dataSource.query('SELECT count(*) AS n FROM statements'))[0].n);

  beforeAll(async () => {
    previousSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = previousSecret;
    await app.close();
  });

  it('refuses a request without the secret', async () => {
    await post({ update_id: 1 }, 'wrong').expect(401);
  });

  it('drops a malformed update with a 200 and books nothing', async () => {
    const before = await statementCount();
    const res = await post({
      update_id: 2,
      message: { chat: { id: { nested: true } }, photo: [{ width: 10 }], text: 'x'.repeat(5000) },
    }).expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(await statementCount()).toBe(before);
  });

  it('answers an update kind the bot does not handle with a 200', async () => {
    const res = await post({ update_id: 3, edited_message: { text: 'edited', chat: { id: 1 } } }).expect(200);
    expect(res.body).toEqual({ ok: true });
  });
});
