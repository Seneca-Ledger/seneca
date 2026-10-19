import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { CloudStorageBaseService } from '../../common/services/cloud-storage-base.service';
import { FileStorageService } from '../../common/services/file-storage.service';
import { requireSecret } from '../../common/utils/required-secret.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import {
  ActorType,
  AuditAction,
  DropboxSettings,
  EntityType,
  Integration,
  IntegrationProvider,
  IntegrationToken,
  Statement,
  User,
  WorkspaceMember,
} from '../../entities';
import { AuditService } from '../audit/audit.service';
import { StatementsService } from '../statements/statements.service';
import type { ImportDropboxFilesDto } from './dto/import-dropbox-files.dto';

const DEFAULT_SYNC_TIME = '03:00';

type DropboxApiError = {
  error?: { error_summary?: string };
  message?: string;
};

type DropboxFileMetadata = {
  '.tag': 'file';
  path_lower?: string;
  name?: string;
  size?: number;
};

type DropboxTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

type DropboxMetadataResponse = DropboxFileMetadata | { '.tag': string };

type DropboxCreateFolderResponse = {
  metadata?: DropboxFileMetadata;
};

type DropboxLegacyClient = {
  filesGetMetadata(args: { path: string }): Promise<{ result: DropboxMetadataResponse }>;
  filesDownload?(args: { path: string }): Promise<{
    result: { fileBinary?: Buffer | ArrayBuffer | Uint8Array };
  }>;
  filesUpload?(args: {
    path: string;
    contents: Buffer;
    mode: { '.tag': 'add' };
    autorename: boolean;
  }): Promise<unknown>;
};

type DropboxClient = string | DropboxLegacyClient;

@Injectable()
export class DropboxService extends CloudStorageBaseService<DropboxSettings> {
  protected readonly logger = new Logger(DropboxService.name);

  private getDropboxErrorMessage(error: unknown): string {
    const dropboxError = error as DropboxApiError;
    return dropboxError.error?.error_summary || dropboxError.message || 'Import failed';
  }

  constructor(
    @InjectRepository(Integration)
    integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationToken)
    integrationTokenRepository: Repository<IntegrationToken>,
    @InjectRepository(DropboxSettings)
    private readonly dropboxSettingsRepository: Repository<DropboxSettings>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(User)
    userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly statementsService: StatementsService,
    private readonly fileStorageService: FileStorageService,
    private readonly auditService: AuditService,
  ) {
    super(
      integrationRepository,
      integrationTokenRepository,
      dropboxSettingsRepository,
      userRepository,
      workspaceMemberRepository,
    );
  }

  private getClientId() {
    return process.env.DROPBOX_CLIENT_ID || '';
  }

  private getClientSecret() {
    return process.env.DROPBOX_CLIENT_SECRET || '';
  }

  private getRedirectUri() {
    return process.env.DROPBOX_REDIRECT_URI || '';
  }

  protected getFrontendBaseUrl() {
    return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  }

  protected getStateSecret() {
    return requireSecret(
      'DROPBOX_STATE_SECRET or JWT_SECRET',
      process.env.DROPBOX_STATE_SECRET,
      process.env.JWT_SECRET,
    );
  }

  protected getProvider(): IntegrationProvider {
    return IntegrationProvider.DROPBOX;
  }

  protected getProviderName(): string {
    return 'Dropbox';
  }

  protected getProviderRouteSegment(): string {
    return 'dropbox';
  }

  protected getSettingsRelationName(): keyof Integration {
    return 'dropboxSettings';
  }

  protected createSettingsRecord(integrationId: string): DropboxSettings {
    return this.dropboxSettingsRepository.create({
      integrationId,
      folderId: null,
      folderName: null,
      syncEnabled: true,
      syncTime: DEFAULT_SYNC_TIME,
      timeZone: null,
      lastSyncAt: null,
    });
  }

  protected async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    const response = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const accessToken = response.access_token;
    if (!accessToken) {
      throw new Error('Missing access token');
    }

    let expiresAt: Date | undefined;
    if (response.expires_in) {
      expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);
    }

    return { accessToken, expiresAt };
  }

  protected getAuthorizationExpiredMessage(): string {
    return 'Dropbox authorization expired';
  }

  private ensureDropboxConfig() {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!(clientId && clientSecret)) {
      throw new BadRequestException('Dropbox OAuth is not configured');
    }
    return { clientId, clientSecret };
  }

  getAuthUrl(user: User, workspaceId: string): string {
    const clientId = this.getClientId();
    const redirectUri = this.getRedirectUri();
    if (!(clientId && redirectUri)) {
      throw new BadRequestException('Dropbox OAuth is not configured');
    }

    return this.buildProviderAuthUrl(
      user,
      workspaceId,
      state =>
        `https://www.dropbox.com/oauth2/authorize?${new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          token_access_type: 'offline',
          state,
        }).toString()}`,
    );
  }

  async handleOAuthCallback(params: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<string> {
    const callbackContext = await this.resolveOAuthCallbackUser<Pick<User, 'id' | 'timeZone'>>(
      params,
      ['id', 'timeZone'],
    );
    if ('redirectUrl' in callbackContext) {
      return callbackContext.redirectUrl;
    }

    const { redirectBase, user, workspaceId } = callbackContext;

    const redirectUri = this.getRedirectUri();

    let tokenResponse: DropboxTokenResponse;
    try {
      tokenResponse = await this.requestToken({
        grant_type: 'authorization_code',
        code: params.code || '',
        redirect_uri: redirectUri,
      });
    } catch (error) {
      this.logger.error(`Dropbox token exchange failed: ${error}`);
      return `${redirectBase}?status=error&reason=token_exchange_failed`;
    }

    const accessToken = tokenResponse.access_token || '';
    const refreshToken = tokenResponse.refresh_token || '';

    if (!(accessToken || refreshToken)) {
      return `${redirectBase}?status=error&reason=missing_tokens`;
    }

    const existing = await this.findWorkspaceIntegration(workspaceId);
    const savedIntegration = await this.upsertConnectedIntegration(existing, user, workspaceId, [
      'files.content.read',
      'files.content.write',
    ]);

    if (tokenResponse.expires_in) {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);
      await this.saveEncryptedTokenRecord(existing?.token, savedIntegration.id, {
        accessToken,
        refreshToken,
        expiresAt,
      });
    } else if (accessToken || refreshToken) {
      await this.saveEncryptedTokenRecord(existing?.token, savedIntegration.id, {
        accessToken,
        refreshToken,
      });
    }

    let settings = existing?.dropboxSettings || this.createSettingsRecord(savedIntegration.id);
    settings.syncTime = settings.syncTime || DEFAULT_SYNC_TIME;
    settings.timeZone = settings.timeZone || user.timeZone || 'UTC';
    settings.syncEnabled = settings.syncEnabled ?? true;

    settings = await this.dropboxSettingsRepository.save(settings);

    try {
      await this.ensureDefaultFolder(savedIntegration, settings);
    } catch (error) {
      this.logger.warn(`Failed to create default Dropbox folder: ${error}`);
    }

    return this.buildIntegrationRedirect('connected');
  }

  private async getDropboxClientWithAuth(integration: Integration): Promise<DropboxClient> {
    if (!integration.token) {
      throw new BadRequestException('Integration token missing');
    }
    return this.ensureValidAccessToken(integration);
  }

  private async requestToken(params: Record<string, string>): Promise<DropboxTokenResponse> {
    const { clientId, clientSecret } = this.ensureDropboxConfig();
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    });
    if (!response.ok) {
      throw new Error(`Dropbox token request failed with status ${response.status}`);
    }
    return (await response.json()) as DropboxTokenResponse;
  }

  private async dropboxJson<T>(
    accessToken: string,
    endpoint: string,
    payload: unknown,
  ): Promise<T> {
    const response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Dropbox API request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async dropboxContent(
    accessToken: string,
    endpoint: string,
    payload: unknown,
    body?: BodyInit,
  ): Promise<Response> {
    const response = await fetch(`https://content.dropboxapi.com/2/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Dropbox-API-Arg': JSON.stringify(payload),
        ...(body ? { 'Content-Type': 'application/octet-stream' } : {}),
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Dropbox content request failed with status ${response.status}`);
    }
    return response;
  }

  private requireAccessToken(client: DropboxClient): string {
    if (typeof client !== 'string') {
      throw new Error('Dropbox REST access token is unavailable');
    }
    return client;
  }

  private async getDropboxMetadata(
    client: DropboxClient,
    path: string,
  ): Promise<DropboxMetadataResponse> {
    if (typeof client !== 'string') {
      const response = await client.filesGetMetadata({ path });
      return response.result;
    }

    return this.dropboxJson<DropboxMetadataResponse>(client, 'files/get_metadata', { path });
  }

  private async downloadDropboxFile(client: DropboxClient, path: string): Promise<Buffer> {
    if (typeof client !== 'string' && client.filesDownload) {
      const response = await client.filesDownload({ path });
      const binary = response.result.fileBinary;
      if (Buffer.isBuffer(binary)) {
        return binary;
      }
      if (binary instanceof Uint8Array) {
        return Buffer.from(binary);
      }
      if (binary instanceof ArrayBuffer) {
        return Buffer.from(binary);
      }
      return Buffer.from([]);
    }

    const download = await this.dropboxContent(this.requireAccessToken(client), 'files/download', {
      path,
    });
    return Buffer.from(await download.arrayBuffer());
  }

  private async ensureDefaultFolder(integration: Integration, settings: DropboxSettings) {
    if (settings.folderId) {
      return settings;
    }
    const client = await this.getDropboxClientWithAuth(integration);

    try {
      const response = await this.dropboxJson<DropboxCreateFolderResponse>(
        this.requireAccessToken(client),
        'files/create_folder_v2',
        {
          path: `/${APP_NAME}`,
          autorename: false,
        },
      );

      const folderId = response.metadata?.path_lower || null;
      const folderName = response.metadata?.name || null;
      if (folderId) {
        settings.folderId = folderId;
        settings.folderName = folderName;
        return this.dropboxSettingsRepository.save(settings);
      }
    } catch (error) {
      if (this.getDropboxErrorMessage(error).includes('path/conflict/folder')) {
        settings.folderId = `/${APP_NAME}`.toLowerCase();
        settings.folderName = APP_NAME;
        return this.dropboxSettingsRepository.save(settings);
      }
      throw error;
    }
    return settings;
  }

  async importFiles(userId: string, workspaceId: string, dto: ImportDropboxFilesDto) {
    const uploadsDir = resolveUploadsDir();
    return this.importFilesWithClient({
      userId,
      workspaceId,
      fileIds: dto.fileIds,
      uploadsDir,
      getClient: integration => this.getDropboxClientWithAuth(integration),
      loadFile: async (client, fileId) => {
        const meta = await this.getDropboxMetadata(client, fileId);

        if (meta['.tag'] !== 'file') {
          return {
            result: this.buildImportResult(fileId, 'error', 'Not a file'),
          };
        }

        const fileMetadata = meta as DropboxFileMetadata;
        const originalName = fileMetadata.name || `dropbox-file-${fileId}`;
        const ext = path.extname(path.basename(originalName)).toLowerCase();

        let mimeType = 'application/octet-stream';
        if (ext === '.pdf') {
          mimeType = 'application/pdf';
        } else if (ext === '.csv') {
          mimeType = 'text/csv';
        } else if (ext === '.docx') {
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }

        return {
          originalName,
          mimeType,
          size: fileMetadata.size || 0,
          getContents: async () => {
            return this.downloadDropboxFile(client, fileId);
          },
        };
      },
      importFile: (user, file) =>
        this.statementsService.create(user, workspaceId, file, undefined, undefined, false),
      getErrorMessage: error => this.getDropboxErrorMessage(error),
    });
  }

  private async resolveDropboxFilename(
    client: DropboxClient,
    folderId: string | null,
    fileName: string,
  ): Promise<string> {
    if (!folderId) {
      return fileName;
    }
    const filePath = `${folderId}/${fileName}`;
    try {
      await this.getDropboxMetadata(client, filePath);
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
      const dot = fileName.lastIndexOf('.');
      if (dot === -1) {
        return `${fileName}-${stamp}`;
      }
      return `${fileName.slice(0, dot)}-${stamp}${fileName.slice(dot)}`;
    } catch (error) {
      if (this.getDropboxErrorMessage(error).includes('path/not_found')) {
        return fileName;
      }
      throw error;
    }
  }

  protected async syncIntegration(integration: Integration) {
    if (!integration.dropboxSettings) {
      throw new BadRequestException('Dropbox settings missing');
    }

    return this.runSyncWithClient({
      integration,
      settings: integration.dropboxSettings,
      statementRepository: this.statementRepository,
      getClient: currentIntegration => this.getDropboxClientWithAuth(currentIntegration),
      getStatementStream: statement => this.fileStorageService.getStatementFileStream(statement),
      uploadStatement: async ({ client, stream, fileName, settings }) => {
        const dropboxName = await this.resolveDropboxFilename(
          client,
          settings.folderId || null,
          fileName,
        );

        const uploadPath = settings.folderId
          ? `${settings.folderId}/${dropboxName}`
          : `/${dropboxName}`;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }

        if (typeof client !== 'string' && client.filesUpload) {
          await client.filesUpload({
            path: uploadPath,
            contents: Buffer.concat(chunks),
            mode: { '.tag': 'add' },
            autorename: true,
          });
          return;
        }

        await this.dropboxContent(
          this.requireAccessToken(client),
          'files/upload',
          {
            path: uploadPath,
            mode: 'add',
            autorename: true,
          },
          Buffer.concat(chunks),
        );
      },
      saveSettings: settings => this.dropboxSettingsRepository.save(settings),
      createAuditEvent: uploaded =>
        this.auditService.createEvent({
          workspaceId: integration.workspaceId ?? null,
          actorType: ActorType.INTEGRATION,
          actorId: integration.connectedByUserId ?? null,
          actorLabel: 'Dropbox Sync',
          entityType: EntityType.INTEGRATION,
          entityId: integration.id,
          action: AuditAction.EXPORT,
          meta: {
            provider: IntegrationProvider.DROPBOX,
            uploaded,
          },
        }),
      getWarningMessage: (statementId, error) =>
        `Failed to sync statement ${statementId} to Dropbox: ${String(error)}`,
    });
  }
}
