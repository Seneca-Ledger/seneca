vi.mock('franc', () => ({
  franc: () => 'und',
}));

import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { InstanceTelegramBotStatus, TelegramConnection, TelegramLink } from '../../src/contracts';
import { TelegramBotsService, webhookSecretOf } from '../../src/modules/telegram/telegram-bots.service';
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
  const botCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const previousEnv = { ...process.env };
  const originalFetch = global.fetch;
  let app: INestApplication;
  let dataSource: DataSource;
  let owner: E2eAccount;

  const as = (method: 'get' | 'post' | 'put' | 'delete', url: string) =>
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
    process.env.APP_URL = 'https://seneca.example';
    global.fetch = (async (input: unknown, init?: RequestInit) => {
      const method = String(input).split('/').pop();
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      botCalls.push({ url: String(input), body });
      if (method === 'sendMessage') {
        sent.push(body);
      }
      const result = method === 'getMe' ? { username: 'seneca_e2e_bot' } : method === 'sendMessage' ? { message_id: 1 } : true;
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
    expect(link.body.url).toMatch(/^https:\/\/t\.me\/seneca_e2e_bot\?start=[\w-]{32}$/);
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

  describe('shared bot', () => {
    it('is only for instance admins', async () => {
      await as('get', '/settings/instance/telegram').expect(403);
      await as('put', '/settings/instance/telegram').send({ botToken: '555:shared' }).expect(403);
    });

    it('serves a workspace without its own bot once an admin saves it', async () => {
      await dataSource.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', owner.userId]);
      const before = await as('get', '/settings/instance/telegram').expect(200);
      decodes(InstanceTelegramBotStatus, before.body);
      expect(before.body).toEqual({ source: 'env' });

      const saved = await as('put', '/settings/instance/telegram').send({ botToken: '555:shared' }).expect(200);
      expect(saved.body).toEqual({ source: 'instance' });

      const status = await as('get', '/settings/notifications/telegram').expect(200);
      expect(status.body).toMatchObject({ source: 'instance', settings: { sharedBot: true } });
      const progress = await as('get', '/dashboard/setup-progress').expect(200);
      expect(progress.body).toMatchObject({ telegramAvailable: true, hasTelegram: false });

      botCalls.length = 0;
      await as('post', '/telegram/link').expect(201);
      // The link is for the shared bot, which starts listening before the user presses Start.
      expect(botCalls.map(call => call.url)).toEqual(
        expect.arrayContaining([
          'https://api.telegram.org/bot555:shared/setWebhook',
          'https://api.telegram.org/bot555:shared/getMe',
        ]),
      );
      expect(botCalls.find(call => call.url.endsWith('/setWebhook'))?.body.url).toBe(
        'https://seneca.example/api/v1/telegram/webhook/555',
      );

      const cleared = await as('delete', '/settings/instance/telegram').expect(200);
      expect(cleared.body).toEqual({ source: 'env' });
    });
  });

  /**
   * A workspace admin who saves their own bot knows its token, so they can post
   * any update to its webhook — with anyone's Telegram id in it. The bot it
   * arrives on is the only thing they cannot choose.
   */
  describe('updates on a bot that does not serve the chat', () => {
    const stamp = Date.now();
    const ATTACKER_TOKEN = '424242:attacker-bot';
    const VICTIM_TG = 7001;
    const VIEWER_TG = 7002;
    const ATTACKER_TG = 9001;
    const emails = {
      victim: `telegram-victim-${stamp}@example.com`,
      attacker: `telegram-attacker-${stamp}@example.com`,
      viewer: `telegram-viewer-${stamp}@example.com`,
    };
    let victim: E2eAccount;
    let attacker: E2eAccount;
    let viewer: E2eAccount;
    let statementId: string;
    let receiptId: string;
    let updateId = 1000;

    const asAccount = (account: E2eAccount, method: 'post' | 'put', url: string, workspaceId = account.workspaceId) =>
      request(app.getHttpServer())
        [method](url)
        .set('Authorization', `Bearer ${account.token}`)
        .set('x-workspace-id', workspaceId);
    const onBot = (botToken: string, update: object) =>
      request(app.getHttpServer())
        .post(`/telegram/webhook/${botToken.split(':')[0]}`)
        .set('x-telegram-bot-api-secret-token', webhookSecretOf(botToken))
        .send({ update_id: ++updateId, ...update })
        .expect(200);
    const message = (chat: number, from: number, text: string) => ({
      message: { chat: { id: chat }, from: { id: from, language_code: 'en' }, text },
    });
    const tap = (chat: number, from: number, data: string) => ({
      callback_query: { id: `cb-${updateId}`, from: { id: from }, message: { chat: { id: chat } }, data },
    });
    const connect = async (account: E2eAccount, tg: number, workspaceId = account.workspaceId) => {
      const link = await asAccount(account, 'post', '/telegram/link', workspaceId).expect(201);
      await onBot(BOT_TOKEN, message(tg, tg, `/start ${codeOf(link.body.url)}`));
    };
    const statementDeleted = async () =>
      (await dataSource.query('SELECT deleted_at FROM statements WHERE id = $1', [statementId]))[0].deleted_at !== null;
    const receiptExists = async () =>
      (await dataSource.query('SELECT id FROM receipts WHERE id = $1', [receiptId])).length === 1;
    const statementsIn = async (workspaceId: string) =>
      Number((await dataSource.query('SELECT count(*) AS n FROM statements WHERE workspace_id = $1', [workspaceId]))[0].n);

    beforeAll(async () => {
      victim = await registerAccount(app, emails.victim, 'Telegram Victim');
      attacker = await registerAccount(app, emails.attacker, 'Telegram Attacker');
      viewer = await registerAccount(app, emails.viewer, 'Telegram Viewer');

      // The victim connects their chat in their workspace through the server's bot.
      await connect(victim, VICTIM_TG);

      // The attacker owns another workspace and gives it a bot of their own.
      await asAccount(attacker, 'put', '/settings/notifications/telegram').send({ botToken: ATTACKER_TOKEN }).expect(200);
      await app.get(TelegramBotsService).sync();

      // A member who connected while an admin, then was made a viewer.
      await dataSource.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
        [victim.workspaceId, viewer.userId],
      );
      await connect(viewer, VIEWER_TG, victim.workspaceId);
      await dataSource.query(`UPDATE workspace_members SET role = 'viewer' WHERE workspace_id = $1 AND user_id = $2`, [
        victim.workspaceId,
        viewer.userId,
      ]);

      const [statement] = await dataSource.query(
        `INSERT INTO statements
           (user_id, workspace_id, file_name, file_path, file_type, file_size, file_hash, bank_name, status, currency)
         VALUES ($1, $2, 'bank.csv', '/dev/null', 'csv', 1, md5(random()::text), 'other', 'completed', 'EUR')
         RETURNING id`,
        [victim.userId, victim.workspaceId],
      );
      statementId = statement.id;
      const [receipt] = await dataSource.query(
        `INSERT INTO receipts (user_id, workspace_id, source, subject, sender, received_at, status, parsed_data)
         VALUES ($1, $2, 'scan', 'Scan', 'upload', now(), 'draft', '{}')
         RETURNING id`,
        [victim.userId, victim.workspaceId],
      );
      receiptId = receipt.id;
    });

    afterAll(async () => {
      if (!dataSource) {
        return;
      }
      await dataSource.query('DELETE FROM workspace_service_settings WHERE workspace_id = $1', [attacker.workspaceId]);
      await dataSource.query('DELETE FROM receipts WHERE workspace_id = $1', [victim.workspaceId]);
      await dataSource.query('DELETE FROM telegram_reports WHERE user_id = $1', [victim.userId]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    });

    it('connects both chats through the server bot', async () => {
      const rows = await dataSource.query(
        'SELECT telegram_chat_id, telegram_workspace_id FROM users WHERE id = ANY($1) ORDER BY telegram_chat_id',
        [[victim.userId, viewer.userId]],
      );
      expect(rows).toEqual([
        { telegram_chat_id: String(VICTIM_TG), telegram_workspace_id: victim.workspaceId },
        { telegram_chat_id: String(VIEWER_TG), telegram_workspace_id: victim.workspaceId },
      ]);
    });

    it('sends none of the victim workspace’s data to a forged update on the attacker’s bot', async () => {
      for (const chat of [ATTACKER_TG, VICTIM_TG]) {
        for (const command of ['/report monthly', '/report', '/goals', '/networth', '/start']) {
          await onBot(ATTACKER_TOKEN, message(chat, VICTIM_TG, command));
        }
      }

      expect(sent.length).toBeGreaterThan(0);
      for (const reply of sent) {
        expect(reply.text).not.toMatch(/Report for|Daily report|Savings goals|No goals yet|Net worth|Telegram connected/);
      }
      expect(sent.every(reply => reply.text.includes('isn’t connected') || reply.text.includes("isn't connected") || reply.text.includes('Hi!'))).toBe(true);
      expect(await dataSource.query('SELECT id FROM telegram_reports WHERE user_id = $1', [victim.userId])).toEqual([]);
    });

    it('writes and deletes nothing in the victim workspace for a forged update', async () => {
      const before = await statementsIn(victim.workspaceId);
      for (const chat of [ATTACKER_TG, VICTIM_TG]) {
        await onBot(ATTACKER_TOKEN, message(chat, VICTIM_TG, 'coffee 4.50'));
        await onBot(ATTACKER_TOKEN, tap(chat, VICTIM_TG, `stmt:del:${statementId}`));
        await onBot(ATTACKER_TOKEN, tap(chat, VICTIM_TG, `rcpt:del:${receiptId}`));
      }

      expect(await statementsIn(victim.workspaceId)).toBe(before);
      expect(await statementDeleted()).toBe(false);
      expect(await receiptExists()).toBe(true);
      // The victim's chat is still theirs.
      const [row] = await dataSource.query('SELECT telegram_chat_id FROM users WHERE id = $1', [victim.userId]);
      expect(row.telegram_chat_id).toBe(String(VICTIM_TG));
    });

    it('lets a member made a viewer delete nothing through the bot', async () => {
      await onBot(BOT_TOKEN, tap(VIEWER_TG, VIEWER_TG, `stmt:del:${statementId}`));
      await onBot(BOT_TOKEN, tap(VIEWER_TG, VIEWER_TG, `rcpt:del:${receiptId}`));

      expect(await statementDeleted()).toBe(false);
      expect(await receiptExists()).toBe(true);
      expect(sent.map(reply => reply.text)).toEqual(['Could not delete.', 'Could not delete.']);
    });

    it('still answers the victim on the bot their chat was connected through', async () => {
      await onBot(BOT_TOKEN, message(VICTIM_TG, VICTIM_TG, '/goals'));
      expect(sent[0]).toEqual(expect.objectContaining({ chat_id: String(VICTIM_TG), text: expect.stringContaining('No goals yet') }));

      await onBot(BOT_TOKEN, tap(VICTIM_TG, VICTIM_TG, `rcpt:del:${receiptId}`));
      await onBot(BOT_TOKEN, tap(VICTIM_TG, VICTIM_TG, `stmt:del:${statementId}`));
      expect(await receiptExists()).toBe(false);
      expect(await statementDeleted()).toBe(true);
    });
  });
});
