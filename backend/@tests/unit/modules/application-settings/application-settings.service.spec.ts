jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue(true),
  })),
}));
jest.mock('../../../../src/common/utils/egress-url.util', () => ({
  assertPublicEgressHost: jest.fn().mockResolvedValue(undefined),
  assertPublicEgressUrl: jest.fn().mockResolvedValue(new URL('https://example.com')),
  // Egress policy is covered by common/utils/egress-url.util.spec.ts; here the
  // provider hostnames are fixtures that no DNS server can resolve.
  fetchPublicUrl: (url: string, init: RequestInit) => fetch(url, init),
}));

const mockCategorize = jest.fn();
const mockGetModelLoadError = jest.fn();
const mockTransactionCategorizerConstructor = jest.fn();

jest.mock('../../../../src/modules/classification/helpers/transaction-categorizer', () => ({
  TransactionCategorizer: jest.fn().mockImplementation(options => {
    mockTransactionCategorizerConstructor(options);
    return {
      categorize: mockCategorize,
      getModelLoadError: mockGetModelLoadError,
    };
  }),
}));

import { ApplicationSettingsService } from '../../../../src/modules/application-settings/application-settings.service';
import { WorkspaceServiceSettingsKey } from '../../../../src/entities';
import {
  assertPublicEgressHost,
  assertPublicEgressUrl,
} from '../../../../src/common/utils/egress-url.util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EffectRuntime } from '@/common/effect/effect-runtime';
import { encryptText } from '@/common/utils/encryption.util';

describe('ApplicationSettingsService', () => {
  const originalEnv = process.env;
  const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;
  const saved: Record<string, unknown> = {};
  const repository = {
    findOne: jest.fn(),
    create: jest.fn(input => input),
    save: jest.fn(async entity => {
      saved[String(entity.key)] = entity;
      return entity;
    }),
    delete: jest.fn(),
  };

  let personalSaved: Record<string, unknown> | null = null;
  const personalRepository = {
    findOne: jest.fn(async () => personalSaved),
    create: jest.fn(input => input),
    save: jest.fn(async entity => {
      personalSaved = entity;
      return entity;
    }),
    delete: jest.fn(),
  };

  let instanceSaved: Record<string, unknown> | null = null;
  const instanceRepository = {
    findOne: jest.fn(async () => instanceSaved),
    create: jest.fn(input => input),
    save: jest.fn(async entity => {
      instanceSaved = entity;
      return entity;
    }),
    delete: jest.fn(async () => {
      instanceSaved = null;
    }),
  };

  const createService = () =>
    new ApplicationSettingsService(
      repository as never,
      personalRepository as never,
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
    mockCategorize.mockReset();
    mockGetModelLoadError.mockReset();
    mockTransactionCategorizerConstructor.mockClear();
    (assertPublicEgressHost as jest.Mock).mockResolvedValue(undefined);
    (assertPublicEgressUrl as jest.Mock).mockResolvedValue(new URL('https://example.com'));
    (assertPublicEgressHost as jest.Mock).mockClear();
    (assertPublicEgressUrl as jest.Mock).mockClear();
    Object.keys(saved).forEach(key => delete saved[key]);
    personalSaved = null;
    instanceSaved = null;
    instanceRepository.save.mockClear();
    personalRepository.findOne.mockClear();
    personalRepository.save.mockClear();
    personalRepository.delete.mockClear();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ ok: true }),
    }) as never;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('saves AI settings without returning the API key', async () => {
    const result = await createService().saveAiSettings(user, {
      baseUrl: 'http://localhost:11434/',
      model: 'llama3.1',
      apiKey: 'secret-key',
      timeoutMs: 15000,
    });

    expect(result.connected).toBe(true);
    expect(result.settings).toMatchObject({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      apiKeyConfigured: true,
    });
    expect(result.settings).not.toHaveProperty('apiKey');
    expect(assertPublicEgressUrl).toHaveBeenCalledWith('http://localhost:11434');
    expect(saved[WorkspaceServiceSettingsKey.AI]).toMatchObject({
      workspaceId: 'workspace-1',
      key: WorkspaceServiceSettingsKey.AI,
    });
  });

  it('saves a personal AI key scoped to the member and workspace', async () => {
    const result = await createService().savePersonalAiSettings(user, {
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4.1-mini',
      apiKey: 'sk-personal',
    });

    expect(result.connected).toBe(true);
    expect(result.source).toBe('personal');
    expect(result.settings).toMatchObject({ model: 'gpt-4.1-mini', apiKeyConfigured: true });
    expect(result.settings).not.toHaveProperty('apiKey');
    expect(personalSaved).toMatchObject({ userId: 'user-1', workspaceId: 'workspace-1' });
  });

  it('prefers a personal key over the workspace provider in chat mode', async () => {
    const service = createService();
    await service.saveAiSettings(user, { baseUrl: 'https://llm.example.com', model: 'shared' });
    await service.savePersonalAiSettings(user, {
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4.1-mini',
      apiKey: 'sk-personal',
    });

    const runtime = await service.getAiSettingsForChat('workspace-1', 'user-1');

    expect(runtime).toMatchObject({ model: 'gpt-4.1-mini', source: 'personal' });
  });

  it('falls back to the workspace provider when the personal key is switched off', async () => {
    const service = createService();
    await service.saveAiSettings(user, { baseUrl: 'https://llm.example.com', model: 'shared' });
    await service.savePersonalAiSettings(user, {
      baseUrl: 'https://api.openai.com',
      model: 'gpt-4.1-mini',
      apiKey: 'sk-personal',
      enabled: false,
    });

    const runtime = await service.getAiSettingsForChat('workspace-1', 'user-1');

    expect(runtime).toMatchObject({ model: 'shared', source: 'workspace' });
  });

  it('probes Anthropic with its own protocol when validating a connection', async () => {
    await createService().savePersonalAiSettings(user, {
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-opus-5',
      apiKey: 'sk-ant',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });

  describe('Telegram connection check', () => {
    const botToken = '123456:abc-DEF_ghi';
    const telegramAnswer = (status: number, body: unknown) =>
      (global.fetch as jest.Mock).mockImplementation(
        async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'content-type': 'application/json' },
          }),
      );

    it('saves the bot token once getMe accepts it', async () => {
      telegramAnswer(200, { ok: true, result: { id: 1 } });

      await createService().saveTelegramSettings(user, { botToken, timeoutMs: 1000 });

      const [input] = (global.fetch as jest.Mock).mock.calls[0];
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
      (global.fetch as jest.Mock).mockRejectedValue(new Error('connect ECONNREFUSED'));

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
        find: jest.fn(async () => [row('ws-a', '2:a'), row('ws-b', '1:env'), row('ws-c', null)]),
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
      Object.assign(repository, { find: jest.fn(async () => [broken, row('ws-b', '3:b')]) });
      repository.findOne.mockResolvedValue(null);

      await expect(createService().listTelegramBots()).resolves.toEqual([
        { botToken: '3:b', publicUrl: 'http://127.0.0.1:3000' },
      ]);
    });

    it('lists the bot an instance admin saved as the shared one, instead of TELEGRAM_BOT_TOKEN', async () => {
      process.env.TELEGRAM_BOT_TOKEN = '1:env';
      instanceSaved = { key: 'telegram', encryptedSecrets: { botToken: encryptText('4:shared') } };
      Object.assign(repository, { find: jest.fn(async () => []) });

      await expect(createService().listTelegramBots()).resolves.toEqual([
        { botToken: '4:shared', publicUrl: 'http://127.0.0.1:3000' },
      ]);
    });
  });

  describe('shared Telegram bot', () => {
    const getMeAnswers = (status: number, body: unknown) =>
      (global.fetch as jest.Mock).mockImplementation(
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
      const [input] = (global.fetch as jest.Mock).mock.calls[0];
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
      user: 'lumio@example.com',
      pass: 'initial-secret',
      from: 'Lumio <noreply@example.com>',
    });

    const result = await createService().saveSmtpSettings(user, {
      host: 'mail.example.com',
      port: 587,
      user: 'lumio@example.com',
      pass: '',
      from: 'Lumio <noreply@example.com>',
    });

    expect(result.settings.passConfigured).toBe(true);
    expect(result.settings).not.toHaveProperty('pass');
    expect(assertPublicEgressHost).toHaveBeenCalledWith('mail.example.com');
  });

  it('writes to the workspace of the request, not the one the user registered with', async () => {
    const service = createService();

    await service.saveAppSettings(user, { publicUrl: 'https://b.example.com' }, 'workspace-2');
    await service.savePersonalAiSettings(
      user,
      { baseUrl: 'https://api.openai.com', model: 'gpt-4.1-mini', apiKey: 'sk-personal' },
      'workspace-2',
    );
    await service.disconnect(user, WorkspaceServiceSettingsKey.TELEGRAM, 'workspace-2');

    expect(saved[WorkspaceServiceSettingsKey.APP]).toMatchObject({ workspaceId: 'workspace-2' });
    expect(personalSaved).toMatchObject({ userId: 'user-1', workspaceId: 'workspace-2' });
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

  it('saves local categorization settings without requiring a manual model path', async () => {
    const result = await createService().saveLocalCategorizationSettings(user, {
      enabled: true,
      modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      threshold: 0.42,
    });

    expect(result.connected).toBe(false);
    expect(result.settings).toMatchObject({
      enabled: true,
      modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      threshold: 0.42,
      modelInstalled: false,
    });
    expect(saved[WorkspaceServiceSettingsKey.LOCAL_CATEGORIZATION]).toMatchObject({
      workspaceId: 'workspace-1',
      key: WorkspaceServiceSettingsKey.LOCAL_CATEGORIZATION,
    });
  });

  it('tests local categorization with the saved local model path', async () => {
    await createService().saveLocalCategorizationSettings(user, {
      enabled: true,
      modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
      threshold: 0.35,
      localModelPath: '/tmp/lumio-models',
    });
    mockCategorize.mockResolvedValue('Продукты');
    mockGetModelLoadError.mockReturnValue(null);

    const result = await createService().testLocalCategorization(user, {
      merchantName: 'Fresh Market',
      categories: ['Продукты', 'Транспорт'],
    });

    expect(result).toEqual({
      ready: true,
      merchantName: 'Fresh Market',
      category: 'Продукты',
      modelLoadError: null,
    });
    expect(mockTransactionCategorizerConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['Продукты', 'Транспорт'],
        threshold: 0.35,
        allowRemoteModels: false,
        localModelPath: '/tmp/lumio-models',
      }),
    );
  });

  it('installs a local categorization model archive into workspace storage', async () => {
    const AdmZip = require('adm-zip');
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'lumio-model-test-'));
    process.env.LOCAL_CATEGORIZATION_MODEL_ROOT = tempRoot;

    const zip = new AdmZip();
    zip.addFile('model/config.json', Buffer.from('{}'));
    zip.addFile('model/tokenizer.json', Buffer.from('{}'));
    zip.addFile('model/onnx/model_quantized.onnx', Buffer.from('fake-onnx'));

    const result = await createService().installLocalCategorizationModel(user, {
      originalname: 'model.zip',
      buffer: zip.toBuffer(),
    } as never);

    expect(result.connected).toBe(true);
    expect(result.settings.modelInstalled).toBe(true);
    expect(result.settings.localModelPath).toBe(tempRoot);

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
