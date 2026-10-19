import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { CloudStorageBaseService } from '../../common/services/cloud-storage-base.service';
import { FileStorageService } from '../../common/services/file-storage.service';
import { requireSecret } from '../../common/utils/required-secret.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import {
  ActorType,
  AuditAction,
  DriveSettings,
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
import type { ImportDriveFilesDto } from './dto/import-drive-files.dto';

type GoogleDriveImportError = {
  response?: { data?: { message?: string } };
  message?: string;
};

type GoogleDriveFile = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
};

type GoogleDriveFilesResponse = {
  files?: GoogleDriveFile[];
};

type DriveClient = {
  files: {
    get(args: { fileId: string; fields?: string; alt?: string }): Promise<{
      data: GoogleDriveFile | Buffer;
    }>;
  };
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
];

const DEFAULT_SYNC_TIME = '03:00';

@Injectable()
export class GoogleDriveService extends CloudStorageBaseService<DriveSettings> {
  protected readonly logger = new Logger(GoogleDriveService.name);

  private getImportErrorMessage(error: unknown): string {
    const importError = error as GoogleDriveImportError;
    return importError.response?.data?.message || importError.message || 'Import failed';
  }

  constructor(
    @InjectRepository(Integration)
    integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationToken)
    integrationTokenRepository: Repository<IntegrationToken>,
    @InjectRepository(DriveSettings)
    private readonly driveSettingsRepository: Repository<DriveSettings>,
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
      driveSettingsRepository,
      userRepository,
      workspaceMemberRepository,
    );
  }

  private getClientId() {
    return process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  }

  private getClientSecret() {
    return process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
  }

  private getRedirectUri() {
    return process.env.GOOGLE_DRIVE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || '';
  }

  protected getFrontendBaseUrl() {
    return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
  }

  protected getStateSecret() {
    return requireSecret(
      'GOOGLE_DRIVE_STATE_SECRET or JWT_SECRET',
      process.env.GOOGLE_DRIVE_STATE_SECRET,
      process.env.JWT_SECRET,
    );
  }

  protected getProvider(): IntegrationProvider {
    return IntegrationProvider.GOOGLE_DRIVE;
  }

  protected getProviderName(): string {
    return 'Google Drive';
  }

  protected getProviderRouteSegment(): string {
    return 'google-drive';
  }

  protected getSettingsRelationName(): keyof Integration {
    return 'driveSettings';
  }

  protected createSettingsRecord(integrationId: string): DriveSettings {
    return this.driveSettingsRepository.create({
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
    const token = await this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    const accessToken = token.access_token;
    if (!accessToken) {
      throw new Error('Missing access token');
    }

    return {
      accessToken,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined,
    };
  }

  protected getAuthorizationExpiredMessage(): string {
    return 'Google Drive authorization expired';
  }

  private getOAuthConfig() {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const redirectUri = this.getRedirectUri();
    if (!(clientId && clientSecret && redirectUri)) {
      throw new BadRequestException('Google Drive OAuth is not configured');
    }
    return { clientId, clientSecret, redirectUri };
  }

  getAuthUrl(user: User, workspaceId: string): string {
    const { clientId, redirectUri } = this.getOAuthConfig();

    return this.buildProviderAuthUrl(
      user,
      workspaceId,
      state =>
        `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: 'code',
          access_type: 'offline',
          prompt: 'consent',
          scope: DRIVE_SCOPES.join(' '),
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

    const token = await this.requestToken({
      grant_type: 'authorization_code',
      code: params.code || '',
    });
    const accessToken = token.access_token || '';
    const refreshToken = token.refresh_token || '';

    if (!(accessToken || refreshToken)) {
      return `${redirectBase}?status=error&reason=missing_tokens`;
    }

    const existing = await this.findWorkspaceIntegration(workspaceId);
    const savedIntegration = await this.upsertConnectedIntegration(
      existing,
      user,
      workspaceId,
      token.scope ? token.scope.split(' ') : existing?.scopes || DRIVE_SCOPES,
    );

    await this.saveEncryptedTokenRecord(existing?.token, savedIntegration.id, {
      accessToken,
      refreshToken,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined,
    });

    let settings = existing?.driveSettings || this.createSettingsRecord(savedIntegration.id);
    settings.syncTime = settings.syncTime || DEFAULT_SYNC_TIME;
    settings.timeZone = settings.timeZone || user.timeZone || 'UTC';
    settings.syncEnabled = settings.syncEnabled ?? true;

    settings = await this.driveSettingsRepository.save(settings);

    try {
      await this.ensureDefaultFolder(savedIntegration, settings);
    } catch (error) {
      this.logger.warn(`Failed to create default Drive folder: ${error}`);
    }

    return this.buildIntegrationRedirect('connected');
  }

  private async requestToken(params: Record<string, string>): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret, redirectUri } = this.getOAuthConfig();
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      ...params,
    });
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to exchange Google Drive OAuth token');
    }

    return (await response.json()) as GoogleTokenResponse;
  }

  private async getDriveAccessToken(integration: Integration): Promise<string> {
    if (!integration.token) {
      throw new BadRequestException('Integration token missing');
    }
    return this.ensureValidAccessToken(integration);
  }

  private async getDriveClient(integration: Integration): Promise<DriveClient> {
    const accessToken = await this.getDriveAccessToken(integration);
    return {
      files: {
        get: async args => {
          if (args.alt === 'media') {
            const response = await fetch(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}?alt=media`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            if (!response.ok) {
              throw new Error(`Google Drive download failed with status ${response.status}`);
            }
            return { data: Buffer.from(await response.arrayBuffer()) };
          }

          return {
            data: await this.driveJson<GoogleDriveFile>(
              accessToken,
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}?fields=${encodeURIComponent(args.fields || 'id,name,mimeType,size')}`,
            ),
          };
        },
      },
    };
  }

  private async driveJson<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`Google Drive REST request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  private async ensureDefaultFolder(integration: Integration, settings: DriveSettings) {
    if (settings.folderId) return settings;
    const accessToken = await this.getDriveAccessToken(integration);

    const response = await this.driveJson<GoogleDriveFile>(
      accessToken,
      'https://www.googleapis.com/drive/v3/files?fields=id,name',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: APP_NAME,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      },
    );

    const folderId = response.id || null;
    const folderName = response.name || null;
    if (folderId) {
      settings.folderId = folderId;
      settings.folderName = folderName;
      return this.driveSettingsRepository.save(settings);
    }
    return settings;
  }

  async importFiles(userId: string, workspaceId: string, dto: ImportDriveFilesDto) {
    const uploadsDir = resolveUploadsDir();
    return this.importFilesWithClient({
      userId,
      workspaceId,
      fileIds: dto.fileIds,
      uploadsDir,
      getClient: integration => this.getDriveClient(integration),
      loadFile: async (driveClient, fileId) => {
        const metaResponse = await driveClient.files.get({
          fileId,
          fields: 'id,name,mimeType,size',
        });
        const meta = metaResponse.data as GoogleDriveFile;

        return {
          originalName: meta.name || `drive-file-${fileId}`,
          mimeType: meta.mimeType || '',
          size: meta.size ? Number.parseInt(meta.size, 10) : 0,
          getContents: async () => {
            const response = await driveClient.files.get({ fileId, alt: 'media' });
            return response.data as Buffer;
          },
        };
      },
      importFile: (user, file) =>
        this.statementsService.create(user, workspaceId, file, undefined, undefined, false),
      getErrorMessage: error => this.getImportErrorMessage(error),
    });
  }

  private async resolveDriveFilename(
    accessToken: string,
    folderId: string | null,
    fileName: string,
  ): Promise<string> {
    if (!folderId) {
      return fileName;
    }
    const escapedName = fileName.replace(/'/g, "\\'");
    const q = `name = '${escapedName}' and '${folderId}' in parents and trashed = false`;
    const res = await this.driveJson<GoogleDriveFilesResponse>(
      accessToken,
      `https://www.googleapis.com/drive/v3/files?${new URLSearchParams({
        q,
        spaces: 'drive',
        fields: 'files(id,name)',
        pageSize: '1',
      }).toString()}`,
    );
    if (res.files && res.files.length > 0) {
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
      const dot = fileName.lastIndexOf('.');
      if (dot === -1) {
        return `${fileName}-${stamp}`;
      }
      return `${fileName.slice(0, dot)}-${stamp}${fileName.slice(dot)}`;
    }
    return fileName;
  }

  protected async syncIntegration(integration: Integration) {
    if (!integration.driveSettings) {
      throw new BadRequestException('Drive settings missing');
    }

    return this.runSyncWithClient({
      integration,
      settings: integration.driveSettings,
      statementRepository: this.statementRepository,
      getClient: currentIntegration => this.getDriveAccessToken(currentIntegration),
      getStatementStream: statement => this.fileStorageService.getStatementFileStream(statement),
      uploadStatement: async ({ client: accessToken, stream, fileName, mimeType, settings }) => {
        const driveName = await this.resolveDriveFilename(
          accessToken,
          settings.folderId || null,
          fileName,
        );
        const metadata = {
          name: driveName,
          parents: settings.folderId ? [settings.folderId] : undefined,
        };
        const fileBuffer = await this.streamToBuffer(stream);
        const body = new FormData();
        body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        body.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }));
        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body,
          },
        );
        if (!response.ok) {
          throw new Error(`Google Drive upload failed with status ${response.status}`);
        }
      },
      saveSettings: settings => this.driveSettingsRepository.save(settings),
      createAuditEvent: uploaded =>
        this.auditService.createEvent({
          workspaceId: integration.workspaceId ?? null,
          actorType: ActorType.INTEGRATION,
          actorId: integration.connectedByUserId ?? null,
          actorLabel: 'Google Drive Sync',
          entityType: EntityType.INTEGRATION,
          entityId: integration.id,
          action: AuditAction.EXPORT,
          meta: {
            provider: IntegrationProvider.GOOGLE_DRIVE,
            uploaded,
          },
        }),
      getWarningMessage: (statementId, error) =>
        `Failed to sync statement ${statementId} to Google Drive: ${String(error)}`,
    });
  }
}
