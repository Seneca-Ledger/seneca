jest.mock('franc', () => ({
  franc: () => 'und',
}));

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TelegramConnection, TelegramLink } from '../../src/contracts';
import { webhookSecretOf } from '../../src/modules/telegram/telegram-bots.service';
import { deleteUserByEmail, type E2eAccount, e2eTestingModule, registerAccount } from './helpers/e2e-app';

const BOT_TOKEN = '987654:e2e-token';
const BOT_ID = '987654';
const CHAT_ID = 4242;

/**
 * One-click Connect from end to end: the link the settings page opens, the
 * `/start <code>` Telegram sends back to the bot's webhook, and the status the
 * page polls. Telegram itself is a fake answering on `fetch`.
 */
describe('Telegram Connect (e2e)', () => {
  const email = `telegram-connect-${Date.now()}@example.com`;
  const sent: Array<{ chat_id: string; text: string }> = [];
  const previousEnv = { ...process.env };
  const originalFetch = global.fetch;
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;

  const as = (method: 'get' | 'post' | 'delete', url: string) =>
    request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${owner.token}`)
      .set('x-workspace-id', owner.workspaceId);
  const telegramSends = (update: object, secret = webhookSecretOf(BOT_TOKEN)) =>
    request(app.getHttpServer())
      .post(`/telegram/webhook/${BOT_ID}`)
      .set('x-telegram-bot-api-secret-token', secret)
      .send(update);
  const start = (code: string, updateId: number) => ({
    update_id: updateId,
    message: { chat: { id: CHAT_ID }, from: { id: CHAT_ID, language_code: 'en' }, text: `/start ${code}` },
  });
  const decodes = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>, { onExcessProperty: 'ignore' })(body);
  const codeOf = (url: string) => new URL(url).searchParams.get('start') ?? '';

  beforeAll(async () => {
    process.env.TELEGRAM_BOT_TOKEN = BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    // A public https address: the bot gets a webhook, so no poller runs in the test.
    process.env.APP_URL = 'https://lumio.example';
    global.fetch = (async (input: unknown, init?: RequestInit) => {
      const method = String(input).split('/').pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (method === 'sendMessage') {
        sent.push(body);
      }
      const result = method === 'getMe' ? { username: 'lumio_e2e_bot' } : method === 'sendMessage' ? { message_id: 1 } : true;
      return new Response(JSON.stringify({ ok: true, result }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    owner = await registerAccount(app, email, 'Telegram Connect');
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    process.env = previousEnv;
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  beforeEach(() => {
    sent.length = 0;
  });

  it('connects the chat that presses Start on the link, and only once per link', async () => {
    const before = await as('get', '/telegram/connection').expect(200);
    decodes(TelegramConnection, before.body);
    expect(before.body).toEqual({ connected: false, inThisWorkspace: false });

    const link = await as('post', '/telegram/link').expect(201);
    decodes(TelegramLink, link.body);
    expect(link.body.url).toMatch(/^https:\/\/t\.me\/lumio_e2e_bot\?start=[\w-]{32}$/);
    const code = codeOf(link.body.url);

    await telegramSends(start(code, 1)).expect(200);

    const after = await as('get', '/telegram/connection').expect(200);
    expect(after.body).toEqual({ connected: true, inThisWorkspace: true });
    expect(sent).toEqual([expect.objectContaining({ chat_id: String(CHAT_ID), text: expect.stringContaining('Telegram connected') })]);
    const [row] = await dataSource.query(
      'SELECT telegram_id, telegram_chat_id, telegram_workspace_id FROM users WHERE id = $1',
      [owner.userId],
    );
    expect(row).toEqual({
      telegram_id: String(CHAT_ID),
      telegram_chat_id: String(CHAT_ID),
      telegram_workspace_id: owner.workspaceId,
    });

    // The same link a second time: refused, nothing rebound.
    sent.length = 0;
    await telegramSends(start(code, 2)).expect(200);
    expect(sent[0].text).toContain('This link has expired');
  });

  it('refuses a webhook call without the bot’s secret', async () => {
    await telegramSends(start('x'.repeat(32), 3), 'wrong').expect(401);
    await telegramSends(start('x'.repeat(32), 3), webhookSecretOf('1:other')).expect(401);
  });

  it('disconnects', async () => {
    await as('delete', '/telegram/connection').expect(204);

    const after = await as('get', '/telegram/connection').expect(200);
    expect(after.body).toEqual({ connected: false, inThisWorkspace: false });
  });
});
