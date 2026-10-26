import type { Mock } from 'vitest';
import * as nodemailerModule from 'nodemailer';
vi.mock('nodemailer', () => {
  const mock = {
    createTransport: vi.fn(() => ({
      verify: vi.fn().mockResolvedValue(true),
    })),
  };
  // The service imports nodemailer's default export.
  return { ...mock, default: mock };
});
vi.mock('../../../../src/common/utils/egress-url.util', () => ({
  // Egress policy is covered by common/utils/egress-url.util.spec.ts; here the
  // provider hostnames are fixtures that no DNS server can resolve.
  assertPublicEgressHost: vi.fn().mockResolvedValue(undefined),
  pinPublicEgressHost: vi.fn(async (host: string) => ({
    host: '198.51.100.7',
    servername: host,
  })),
}));

import { ApplicationSettingsService } from '../../../../src/modules/application-settings/application-settings.service';
import { WorkspaceServiceSettingsKey } from '../../../../src/entities';
import { assertPublicEgressHost } from '../../../../src/common/utils/egress-url.util';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { encryptText } from '@/common/utils/encryption.util';
import { APP_NAME } from '../../../../src/common/brand';

describe('ApplicationSettingsService', () => {
  const originalEnv = process.env;
  const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;
  const saved: Record<string, unknown> = {};
  const repository = {
    findOne: vi.fn(),
    create: vi.fn(input => input),
    save: vi.fn(async entity => {
      saved[String(entity.key)] = entity;
      return entity;
    }),
    delete: vi.fn(),
  };

  let instanceSaved: Record<string, unknown> | null = null;
  const instanceRepository = {
    findOne: vi.fn(async () => instanceSaved),
    create: vi.fn(input => input),
    save: vi.fn(async entity => {
      instanceSaved = entity;
      return entity;
    }),
    delete: vi.fn(async () => {
      instanceSaved = null;
    }),
  };

  const createService = () =>
    new ApplicationSettingsService(
      repository as never,
      new EffectRuntime(),
      instanceRepository as never,
    );

  beforeEach(() => {
    process.env = { ...originalEnv };
    repository.findOne.mockImplementation(({ where }: { where?: { key?: string } } = {}) =>
      Promise.resolve(where?.key ? saved[where.key] || null : null),
    );
    repository.create.mockImplementation(input => input);
    repository.save.mockClear();
    repository.delete.mockClear();
    (assertPublicEgressHost as Mock).mockResolvedValue(undefined);
    (assertPublicEgressHost as Mock).mockClear();
    Object.keys(saved).forEach(key => delete saved[key]);
    instanceSaved = null;
    instanceRepository.save.mockClear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ ok: true }),
    }) as never;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Telegram connection check', () => {
    const botToken = '123456:abc-DEF_ghi';
    const telegramAnswer = (status: number, body: unknown) =>
      (global.fetch as Mock).mockImplementation(
        async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
      );

    it('saves the bot token once getMe accepts it', async () => {
      telegramAnswer(200, { ok: true, result: { id: 1 } });

      await createService().saveTelegramSettings(user, { botToken, timeoutMs: 1000 });

      const [input] = (global.fetch as Mock).mock.calls[0];
      expect(String(input)).toBe(`https://api.telegram.org/bot${botToken}/getMe`);
      expect(saved[WorkspaceServiceSettingsKey.TELEGRAM]).toBeDefined();
    });

    it("answers Telegram's own reason when it rejects the token", async () => {
      telegramAnswer(401, { ok: false, description: 'Unauthorized' });

      await expect(
        createService().saveTelegramSettings(user, { botToken, timeoutMs: 1000 }),
      ).rejects.toThrow('Unauthorized');
    });

    it('reports an unreachable Telegram instead of an invalid token', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('connect ECONNREFUSED'));

      await expect(
        createService().saveTelegramSettings(user, { botToken, timeoutMs: 1000 }),
      ).rejects.toThrow('Unable to connect to Telegram');
    });

    it('never sends a token that could reshape the request path', async () => {
      await expect(
        createService().saveTelegramSettings(user, { botToken: '1:a/../x', timeoutMs: 1000 }),
      ).rejects.toThrow('Telegram bot token is invalid');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('Telegram bots the server answers for', () => {
    const row = (workspaceId: string, botToken: string | null) => ({
      workspaceId,
      key: WorkspaceServiceSettingsKey.TELEGRAM,
      config: {},
      encryptedSecrets: botToken ? { botToken: encryptText(botToken) } : {},
    });

    beforeEach(() => {
      process.env.INTEGRATIONS_ENCRYPTION_KEY = 'unit-test-key';
      process.env.APP_URL = 'http://127.0.0.1:3000';
      delete process.env.TELEGRAM_BOT_TOKEN;
    });

    afterEach(() => {
      delete (repository as { find?: unknown }).find;
    });

    it('lists the server bot and each workspace bot once, each with its public address', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '1:env';
      Object.assign(repository, {
        find: vi.fn(async () => [row('ws-a', '2:a'), row('ws-b', '1:env'), row('ws-c', null)]),
      });
      repository.findOne.mockImplementation(async ({ where }: { where: { workspaceId: string } }) =>
        where.workspaceId === 'ws-a' ? { config: { publicUrl: 'https://a.example' } } : null,
      );

      await expect(createService().listTelegramBots()).resolves.toEqual([
        { botToken: '1:env', publicUrl: 'http://127.0.0.1:3000' },
        { botToken: '2:a', publicUrl: 'https://a.example' },
      ]);
    });

    it('skips a token it cannot decrypt and keeps the others', async () => {
      const broken = { ...row('ws-a', null), encryptedSecrets: { botToken: `enc:${Buffer.alloc(40, 7).toString('base64')}` } };
      Object.assign(repository, { find: vi.fn(async () => [broken, row('ws-b', '3:b')]) });
      repository.findOne.mockResolvedValue(null);

      await expect(createService().listTelegramBots()).resolves.toEqual([
        { botToken: '3:b', publicUrl: 'http://127.0.0.1:3000' },
      ]);
    });

    it('lists the bot an instance admin saved as the shared one, instead of TELEGRAM_BOT_TOKEN', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '1:env';
      instanceSaved = { key: 'telegram', encryptedSecrets: { botToken: encryptText('4:shared') } };
      Object.assign(repository, { find: vi.fn(async () => []) });

      await expect(createService().listTelegramBots()).resolves.toEqual([
        { botToken: '4:shared', publicUrl: 'http://127.0.0.1:3000' },
      ]);
    });
  });

  describe('shared Telegram bot', () => {
    const getMeAnswers = (status: number, body: unknown) =>
      (global.fetch as Mock).mockImplementation(
        async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
      );

    beforeEach(() => {
      process.env.INTEGRATIONS_ENCRYPTION_KEY = 'unit-test-key';
      delete process.env.TELEGRAM_BOT_TOKEN;
    });

    it('serves a workspace its own bot first, then the admin’s shared bot, then TELEGRAM_BOT_TOKEN', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '1:env';
      const service = createService();
      await expect(service.getTelegramSettings(user)).resolves.toMatchObject({
        botToken: '1:env',
        source: 'env',
      });

      instanceSaved = { key: 'telegram', encryptedSecrets: { botToken: encryptText('4:shared') } };
      await expect(service.getTelegramSettings(user)).resolves.toMatchObject({
        botToken: '4:shared',
        source: 'instance',
      });

      saved[WorkspaceServiceSettingsKey.TELEGRAM] = {
        config: {},
        encryptedSecrets: { botToken: encryptText('2:own') },
      };
      await expect(service.getTelegramSettings(user)).resolves.toMatchObject({
        botToken: '2:own',
        source: 'workspace',
      });
    });

    it('falls through to the shared bot when the workspace row has no token', async () => {
      instanceSaved = { key: 'telegram', encryptedSecrets: { botToken: encryptText('4:shared') } };
      saved[WorkspaceServiceSettingsKey.TELEGRAM] = { config: { timeoutMs: 5000 }, encryptedSecrets: {} };

      await expect(createService().getTelegramSettings(user)).resolves.toMatchObject({
        botToken: '4:shared',
        source: 'instance',
      });
    });

    it('tells the settings page whether a shared bot exists', async () => {
      const service = createService();
      await expect(service.getTelegramStatus(user)).resolves.toMatchObject({
        source: 'disabled',
        settings: { botTokenConfigured: false, sharedBot: false },
      });

      process.env.TELEGRAM_BOT_TOKEN = '1:env';
      await expect(service.getTelegramStatus(user)).resolves.toMatchObject({
        source: 'env',
        settings: { botTokenConfigured: true, sharedBot: true },
      });
    });

    it('saves the shared bot encrypted once getMe accepts it, and removes it again', async () => {
      getMeAnswers(200, { ok: true, result: { id: 4 } });
      const service = createService();

      await expect(service.saveInstanceTelegramSettings(user, { botToken: '4:shared' })).resolves.toEqual({
        source: 'instance',
      });
      const [input] = (global.fetch as Mock).mock.calls[0];
      expect(String(input)).toBe('https://api.telegram.org/bot4:shared/getMe');
      const stored = instanceSaved as { encryptedSecrets: { botToken: string }; updatedByUserId: string };
      expect(stored.encryptedSecrets.botToken).not.toBe('4:shared');
      expect(stored.updatedByUserId).toBe('user-1');

      await expect(service.clearInstanceTelegramSettings()).resolves.toEqual({ source: 'disabled' });
    });

    it('keeps the old shared bot when Telegram rejects the new token', async () => {
      getMeAnswers(401, { ok: false, description: 'Unauthorized' });

      await expect(
        createService().saveInstanceTelegramSettings(user, { botToken: '4:wrong' }),
      ).rejects.toThrow('Unauthorized');
      expect(instanceRepository.save).not.toHaveBeenCalled();
    });
  });

  it('preserves an existing SMTP password when the password field is blank', async () => {
    await createService().saveSmtpSettings(user, {
      host: 'mail.example.com',
      port: 587,
      user: 'seneca@example.com',
      pass: 'initial-secret',
      from: `${APP_NAME} <noreply@example.com>`,
    });

    const result = await createService().saveSmtpSettings(user, {
      host: 'mail.example.com',
      port: 587,
      user: 'seneca@example.com',
      pass: '',
      from: `${APP_NAME} <noreply@example.com>`,
    });

    expect(result.settings.passConfigured).toBe(true);
    expect(result.settings).not.toHaveProperty('pass');
    expect(assertPublicEgressHost).toHaveBeenCalledWith('mail.example.com');
  });

  it('tests a workspace SMTP server on the address that passed the egress check', async () => {
    const nodemailer = vi.mocked(nodemailerModule);
    (nodemailer.createTransport as Mock).mockClear();

    await createService().saveSmtpSettings(user, {
      host: 'mail.example.com',
      port: 587,
      from: `${APP_NAME} <noreply@example.com>`,
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: '198.51.100.7', servername: 'mail.example.com' }),
    );
  });

  describe('SMTP server choice', () => {
    const smtpRow = (workspaceId: string, host: string, updatedByUserId: string) => ({
      workspaceId,
      key: WorkspaceServiceSettingsKey.SMTP,
      config: { host, port: 587, from: `noreply@${host}` },
      encryptedSecrets: {},
      updatedByUserId,
    });
    const rows = [
      smtpRow('workspace-1', 'smtp.home.example', 'user-1'),
      smtpRow('workspace-2', 'smtp.other.example', 'admin-2'),
    ];

    beforeEach(() => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_FROM;
      repository.findOne.mockImplementation(
        ({ where }: { where: { workspaceId: string; key: string } }) =>
          Promise.resolve(
            rows.find(row => row.workspaceId === where.workspaceId && row.key === where.key) ??
              null,
          ),
      );
    });

    it('uses the server of the workspace it is given', async () => {
      const smtp = await createService().getSmtpSettings('workspace-2');

      expect(smtp).toMatchObject({ host: 'smtp.other.example', source: 'workspace' });
    });

    it('falls back to the environment, never to a home workspace, without one', async () => {
      process.env.SMTP_HOST = 'relay.internal';
      process.env.SMTP_FROM = 'noreply@instance.example';

      const smtp = await createService().getSmtpSettings(null);

      expect(smtp).toMatchObject({ host: 'relay.internal', source: 'env' });
    });

    it('sends account mail through the home workspace server the user saved', async () => {
      const smtp = await createService().getAccountSmtpSettings({
        id: 'user-1',
        workspaceId: 'workspace-1',
      });

      expect(smtp).toMatchObject({ host: 'smtp.home.example', source: 'workspace' });
    });

    // Another admin of the home workspace could point its SMTP at a server they
    // read and collect the user's password-reset link.
    it("does not send account mail through a server someone else saved", async () => {
      const smtp = await createService().getAccountSmtpSettings({
        id: 'user-1',
        workspaceId: 'workspace-2',
      });

      expect(smtp).toMatchObject({ host: null, source: 'disabled' });
    });
  });

  it('writes to the workspace of the request, not the one the user registered with', async () => {
    const service = createService();

    await service.saveAppSettings(user, { publicUrl: 'https://b.example.com' }, 'workspace-2');
    await service.disconnect(user, WorkspaceServiceSettingsKey.TELEGRAM, 'workspace-2');

    expect(saved[WorkspaceServiceSettingsKey.APP]).toMatchObject({ workspaceId: 'workspace-2' });
    expect(repository.delete).toHaveBeenCalledWith({
      workspaceId: 'workspace-2',
      key: WorkspaceServiceSettingsKey.TELEGRAM,
    });
  });

  it('deletes workspace settings on disconnect', async () => {
    await createService().disconnect(user, WorkspaceServiceSettingsKey.TELEGRAM);

    expect(repository.delete).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      key: WorkspaceServiceSettingsKey.TELEGRAM,
    });
  });
});
