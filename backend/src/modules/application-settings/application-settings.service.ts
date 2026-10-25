import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import AdmZip = require('adm-zip');

import { Effect, Schema } from 'effect';
import { HttpClientResponse } from 'effect/http';
import nodemailer from 'nodemailer';
import type { Repository } from 'typeorm';
import { EffectRuntime } from '../../common/effect/effect-runtime';
import { getWith } from '../../common/effect/http-json';
import { appError } from '../../common/errors/app-error';
import { assertPublicEgressHost, pinPublicEgressHost } from '../../common/utils/egress-url.util';
import { decryptText, encryptText } from '../../common/utils/encryption.util';
import type {
  SaveAppSettingsBody,
  SaveInstanceTelegramBotBody,
  SaveLocalCategorizationBody,
  SaveSmtpSettingsBody,
  SaveTelegramSettingsBody,
  TestLocalCategorizationBody,
} from '../../contracts';
import {
  InstanceSetting,
  InstanceSettingKey,
  User,
  WorkspaceServiceSettings,
  WorkspaceServiceSettingsKey,
} from '../../entities';
import { TransactionCategorizer } from '../classification/helpers/transaction-categorizer';

/** Telegram's `getMe`: `ok` false with a description for a bad token. */
const TelegramGetMeResponse = Schema.Struct({
  ok: Schema.Boolean,
  description: Schema.optional(Schema.String),
});

export type LocalCategorizationRuntimeSettings = {
  enabled: boolean;
  modelId: string;
  threshold: number;
  localModelPath: string | null;
  source: 'workspace' | 'env' | 'disabled';
};

export type SmtpRuntimeSettings = {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string | null;
  replyTo: string | null;
  timeoutMs: number;
  source: 'workspace' | 'env' | 'disabled';
};

/**
 * Where an SMTP transport for `host` connects. A host from a workspace's
 * settings is user input: it was checked when saved and is resolved and checked
 * again here, so the socket goes to the address that passed (DNS rebinding).
 * The SMTP_* env host is the operator's own and may be a private relay.
 */
export function smtpConnectTarget(
  smtp: SmtpRuntimeSettings | null | undefined,
  host: string,
): Promise<{ host: string; servername?: string }> {
  const workspaceHost =
    smtp?.source !== 'env' && smtp?.host === host && host !== process.env.SMTP_HOST;
  return workspaceHost ? pinPublicEgressHost(host) : Promise.resolve({ host });
}

export type TelegramRuntimeSettings = {
  botToken: string | null;
  timeoutMs: number;
  /** `instance`: the shared bot an instance admin saved; `env`: TELEGRAM_BOT_TOKEN. */
  source: 'workspace' | 'instance' | 'env' | 'disabled';
};

export type AppRuntimeSettings = {
  publicUrl: string | null;
  source: 'workspace' | 'env' | 'disabled';
};

type UploadedModelArchive = {
  originalname?: string;
  buffer?: Buffer;
};

const DEFAULT_LOCAL_CATEGORIZATION_MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const DEFAULT_LOCAL_CATEGORIZATION_THRESHOLD = 0.35;
const DEFAULT_LOCAL_CATEGORIZATION_CATEGORIES = [
  'Продукты',
  'Транспорт',
  'Развлечения',
  'Здоровье',
  'Коммунальные услуги',
];

// The upload itself is capped at 500MB compressed (see the controller). These
// bound what that is allowed to become once expanded.
const MAX_MODEL_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_MODEL_ARCHIVE_ENTRIES = 10_000;

@Injectable()
export class ApplicationSettingsService {
  constructor(
    @InjectRepository(WorkspaceServiceSettings)
    private readonly settingsRepository: Repository<WorkspaceServiceSettings>,
    private readonly effects: EffectRuntime,
    @InjectRepository(InstanceSetting)
    private readonly instanceSettingsRepository: Repository<InstanceSetting>,
  ) {}

  async getSmtpStatus(user: User, requestWorkspaceId?: string) {
    const settings = await this.findSettings(
      user,
      WorkspaceServiceSettingsKey.SMTP,
      requestWorkspaceId,
    );
    const runtime = await this.getSmtpSettings(this.requireWorkspaceId(user, requestWorkspaceId));
    return {
      connected: runtime.source !== 'disabled',
      status: runtime.source !== 'disabled' ? 'connected' : 'disconnected',
      source: runtime.source,
      settings: {
        host: runtime.host,
        port: runtime.port,
        secure: runtime.secure,
        user: runtime.user,
        from: runtime.from,
        replyTo: runtime.replyTo,
        timeoutMs: runtime.timeoutMs,
        passConfigured: Boolean(settings?.encryptedSecrets?.pass || process.env.SMTP_PASS),
      },
    };
  }

  async saveSmtpSettings(user: User, input: SaveSmtpSettingsBody, requestWorkspaceId?: string) {
    const existing = await this.findSettings(
      user,
      WorkspaceServiceSettingsKey.SMTP,
      requestWorkspaceId,
    );
    const config = {
      host: this.requiredString(input.host, 'host'),
      port: this.positiveNumber(input.port, 587),
      secure: this.booleanValue(input.secure, false),
      user: this.stringValue(input.user),
      from: this.requiredString(input.from, 'from'),
      replyTo: this.stringValue(input.replyTo),
      timeoutMs: this.positiveNumber(input.timeoutMs, 10000),
    };
    const secrets = this.mergeSecrets(existing, ['pass'], input);
    const runtime = this.smtpRuntimeFromParts(config, secrets, 'workspace');
    await assertPublicEgressHost(runtime.host ?? '');
    await this.assertSmtpConnection(runtime);
    await this.saveSettings(
      user,
      WorkspaceServiceSettingsKey.SMTP,
      config,
      secrets,
      requestWorkspaceId,
    );
    return this.getSmtpStatus(user, requestWorkspaceId);
  }

  async getTelegramStatus(user: User, requestWorkspaceId?: string) {
    const settings = await this.findSettings(
      user,
      WorkspaceServiceSettingsKey.TELEGRAM,
      requestWorkspaceId,
    );
    const runtime = await this.getTelegramSettings(user, requestWorkspaceId);
    const shared = await this.getSharedTelegramSettings();
    return {
      connected: runtime.source !== 'disabled',
      status: runtime.source !== 'disabled' ? 'connected' : 'disconnected',
      source: runtime.source,
      settings: {
        timeoutMs: runtime.timeoutMs,
        botTokenConfigured: Boolean(settings?.encryptedSecrets?.botToken || shared.botToken),
        sharedBot: shared.source !== 'disabled',
      },
    };
  }

  /** The shared bot, for the instance admin's settings: never the token itself. */
  async getInstanceTelegramStatus() {
    const shared = await this.getSharedTelegramSettings();
    return { source: shared.source };
  }

  /** Saves the shared bot every workspace without its own token uses, once getMe accepts it. */
  async saveInstanceTelegramSettings(user: User, input: SaveInstanceTelegramBotBody) {
    const timeoutMs = this.positiveNumber(process.env.TELEGRAM_TIMEOUT_MS, 10000);
    await this.assertTelegramConnection({
      botToken: input.botToken,
      timeoutMs,
      source: 'instance',
    });
    const existing = await this.instanceSettingsRepository.findOne({
      where: { key: InstanceSettingKey.TELEGRAM },
    });
    await this.instanceSettingsRepository.save(
      this.instanceSettingsRepository.create({
        ...existing,
        key: InstanceSettingKey.TELEGRAM,
        encryptedSecrets: this.encryptSecrets({ botToken: input.botToken }),
        updatedByUserId: user.id,
      }),
    );
    return this.getInstanceTelegramStatus();
  }

  /** Removes the saved shared bot; TELEGRAM_BOT_TOKEN, if set, takes over again. */
  async clearInstanceTelegramSettings() {
    await this.instanceSettingsRepository.delete({ key: InstanceSettingKey.TELEGRAM });
    return this.getInstanceTelegramStatus();
  }

  async saveTelegramSettings(
    user: User,
    input: SaveTelegramSettingsBody,
    requestWorkspaceId?: string,
  ) {
    const existing = await this.findSettings(
      user,
      WorkspaceServiceSettingsKey.TELEGRAM,
      requestWorkspaceId,
    );
    const config = {
      timeoutMs: this.positiveNumber(input.timeoutMs, 10000),
    };
    const secrets = this.mergeSecrets(existing, ['botToken'], input);
    const runtime = this.telegramRuntimeFromParts(config, secrets, 'workspace');
    await this.assertTelegramConnection(runtime);
    await this.saveSettings(
      user,
      WorkspaceServiceSettingsKey.TELEGRAM,
      config,
      secrets,
      requestWorkspaceId,
    );
    return this.getTelegramStatus(user, requestWorkspaceId);
  }

  async getAppStatus(user: User, requestWorkspaceId?: string) {
    const runtime = await this.getAppSettings(this.requireWorkspaceId(user, requestWorkspaceId));
    return {
      connected: runtime.source !== 'disabled',
      status: runtime.source !== 'disabled' ? 'connected' : 'disconnected',
      source: runtime.source,
      settings: {
        publicUrl: runtime.publicUrl,
      },
    };
  }

  async saveAppSettings(user: User, input: SaveAppSettingsBody, requestWorkspaceId?: string) {
    const publicUrl = this.normalizeOrigin(this.requiredString(input.publicUrl, 'publicUrl'));
    await this.saveSettings(
      user,
      WorkspaceServiceSettingsKey.APP,
      { publicUrl },
      {},
      requestWorkspaceId,
    );
    return this.getAppStatus(user, requestWorkspaceId);
  }

  async disconnect(user: User, key: WorkspaceServiceSettingsKey, requestWorkspaceId?: string) {
    const workspaceId = this.requireWorkspaceId(user, requestWorkspaceId);
    await this.settingsRepository.delete({ workspaceId, key });
    return { ok: true };
  }

  async getLocalCategorizationStatus(user: User, requestWorkspaceId?: string) {
    const runtime = await this.getLocalCategorizationSettings(user, requestWorkspaceId);
    const modelInstalled = runtime.localModelPath
      ? await this.hasLocalCategorizationModelFiles(runtime.localModelPath, runtime.modelId)
      : false;

    return {
      connected: runtime.enabled && modelInstalled,
      status: runtime.enabled && modelInstalled ? 'connected' : 'disconnected',
      source: runtime.source,
      settings: {
        enabled: runtime.enabled,
        modelId: runtime.modelId,
        threshold: runtime.threshold,
        localModelPath: runtime.localModelPath,
        modelInstalled,
      },
    };
  }

  async saveLocalCategorizationSettings(
    user: User,
    input: SaveLocalCategorizationBody,
    requestWorkspaceId?: string,
  ) {
    const existing = await this.findSettings(
      user,
      WorkspaceServiceSettingsKey.LOCAL_CATEGORIZATION,
      requestWorkspaceId,
    );
    const previous = existing
      ? this.localCategorizationRuntimeFromParts(existing.config, 'workspace')
      : null;
    const config = {
      enabled: this.booleanValue(input.enabled, previous?.enabled ?? true),
      modelId:
        this.stringValue(input.modelId) ||
        previous?.modelId ||
        DEFAULT_LOCAL_CATEGORIZATION_MODEL_ID,
      threshold: this.thresholdValue(input.threshold, previous?.threshold),
      // Set only by installing a model; never taken from the request.
      localModelPath: previous?.localModelPath || null,
    };

    await this.saveSettings(
      user,
      WorkspaceServiceSettingsKey.LOCAL_CATEGORIZATION,
      config,
      {},
      requestWorkspaceId,
    );
    return this.getLocalCategorizationStatus(user, requestWorkspaceId);
  }

  async installLocalCategorizationModel(
    user: User,
    file: UploadedModelArchive | undefined,
    requestWorkspaceId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException(appError('APP_SETTINGS_MODEL_ARCHIVE_REQUIRED'));
    }

    const existing = await this.getLocalCategorizationSettings(user, requestWorkspaceId);
    const modelId = existing.modelId || DEFAULT_LOCAL_CATEGORIZATION_MODEL_ID;
    const modelRoot = this.getLocalCategorizationModelRoot();
    const targetDir = this.resolveLocalModelDirectory(modelRoot, modelId);
    const stagingDir = path.join(os.tmpdir(), `seneca-model-${randomUUID()}`);

    try {
      await fs.mkdir(stagingDir, { recursive: true });
      await this.extractZipBuffer(file.buffer, stagingDir);
      const modelSourceDir = await this.findExtractedModelDirectory(stagingDir);

      await fs.rm(targetDir, { recursive: true, force: true });
      await fs.mkdir(path.dirname(targetDir), { recursive: true });
      await fs.cp(modelSourceDir, targetDir, { recursive: true });
    } finally {
      await fs.rm(stagingDir, { recursive: true, force: true });
    }

    await this.saveSettings(
      user,
      WorkspaceServiceSettingsKey.LOCAL_CATEGORIZATION,
      { enabled: true, modelId, threshold: existing.threshold, localModelPath: modelRoot },
      {},
      requestWorkspaceId,
    );

    return this.getLocalCategorizationStatus(user, requestWorkspaceId);
  }

  async testLocalCategorization(
    user: User,
    input: TestLocalCategorizationBody,
    requestWorkspaceId?: string,
  ) {
    const runtime = await this.getLocalCategorizationSettings(user, requestWorkspaceId);
    const merchantName = this.requiredString(input.merchantName, 'merchantName');
    const categories = this.stringArrayValue(input.categories);
    const categorizer = new TransactionCategorizer({
      categories: categories.length ? categories : DEFAULT_LOCAL_CATEGORIZATION_CATEGORIES,
      threshold: runtime.threshold,
      modelId: runtime.modelId,
      allowRemoteModels: false,
      localModelPath: runtime.localModelPath || undefined,
    });
    const category = await categorizer.categorize(merchantName);
    const modelLoadError = categorizer.getModelLoadError();

    return {
      ready: !modelLoadError,
      merchantName,
      category,
      modelLoadError: modelLoadError?.message || null,
    };
  }

  async getLocalCategorizationSettings(
    user?: User | null,
    requestWorkspaceId?: string,
  ): Promise<LocalCategorizationRuntimeSettings> {
    const workspace = user
      ? await this.findSettings(
          user,
          WorkspaceServiceSettingsKey.LOCAL_CATEGORIZATION,
          requestWorkspaceId,
        )
      : null;
    if (workspace) {
      return this.localCategorizationRuntimeFromParts(workspace.config, 'workspace');
    }

    const env = {
      enabled: process.env.LOCAL_CATEGORIZATION_ENABLED !== 'false',
      modelId: process.env.LOCAL_CATEGORIZATION_MODEL_ID || DEFAULT_LOCAL_CATEGORIZATION_MODEL_ID,
      threshold: this.thresholdValue(process.env.LOCAL_CATEGORIZATION_THRESHOLD),
      localModelPath: process.env.LOCAL_CATEGORIZATION_MODEL_PATH || null,
    };
    return {
      ...env,
      source: env.enabled && env.localModelPath ? 'env' : 'disabled',
    };
  }

  /**
   * The SMTP server of `workspaceId`, the workspace the mail is about, else the
   * SMTP_* env vars. There is deliberately no fallback to a user's home
   * workspace: that is another tenant's server for mail about this one.
   */
  async getSmtpSettings(workspaceId: string | null): Promise<SmtpRuntimeSettings> {
    const workspace = workspaceId
      ? await this.settingsRepository.findOne({
          where: { workspaceId, key: WorkspaceServiceSettingsKey.SMTP },
        })
      : null;
    return this.smtpRuntimeOf(workspace);
  }

  /**
   * SMTP for mail about the account itself (password reset, e-mail change): the
   * server of the user's home workspace only when the user saved it, else the
   * SMTP_* env vars. Any other admin of that workspace could point its SMTP at
   * a server they read and collect the user's password-reset link.
   */
  async getAccountSmtpSettings(
    user: Pick<User, 'id' | 'workspaceId'>,
  ): Promise<SmtpRuntimeSettings> {
    const workspace = user.workspaceId
      ? await this.settingsRepository.findOne({
          where: { workspaceId: user.workspaceId, key: WorkspaceServiceSettingsKey.SMTP },
        })
      : null;
    return this.smtpRuntimeOf(workspace?.updatedByUserId === user.id ? workspace : null);
  }

  private smtpRuntimeOf(workspace: WorkspaceServiceSettings | null): SmtpRuntimeSettings {
    if (workspace) {
      return this.smtpRuntimeFromParts(
        workspace.config,
        this.decryptSecrets(workspace.encryptedSecrets),
        'workspace',
      );
    }

    const env = {
      host: process.env.SMTP_HOST || null,
      port: this.positiveNumber(process.env.SMTP_PORT, 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
      from: process.env.SMTP_FROM || null,
      replyTo: process.env.SMTP_REPLY_TO || null,
      timeoutMs: this.positiveNumber(process.env.SMTP_TIMEOUT_MS, 10000),
    };
    return env.host && env.from ? { ...env, source: 'env' } : { ...env, source: 'disabled' };
  }

  async getTelegramSettings(
    user?: User | null,
    requestWorkspaceId?: string,
  ): Promise<TelegramRuntimeSettings> {
    const workspace = user
      ? await this.findSettings(user, WorkspaceServiceSettingsKey.TELEGRAM, requestWorkspaceId)
      : null;
    if (workspace) {
      const runtime = this.telegramRuntimeFromParts(
        workspace.config,
        this.decryptSecrets(workspace.encryptedSecrets),
        'workspace',
      );
      // A workspace row without a token (only a timeout) falls through to the shared bot.
      if (runtime.botToken) {
        return runtime;
      }
    }
    return this.getSharedTelegramSettings();
  }

  /**
   * The bot of every workspace without its own: the one an instance admin
   * saved, else TELEGRAM_BOT_TOKEN.
   */
  async getSharedTelegramSettings(): Promise<TelegramRuntimeSettings> {
    const timeoutMs = this.positiveNumber(process.env.TELEGRAM_TIMEOUT_MS, 10000);
    const saved = await this.instanceSettingsRepository.findOne({
      where: { key: InstanceSettingKey.TELEGRAM },
    });
    let savedToken: string | undefined;
    try {
      savedToken = saved ? this.decryptSecrets(saved.encryptedSecrets).botToken : undefined;
    } catch {
      // Encrypted under another key: unusable, so the environment's bot (if any) serves.
    }
    if (savedToken) {
      return { botToken: savedToken, timeoutMs, source: 'instance' };
    }
    const envToken = process.env.TELEGRAM_BOT_TOKEN || null;
    return { botToken: envToken, timeoutMs, source: envToken ? 'env' : 'disabled' };
  }

  /**
   * Every bot this server answers for: the shared bot and each workspace's own
   * token, once per token. A bot comes with the public URL of
   * its workspace, which is where Telegram has to deliver the bot's updates.
   */
  async listTelegramBots(): Promise<Array<{ botToken: string; publicUrl: string | null }>> {
    const envPublicUrl = (await this.getAppSettings()).publicUrl;
    const bots = new Map<string, string | null>();
    const shared = await this.getSharedTelegramSettings();
    if (shared.botToken) {
      bots.set(shared.botToken, envPublicUrl);
    }

    const rows = await this.settingsRepository.find({
      where: { key: WorkspaceServiceSettingsKey.TELEGRAM },
    });
    for (const row of rows) {
      let botToken: string | null;
      try {
        botToken = this.decryptSecrets(row.encryptedSecrets).botToken || null;
      } catch {
        // A token encrypted under another key cannot be used; the others still can.
        continue;
      }
      if (!botToken || bots.has(botToken)) {
        continue;
      }
      const app = await this.settingsRepository.findOne({
        where: { workspaceId: row.workspaceId, key: WorkspaceServiceSettingsKey.APP },
      });
      bots.set(botToken, this.stringValue(app?.config.publicUrl) || envPublicUrl);
    }

    return [...bots].map(([botToken, publicUrl]) => ({ botToken, publicUrl }));
  }

  /** The public URL of `workspaceId`, else APP_URL/FRONTEND_URL. */
  async getAppSettings(workspaceId?: string | null): Promise<AppRuntimeSettings> {
    const workspace = workspaceId
      ? await this.settingsRepository.findOne({
          where: { workspaceId, key: WorkspaceServiceSettingsKey.APP },
        })
      : null;
    if (workspace) {
      const publicUrl = this.stringValue(workspace.config.publicUrl);
      return publicUrl
        ? { publicUrl, source: 'workspace' }
        : { publicUrl: null, source: 'disabled' };
    }

    const publicUrl = this.normalizeOrigin(process.env.APP_URL || process.env.FRONTEND_URL || '');
    return publicUrl ? { publicUrl, source: 'env' } : { publicUrl: null, source: 'disabled' };
  }

  private async findSettings(
    user: User,
    key: WorkspaceServiceSettingsKey,
    requestWorkspaceId?: string,
  ) {
    const workspaceId = this.requireWorkspaceId(user, requestWorkspaceId);
    return this.settingsRepository.findOne({ where: { workspaceId, key } });
  }

  private async saveSettings(
    user: User,
    key: WorkspaceServiceSettingsKey,
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    requestWorkspaceId?: string,
  ) {
    const workspaceId = this.requireWorkspaceId(user, requestWorkspaceId);
    const existing = await this.settingsRepository.findOne({ where: { workspaceId, key } });
    const entity =
      existing ||
      this.settingsRepository.create({
        workspaceId,
        key,
      });
    entity.config = config;
    entity.encryptedSecrets = this.encryptSecrets(secrets);
    entity.updatedByUserId = user.id;
    await this.settingsRepository.save(entity);
  }

  private encryptSecrets(secrets: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(secrets)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, encryptText(value)]),
    );
  }

  private mergeSecrets(
    existing: { encryptedSecrets: Record<string, string> } | null,
    keys: string[],
    // `object`, not `Record<string, unknown>`: the callers now pass validated
    // DTO instances, and a class instance has no index signature.
    input: object,
  ): Record<string, string> {
    const source = input as Record<string, unknown>;
    const previous = this.decryptSecrets(existing?.encryptedSecrets || {});
    const next: Record<string, string> = {};
    for (const key of keys) {
      const incoming = this.stringValue(source[key]);
      next[key] = incoming === undefined || incoming === '' ? previous[key] || '' : incoming;
    }
    return next;
  }

  private decryptSecrets(encryptedSecrets: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(encryptedSecrets || {}).map(([key, value]) => [key, decryptText(value)]),
    );
  }

  private smtpRuntimeFromParts(
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    source: SmtpRuntimeSettings['source'],
  ): SmtpRuntimeSettings {
    const host = this.stringValue(config.host) || null;
    const from = this.stringValue(config.from) || null;
    return {
      host,
      port: this.positiveNumber(config.port, 587),
      secure: this.booleanValue(config.secure, false),
      user: this.stringValue(config.user) || null,
      pass: secrets.pass || null,
      from,
      replyTo: this.stringValue(config.replyTo) || null,
      timeoutMs: this.positiveNumber(config.timeoutMs, 10000),
      source: host && from ? source : 'disabled',
    };
  }

  private telegramRuntimeFromParts(
    config: Record<string, unknown>,
    secrets: Record<string, string>,
    source: TelegramRuntimeSettings['source'],
  ): TelegramRuntimeSettings {
    const botToken = secrets.botToken || null;
    return {
      botToken,
      timeoutMs: this.positiveNumber(config.timeoutMs, 10000),
      source: botToken ? source : 'disabled',
    };
  }

  private localCategorizationRuntimeFromParts(
    config: Record<string, unknown>,
    source: LocalCategorizationRuntimeSettings['source'],
  ): LocalCategorizationRuntimeSettings {
    const enabled = this.booleanValue(config.enabled, true);
    // A stored path only says a model was installed; models are always read from
    // the model root, so a path saved through the API before it was refused
    // cannot point the loader at anything else.
    const localModelPath = this.stringValue(config.localModelPath)
      ? this.getLocalCategorizationModelRoot()
      : null;
    return {
      enabled,
      modelId: this.stringValue(config.modelId) || DEFAULT_LOCAL_CATEGORIZATION_MODEL_ID,
      threshold: this.thresholdValue(config.threshold),
      localModelPath,
      source: enabled && localModelPath ? source : 'disabled',
    };
  }

  private getLocalCategorizationModelRoot(): string {
    return (
      process.env.LOCAL_CATEGORIZATION_MODEL_ROOT ||
      path.join(process.cwd(), '.local-models', 'categorization')
    );
  }

  private resolveLocalModelDirectory(modelRoot: string, modelId: string): string {
    const parts = modelId.split('/').filter(Boolean);
    if (
      !parts.length ||
      parts.some(part => part === '.' || part === '..' || path.isAbsolute(part))
    ) {
      throw new BadRequestException(appError('APP_SETTINGS_MODEL_ID_INVALID'));
    }
    return path.join(modelRoot, ...parts);
  }

  private async extractZipBuffer(buffer: Buffer, destination: string): Promise<void> {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw new BadRequestException(appError('APP_SETTINGS_MODEL_ARCHIVE_NOT_ZIP'));
    }

    const entries = zip.getEntries();
    if (entries.length > MAX_MODEL_ARCHIVE_ENTRIES) {
      throw new BadRequestException(appError('APP_SETTINGS_MODEL_ARCHIVE_TOO_MANY_FILES'));
    }

    // A running total of what actually lands on disk, rather than trusting the
    // archive's declared sizes. assertSafeZipDecompressionRatio deliberately
    // passes on ZIP shapes it cannot fully model (ZIP64, streamed entries),
    // which is exactly what large ML archives look like — so the upload path
    // that accepts 500MB needs a cap that holds regardless of archive shape.
    let writtenBytes = 0;

    for (const entry of entries) {
      const normalizedName = path.normalize(entry.entryName);
      if (
        path.isAbsolute(normalizedName) ||
        normalizedName.startsWith('..') ||
        normalizedName.includes(`${path.sep}..${path.sep}`)
      ) {
        throw new BadRequestException(appError('APP_SETTINGS_MODEL_ARCHIVE_UNSAFE_PATHS'));
      }

      const targetPath = path.join(destination, normalizedName);
      if (entry.isDirectory) {
        await fs.mkdir(targetPath, { recursive: true });
        continue;
      }

      const data = entry.getData();
      writtenBytes += data.length;
      if (writtenBytes > MAX_MODEL_UNCOMPRESSED_BYTES) {
        throw new BadRequestException(appError('APP_SETTINGS_MODEL_ARCHIVE_TOO_LARGE'));
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, data);
    }
  }

  private async findExtractedModelDirectory(root: string): Promise<string> {
    const candidates = await this.walkDirectories(root);
    for (const candidate of candidates) {
      if (await this.directoryLooksLikeTransformersModel(candidate)) {
        return candidate;
      }
    }
    throw new BadRequestException(appError('APP_SETTINGS_MODEL_ARCHIVE_INCOMPLETE'));
  }

  private async walkDirectories(root: string): Promise<string[]> {
    const result = [root];
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        result.push(...(await this.walkDirectories(path.join(root, entry.name))));
      }
    }
    return result;
  }

  private async hasLocalCategorizationModelFiles(
    modelRoot: string,
    modelId: string,
  ): Promise<boolean> {
    return this.directoryLooksLikeTransformersModel(
      this.resolveLocalModelDirectory(modelRoot, modelId),
    );
  }

  private async directoryLooksLikeTransformersModel(directory: string): Promise<boolean> {
    try {
      const configPath = path.join(directory, 'config.json');
      await fs.access(configPath);
      const onnxDir = path.join(directory, 'onnx');
      const onnxEntries = await fs.readdir(onnxDir);
      return onnxEntries.some(entry => entry.endsWith('.onnx'));
    } catch {
      return false;
    }
  }

  private async assertSmtpConnection(settings: SmtpRuntimeSettings) {
    if (!(settings.host && settings.from)) {
      throw new BadRequestException(appError('APP_SETTINGS_SMTP_HOST_FROM_REQUIRED'));
    }
    const transporter = nodemailer.createTransport({
      ...(await smtpConnectTarget(settings, settings.host)),
      port: settings.port,
      secure: settings.secure,
      auth:
        settings.user && settings.pass
          ? {
              user: settings.user,
              pass: settings.pass,
            }
          : undefined,
      connectionTimeout: settings.timeoutMs,
      greetingTimeout: settings.timeoutMs,
      socketTimeout: settings.timeoutMs,
    });
    try {
      await transporter.verify();
    } catch {
      throw new BadRequestException(appError('APP_SETTINGS_SMTP_VERIFY_FAILED'));
    }
  }

  private async assertTelegramConnection(settings: TelegramRuntimeSettings) {
    if (!settings.botToken) {
      throw new BadRequestException(appError('APP_SETTINGS_TELEGRAM_TOKEN_REQUIRED'));
    }
    // Bot tokens are "<digits>:<base64url>"; nothing else may shape the request path.
    if (!/^\d+:[\w-]+$/.test(settings.botToken)) {
      throw new BadRequestException(appError('APP_SETTINGS_TELEGRAM_TOKEN_INVALID'));
    }
    const outcome = await this.effects.run(
      getWith(
        `https://api.telegram.org/bot${settings.botToken}/getMe`,
        { timeout: settings.timeoutMs },
        response =>
          HttpClientResponse.schemaBodyJson(TelegramGetMeResponse)(response).pipe(
            Effect.map(payload =>
              response.status >= 200 && response.status < 300 && payload.ok
                ? ({ ok: true } as const)
                : ({ ok: false, description: payload.description } as const),
            ),
          ),
      ).pipe(Effect.catch(() => Effect.succeed({ ok: false, unreachable: true } as const))),
    );
    if ('unreachable' in outcome) {
      throw new BadRequestException(appError('APP_SETTINGS_TELEGRAM_UNREACHABLE'));
    }
    if (!outcome.ok) {
      const reason = outcome.description;
      if (reason) throw new BadRequestException(appError('TELEGRAM_TOKEN_REJECTED', { reason }));
      throw new BadRequestException(appError('APP_SETTINGS_TELEGRAM_TOKEN_INVALID'));
    }
  }

  private requireWorkspaceId(user: User, requestWorkspaceId?: string): string {
    // The workspace open in the request; the user's own only for settings
    // routes called without one. Mail never comes through here: it names its
    // workspace (getSmtpSettings) or is account mail (getAccountSmtpSettings).
    const workspaceId = requestWorkspaceId || user.workspaceId || user.lastWorkspaceId;
    if (!workspaceId) {
      throw new BadRequestException(appError('APP_SETTINGS_WORKSPACE_REQUIRED'));
    }
    return workspaceId;
  }

  private requiredString(value: unknown, name: string): string {
    const text = this.stringValue(value);
    if (!text) {
      throw new BadRequestException(appError('APP_SETTINGS_FIELD_REQUIRED', { field: name }));
    }
    return text;
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' ? value.trim() || undefined : undefined;
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private positiveNumber(value: unknown, fallback: number): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private thresholdValue(
    value: unknown,
    fallback = DEFAULT_LOCAL_CATEGORIZATION_THRESHOLD,
  ): number {
    const parsed =
      typeof value === 'number'
        ? value
        : typeof value === 'string' && value.trim()
          ? Number(value)
          : Number.NaN;
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 1 ? parsed : fallback;
  }

  private stringArrayValue(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean);
  }

  private normalizeOrigin(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
      return new URL(hasScheme ? trimmed : `https://${trimmed}`).origin;
    } catch {
      throw new BadRequestException(appError('APP_SETTINGS_PUBLIC_URL_INVALID'));
    }
  }
}
