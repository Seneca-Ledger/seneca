import { BadRequestException } from '@nestjs/common';
import { TelegramBotsService, webhookSecretOf } from '@/modules/telegram/telegram-bots.service';

const TOKEN = '123:secret';

type Bot = { botToken: string; publicUrl: string | null };

/**
 * A fake Bot API. getUpdates hands out each queued batch once, then holds the
 * request open until the poller aborts it, like a long poll with nothing new.
 */
function mockBotApi(options: { updates?: unknown[][]; getUpdatesError?: number } = {}) {
  const calls: Array<{ method: string; body: any }> = [];
  const batches = [...(options.updates ?? [])];
  global.fetch = jest.fn(async (url: unknown, init: any) => {
    const method = String(url).split('/').pop() ?? '';
    calls.push({ method, body: JSON.parse(init.body) });
    const answer = (payload: unknown) => new Response(JSON.stringify(payload));
    switch (method) {
      case 'getMe':
        return answer({ ok: true, result: { username: 'lumio_bot' } });
      case 'getUpdates': {
        if (options.getUpdatesError) {
          return answer({ ok: false, error_code: options.getUpdatesError, description: 'Unauthorized' });
        }
        const batch = batches.shift();
        if (batch) {
          return answer({ ok: true, result: batch });
        }
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }
      default:
        return answer({ ok: true, result: true });
    }
  }) as any;
  return calls;
}

function createService(bots: Bot[], workspaceToken: string | null = TOKEN) {
  const applicationSettingsService = {
    listTelegramBots: jest.fn(async () => bots),
    getTelegramSettings: jest.fn(async () => ({ botToken: workspaceToken })),
  } as any;
  const telegramService = { handleUpdate: jest.fn(async () => undefined) } as any;
  const linkCodes = {
    issue: jest.fn(async () => ({ code: 'c'.repeat(32), expiresAt: new Date('2026-10-18T10:10:00Z') })),
  } as any;
  const service = new TelegramBotsService(applicationSettingsService, telegramService, linkCodes);
  return { service, applicationSettingsService, telegramService, linkCodes };
}

/** Lets the polling loop run until `done` holds. */
async function until(done: () => boolean) {
  for (let i = 0; i < 200 && !done(); i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  expect(done()).toBe(true);
}

describe('TelegramBotsService', () => {
  const originalEnv = process.env;
  let services: TelegramBotsService[] = [];

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    services = [];
  });

  afterEach(() => {
    for (const service of services) {
      service.onModuleDestroy();
    }
    process.env = originalEnv;
  });

  const make = (bots: Bot[], workspaceToken?: string | null) => {
    const made = createService(bots, workspaceToken);
    services.push(made.service);
    return made;
  };

  it('links to the bot with a one-time code for the user and workspace', async () => {
    mockBotApi();
    const { service, linkCodes } = make([{ botToken: TOKEN, publicUrl: 'https://lumio.example' }]);

    const link = await service.createLink({ id: 'user-1' } as any, 'ws-open');

    expect(link).toEqual({
      url: `https://t.me/lumio_bot?start=${'c'.repeat(32)}`,
      expiresAt: '2026-10-18T10:10:00.000Z',
    });
    expect(linkCodes.issue).toHaveBeenCalledWith({ userId: 'user-1', workspaceId: 'ws-open', botId: '123' });
  });

  it('starts listening to a bot saved a moment ago before handing out its link', async () => {
    const calls = mockBotApi();
    const { service } = make([{ botToken: TOKEN, publicUrl: 'https://lumio.example' }]);

    await service.createLink({ id: 'user-1' } as any, 'ws-open');

    expect(calls.map(call => call.method)).toContain('setWebhook');
    expect(service.tokenOf('123')).toBe(TOKEN);
  });

  it('refuses a link when no bot is configured', async () => {
    mockBotApi();
    const { service } = make([], null);

    await expect(service.createLink({ id: 'user-1' } as any, 'ws-open')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('sets a webhook with a per-bot secret when the app has a public https address', async () => {
    const calls = mockBotApi();
    const { service } = make([{ botToken: TOKEN, publicUrl: 'https://lumio.example' }]);

    await service.sync();

    expect(calls).toEqual([
      {
        method: 'setWebhook',
        body: {
          url: 'https://lumio.example/api/v1/telegram/webhook/123',
          secret_token: webhookSecretOf(TOKEN),
          allowed_updates: ['message', 'callback_query'],
        },
      },
    ]);
  });

  it('polls for updates when the app is not reachable from the internet', async () => {
    const first = { update_id: 10, message: { chat: { id: 1 }, text: '/start' } };
    const second = { update_id: 11, message: { chat: { id: 1 }, text: '/help' } };
    const calls = mockBotApi({ updates: [[first, second]] });
    const { service, telegramService } = make([{ botToken: TOKEN, publicUrl: 'http://127.0.0.1:3000' }]);

    await service.sync();
    await until(() => calls.filter(call => call.method === 'getUpdates').length === 2);

    expect(calls[0].method).toBe('deleteWebhook');
    expect(telegramService.handleUpdate).toHaveBeenCalledWith(first, TOKEN);
    expect(telegramService.handleUpdate).toHaveBeenCalledWith(second, TOKEN);
    // The next long poll asks only for what came after the last update.
    expect(calls.filter(call => call.method === 'getUpdates')[1].body.offset).toBe(12);
  });

  it('keeps polling after an update fails to handle', async () => {
    const calls = mockBotApi({
      updates: [[{ update_id: 10, message: { text: 'boom' } }], [{ update_id: 11, message: { text: 'ok' } }]],
    });
    const { service, telegramService } = make([{ botToken: TOKEN, publicUrl: null }]);
    telegramService.handleUpdate.mockRejectedValueOnce(new Error('boom'));

    await service.sync();
    await until(() => calls.filter(call => call.method === 'getUpdates').length === 3);

    expect(telegramService.handleUpdate).toHaveBeenCalledTimes(2);
  });

  it('stops polling a bot whose token Telegram rejects', async () => {
    const calls = mockBotApi({ getUpdatesError: 401 });
    const { service } = make([{ botToken: TOKEN, publicUrl: null }]);

    await service.sync();
    await until(() => calls.some(call => call.method === 'getUpdates'));
    await new Promise(resolve => setTimeout(resolve, 20));
    await service.sync();

    expect(calls.filter(call => call.method === 'getUpdates')).toHaveLength(1);
  });

  it('leaves a webhook set up by hand for the server bot alone', async () => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    process.env.TELEGRAM_WEBHOOK_SECRET = 'manual';
    const calls = mockBotApi();
    const { service } = make([{ botToken: TOKEN, publicUrl: 'https://lumio.example' }]);

    await service.sync();

    expect(calls).toEqual([]);
    expect(service.tokenOf('123')).toBe(TOKEN);
  });

  it('forgets a bot removed from the settings', async () => {
    mockBotApi();
    const bots: Bot[] = [{ botToken: TOKEN, publicUrl: 'https://lumio.example' }];
    const { service } = make(bots);

    await service.sync();
    bots.length = 0;
    await service.sync();

    expect(service.tokenOf('123')).toBeNull();
  });

  it('tries setWebhook again on the next sync after it failed', async () => {
    const calls = mockBotApi();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    const { service } = make([{ botToken: TOKEN, publicUrl: 'https://lumio.example' }]);

    await service.sync();
    expect(service.tokenOf('123')).toBeNull();
    await service.sync();

    expect(service.tokenOf('123')).toBe(TOKEN);
    // The first attempt never reached the fake API; the second did.
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(calls.map(call => call.method)).toEqual(['setWebhook']);
  });
});
