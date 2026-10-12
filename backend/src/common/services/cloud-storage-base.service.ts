import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  IntegrationToken,
  Statement,
  User,
  WorkspaceMember,
} from '../../entities';
import { validateFile } from '../utils/file-validator.util';
import { normalizeFilename } from '../utils/filename.util';
import {
  OAuthIntegrationBaseService,
  type OAuthRepositoryLike,
} from './oauth-integration-base.service';

const DEFAULT_SYNC_TIME = '03:00';
const DEFAULT_IMPORT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface CloudStorageSettingsLike {
  integrationId: string;
  folderId: string | null;
  folderName: string | null;
  syncEnabled: boolean;
  syncTime: string;
  timeZone: string | null;
  lastSyncAt: Date | null;
}

type SyncQueryBuilderLike<T> = {
  where(condition: string): SyncQueryBuilderLike<T>;
  orderBy(sort: string, order: 'ASC' | 'DESC'): SyncQueryBuilderLike<T>;
  andWhere(condition: string, params: Record<string, unknown>): SyncQueryBuilderLike<T>;
  getMany(): Promise<T[]>;
};

type RepositoryLike<T> = OAuthRepositoryLike<T> & {
  findOne(args: unknown): Promise<T | null>;
  find?(args: unknown): Promise<T[]>;
  save(entity: T): Promise<T>;
  create(data: Partial<T>): T;
  delete(criteria: unknown): Promise<unknown>;
};

type CloudImportResult = {
  fileId: string;
  status: 'ok' | 'error';
  message?: string;
};

type ImportCandidateValidationResult =
  | { ok: true; safeBaseName: string }
  | { ok: false; result: CloudImportResult };

export abstract class CloudStorageBaseService<
  TSettings extends CloudStorageSettingsLike,
> extends OAuthIntegrationBaseService {
  protected abstract readonly logger: {
    error(message: string, error?: unknown): void;
    warn(message: string): void;
  };

  constructor(
    protected readonly integrationRepository: RepositoryLike<Integration>,
    protected readonly integrationTokenRepository: RepositoryLike<IntegrationToken>,
    protected readonly settingsRepository: RepositoryLike<TSettings>,
    protected readonly userRepository: RepositoryLike<User>,
    workspaceMemberRepository: RepositoryLike<WorkspaceMember>,
  ) {
    super(
      integrationRepository,
      integrationTokenRepository,
      userRepository,
      workspaceMemberRepository,
    );
  }

  protected abstract getProvider(): IntegrationProvider;

  protected abstract getProviderName(): string;

  protected abstract getProviderRouteSegment(): string;

  protected abstract getSettingsRelationName(): keyof Integration;

  protected abstract getFrontendBaseUrl(): string;

  protected abstract createSettingsRecord(integrationId: string): TSettings;

  protected abstract refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt?: Date }>;

  protected abstract getAuthorizationExpiredMessage(): string;

  protected abstract syncIntegration(integration: Integration): Promise<unknown>;

  protected getConnectedSettings(integration: Integration): TSettings | null {
    return (integration[this.getSettingsRelationName()] as unknown as TSettings | null) || null;
  }

  async getStatus(workspaceId: string) {
    const integration = await this.findWorkspaceIntegration(workspaceId);
    if (!integration) {
      return { connected: false, status: IntegrationStatus.DISCONNECTED };
    }

    let status = integration.status;
    if (
      status === IntegrationStatus.CONNECTED &&
      !(integration.token?.refreshToken && integration.token?.accessToken)
    ) {
      status = IntegrationStatus.NEEDS_REAUTH;
    }

    const settings = this.getConnectedSettings(integration);
    return {
      connected: status === IntegrationStatus.CONNECTED,
      status,
      settings: settings
        ? {
            folderId: settings.folderId,
            folderName: settings.folderName,
            syncEnabled: settings.syncEnabled,
            syncTime: settings.syncTime,
            timeZone: settings.timeZone,
            lastSyncAt: settings.lastSyncAt,
          }
        : null,
      scopes: integration.scopes || [],
    };
  }

  async disconnect(workspaceId: string) {
    const integration = await this.ensureWorkspaceIntegration(workspaceId);
    if (integration.token) {
      await this.integrationTokenRepository.delete({ integrationId: integration.id });
    }

    integration.status = IntegrationStatus.DISCONNECTED;
    await this.integrationRepository.save(integration);
    return { ok: true };
  }

  async updateSettings(
    workspaceId: string,
    dto: Partial<
      Pick<TSettings, 'folderId' | 'folderName' | 'syncEnabled' | 'syncTime' | 'timeZone'>
    >,
  ) {
    const integration = await this.ensureWorkspaceIntegration(workspaceId);
    let settings =
      this.getConnectedSettings(integration) || this.createSettingsRecord(integration.id);

    if (dto.folderId !== undefined) {
      settings.folderId = dto.folderId || null;
    }
    if (dto.folderName !== undefined) {
      settings.folderName = dto.folderName || null;
    }
    if (dto.syncEnabled !== undefined) {
      settings.syncEnabled = dto.syncEnabled;
    }
    if (dto.syncTime !== undefined) {
      settings.syncTime = dto.syncTime;
    }
    if (dto.timeZone !== undefined) {
      settings.timeZone = dto.timeZone || null;
    }

    settings = await this.settingsRepository.save(settings);
    return { ok: true, settings };
  }

  async getPickerToken(workspaceId: string) {
    const integration = await this.ensureWorkspaceIntegration(workspaceId);
    const accessToken = await this.ensureValidAccessToken(integration);
    return { accessToken };
  }

  async syncDueIntegrations() {
    const integrations = await this.integrationRepository.find?.({
      where: {
        provider: this.getProvider(),
        status: IntegrationStatus.CONNECTED,
      },
      relations: ['token', this.getSettingsRelationName()],
    });

    if (!integrations?.length) {
      return;
    }

    const now = new Date();
    for (const integration of integrations) {
      const settings = this.getConnectedSettings(integration);
      if (!settings?.syncEnabled) {
        continue;
      }

      const timeZone = settings.timeZone || 'UTC';
      if (!this.shouldSyncNow(now, settings, timeZone)) {
        continue;
      }

      try {
        await this.syncIntegration(integration);
      } catch (error) {
        this.logger.error(
          `${this.getProviderName()} sync failed for integration ${integration.id}: ${error}`,
        );
      }
    }
  }

  async syncNow(workspaceId: string) {
    const integration = await this.ensureWorkspaceIntegration(workspaceId);
    return this.syncIntegration(integration);
  }

  protected buildSyncStatementQuery(
    statementRepository: {
      createQueryBuilder(alias: string): SyncQueryBuilderLike<Statement>;
    },
    integration: Integration,
    lastSyncAt: Date | null,
  ) {
    // The statements of the integration's workspace. Matching on the uploaders'
    // registration workspace instead sent their statements from other
    // workspaces to this cloud and skipped members who registered elsewhere.
    const qb = statementRepository
      .createQueryBuilder('statement')
      .where('statement.deletedAt IS NULL')
      .andWhere('statement.workspaceId = :workspaceId', { workspaceId: integration.workspaceId })
      .orderBy('statement.createdAt', 'ASC');

    if (lastSyncAt) {
      qb.andWhere('statement.createdAt > :lastSyncAt', { lastSyncAt });
    }

    return qb;
  }

  protected buildSyncResult(uploaded: number, lastSyncAt: Date) {
    return {
      ok: true,
      uploaded,
      lastSyncAt,
    };
  }

  protected getAllowedImportMimeTypes(): ReadonlySet<string> {
    return DEFAULT_IMPORT_ALLOWED_MIME_TYPES;
  }

  protected getMaxImportFileSizeBytes(): number {
    return MAX_IMPORT_FILE_SIZE_BYTES;
  }

  protected buildImportResult(
    fileId: string,
    status: 'ok' | 'error',
    message?: string,
  ): CloudImportResult {
    return message ? { fileId, status, message } : { fileId, status };
  }

  protected buildImportResponse(results: CloudImportResult[]) {
    return {
      ok: true,
      results,
    };
  }

  protected validateImportCandidate(args: {
    fileId: string;
    originalName: string;
    mimeType: string;
    size: number;
  }): ImportCandidateValidationResult {
    const safeBaseName = path.basename(normalizeFilename(args.originalName));

    if (!this.getAllowedImportMimeTypes().has(args.mimeType)) {
      return {
        ok: false,
        result: this.buildImportResult(
          args.fileId,
          'error',
          `Unsupported file type: ${args.mimeType}`,
        ),
      };
    }

    if (args.size && Number.isFinite(args.size) && args.size > this.getMaxImportFileSizeBytes()) {
      return {
        ok: false,
        result: this.buildImportResult(args.fileId, 'error', 'File size exceeds limit'),
      };
    }

    return {
      ok: true,
      safeBaseName,
    };
  }

  protected isInvalidImportCandidate(
    validation: ImportCandidateValidationResult,
  ): validation is { ok: false; result: CloudImportResult } {
    return validation.ok === false;
  }

  protected async importFilesWithClient<TClient>(args: {
    userId: string;
    workspaceId: string;
    fileIds: string[];
    getClient: (integration: Integration) => Promise<TClient>;
    loadFile: (
      client: TClient,
      fileId: string,
    ) => Promise<
      | {
          originalName: string;
          mimeType: string;
          size: number;
          getContents: () => Promise<Buffer>;
        }
      | {
          result: CloudImportResult;
        }
    >;
    importFile: (user: User, file: Express.Multer.File) => Promise<unknown>;
    getErrorMessage: (error: unknown) => string;
    uploadsDir?: string;
  }) {
    const integration = await this.ensureWorkspaceIntegration(args.workspaceId);
    const client = await args.getClient(integration);
    const uploadsDir = args.uploadsDir || process.cwd();
    const user = await this.userRepository.findOne({
      where: { id: args.userId },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const results: CloudImportResult[] = [];

    for (const fileId of args.fileIds) {
      try {
        const loaded = await args.loadFile(client, fileId);
        if ('result' in loaded) {
          results.push(loaded.result);
          continue;
        }

        const validation = this.validateImportCandidate({
          fileId,
          originalName: loaded.originalName,
          mimeType: loaded.mimeType,
          size: loaded.size,
        });
        if (this.isInvalidImportCandidate(validation)) {
          results.push(validation.result);
          continue;
        }

        await this.persistImportedFile({
          uploadsDir,
          safeBaseName: validation.safeBaseName,
          mimeType: loaded.mimeType,
          contents: await loaded.getContents(),
          importFile: file => args.importFile(user, file),
        });

        results.push(this.buildImportResult(fileId, 'ok'));
      } catch (error) {
        results.push(this.buildImportResult(fileId, 'error', args.getErrorMessage(error)));
      }
    }

    return this.buildImportResponse(results);
  }

  protected async runSyncWithClient<TClient>(args: {
    integration: Integration;
    settings: TSettings;
    statementRepository: {
      createQueryBuilder(alias: string): SyncQueryBuilderLike<Statement>;
    };
    getClient: (integration: Integration) => Promise<TClient>;
    getStatementStream: (statement: Statement) => Promise<{
      stream: NodeJS.ReadableStream;
      fileName: string;
      mimeType: string;
    }>;
    uploadStatement: (args: {
      client: TClient;
      statement: Statement;
      stream: NodeJS.ReadableStream;
      fileName: string;
      mimeType: string;
      settings: TSettings;
    }) => Promise<void>;
    saveSettings: (settings: TSettings) => Promise<TSettings>;
    createAuditEvent: (uploaded: number) => Promise<unknown>;
    getWarningMessage: (statementId: string, error: unknown) => string;
  }) {
    const client = await args.getClient(args.integration);
    const qb = this.buildSyncStatementQuery(
      args.statementRepository,
      args.integration,
      args.settings.lastSyncAt,
    );

    const statements = await qb.getMany();
    let uploaded = 0;

    for (const statement of statements) {
      try {
        const { stream, fileName, mimeType } = await args.getStatementStream(statement);
        await args.uploadStatement({
          client,
          statement,
          stream,
          fileName,
          mimeType,
          settings: args.settings,
        });
        uploaded += 1;
      } catch (error) {
        this.logger.warn(args.getWarningMessage(statement.id, error));
      }
    }

    args.settings.lastSyncAt = new Date();
    await args.saveSettings(args.settings);

    try {
      await args.createAuditEvent(uploaded);
    } catch (error) {
      this.logger.warn(
        `Audit event failed for ${this.getProviderName()} sync: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return this.buildSyncResult(uploaded, args.settings.lastSyncAt);
  }

  protected async persistImportedFile(args: {
    uploadsDir: string;
    safeBaseName: string;
    mimeType: string;
    contents: Buffer;
    importFile: (file: Express.Multer.File) => Promise<unknown>;
  }) {
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2, 18)}-${args.safeBaseName}`;
    const filePath = path.join(args.uploadsDir, fileName);

    await fs.promises.writeFile(filePath, args.contents);

    const fileStats = await fs.promises.stat(filePath);
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: args.safeBaseName,
      encoding: '7bit',
      mimetype: args.mimeType,
      size: fileStats.size,
      destination: args.uploadsDir,
      filename: fileName,
      path: filePath,
      buffer: Buffer.alloc(0),
    } as Express.Multer.File;

    validateFile(file);
    await args.importFile(file);
    return file;
  }

  protected shouldSyncNow(
    now: Date,
    settings: CloudStorageSettingsLike,
    timeZone: string,
  ): boolean {
    const [hourStr, minuteStr] = (settings.syncTime || DEFAULT_SYNC_TIME).split(':');
    const syncHour = Number.parseInt(hourStr || '0', 10);
    const syncMinute = Number.parseInt(minuteStr || '0', 10);

    const nowParts = this.getTimeParts(now, timeZone);
    const lastSyncParts = settings.lastSyncAt
      ? this.getTimeParts(settings.lastSyncAt, timeZone)
      : null;
    if (lastSyncParts?.dateKey === nowParts.dateKey) {
      return false;
    }

    const nowTotal = nowParts.hour * 60 + nowParts.minute;
    const syncTotal = syncHour * 60 + syncMinute;
    return nowTotal >= syncTotal && nowTotal < syncTotal + 15;
  }

  protected getTimeParts(date: Date, timeZone: string) {
    let tz = timeZone;
    try {
      Intl.DateTimeFormat('en-US', { timeZone }).format(date);
    } catch {
      tz = 'UTC';
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const lookup = (type: string) => parts.find(part => part.type === type)?.value || '00';

    return {
      dateKey: `${lookup('year')}-${lookup('month')}-${lookup('day')}`,
      hour: Number.parseInt(lookup('hour'), 10),
      minute: Number.parseInt(lookup('minute'), 10),
    };
  }
}
