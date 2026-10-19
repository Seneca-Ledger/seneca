import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { encryptText } from '@/common/utils/encryption.util';
import type { DropboxSettings } from '@/entities/dropbox-settings.entity';
import { IntegrationProvider, IntegrationStatus, type Integration } from '@/entities/integration.entity';
import type { IntegrationToken } from '@/entities/integration-token.entity';
import type { User } from '@/entities/user.entity';
import { WorkspaceKind } from '@/entities/workspace.entity';
import type { WorkspaceMember } from '@/entities/workspace-member.entity';
import {
  CloudStorageBaseService,
  type CloudStorageSettingsLike,
} from '@/common/services/cloud-storage-base.service';
import { APP_NAME } from '../../../../src/common/brand';

function createRepoMock<T>() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (data: Partial<T>) => data as T),
    create: jest.fn((data: Partial<T>) => data as T),
    delete: jest.fn(),
  } as any;
}

type TestSettings = CloudStorageSettingsLike & Partial<DropboxSettings>;

class TestCloudStorageService extends CloudStorageBaseService<TestSettings> {
  public readonly refreshAccessTokenMock = jest.fn();
  public readonly syncIntegrationMock = jest.fn();
  public readonly runSharedSyncWithClientMock = jest.fn();
  protected readonly logger = {
    error: jest.fn(),
    warn: jest.fn(),
  };

  constructor(
    integrationRepository: any,
    integrationTokenRepository: any,
    settingsRepository: any,
    userRepository: any,
  ) {
    super(integrationRepository, integrationTokenRepository, settingsRepository, userRepository);
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

  protected getStateSecret(): string {
    return 'test-secret';
  }

  protected getFrontendBaseUrl(): string {
    return 'https://app.example.com';
  }

  protected createSettingsRecord(integrationId: string): TestSettings {
    return {
      integrationId,
      folderId: null,
      folderName: null,
      syncEnabled: true,
      syncTime: '03:00',
      timeZone: null,
      lastSyncAt: null,
    };
  }

  protected async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; expiresAt?: Date }> {
    return this.refreshAccessTokenMock(refreshToken);
  }

  protected getAuthorizationExpiredMessage(): string {
    return 'Dropbox authorization expired';
  }

  protected async syncIntegration(integration: Integration) {
    return this.syncIntegrationMock(integration);
  }

  exposeRunSyncWithClient<TClient>(args: {
    integration: Integration;
    settings: TestSettings;
    statementRepository: any;
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
      settings: TestSettings;
    }) => Promise<void>;
    saveSettings: (settings: TestSettings) => Promise<TestSettings>;
    createAuditEvent: (uploaded: number) => Promise<void>;
    getWarningMessage: (statementId: string, error: unknown) => string;
  }) {
    return this.runSyncWithClient(args);
  }

  exposeBuildState(payload: Record<string, unknown>) {
    return this.buildState(payload);
  }

  exposeParseState(state: string) {
    return this.parseState(state);
  }

  exposeBuildSyncQuery(statementRepository: any, integration: Partial<Integration>, lastSyncAt?: Date | null) {
    return this.buildSyncStatementQuery(statementRepository, integration as Integration, lastSyncAt ?? null);
  }

  exposeBuildSyncResult(uploaded: number, lastSyncAt: Date) {
    return this.buildSyncResult(uploaded, lastSyncAt);
  }

  exposePersistImportedFile(args: {
    uploadsDir: string;
    safeBaseName: string;
    mimeType: string;
    contents: Buffer;
    importFile: (file: Express.Multer.File) => Promise<void>;
  }) {
    return this.persistImportedFile(args);
  }

  exposeValidateImportCandidate(args: {
    fileId: string;
    originalName: string;
    mimeType: string;
    size: number;
  }) {
    return this.validateImportCandidate(args);
  }

  exposeImportFilesWithClient<TClient>(args: {
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
          contents: Buffer;
        }
      | {
          result: { fileId: string; status: 'ok' | 'error'; message?: string };
        }
    >;
    importFile: (user: User, file: Express.Multer.File) => Promise<unknown>;
    getErrorMessage: (error: unknown) => string;
  }) {
    return this.importFilesWithClient(args);
  }
}

describe('CloudStorageBaseService', () => {
  const integrationRepository = createRepoMock<Integration>();
  const integrationTokenRepository = createRepoMock<IntegrationToken>();
  const settingsRepository = createRepoMock<TestSettings>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  let service: TestCloudStorageService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestCloudStorageService(
      integrationRepository,
      integrationTokenRepository,
      settingsRepository,
      userRepository,
      workspaceMemberRepository,
    );
  });

  it('builds and parses signed OAuth state', () => {
    const state = service.exposeBuildState({ userId: 'user-1', workspaceId: 'ws-1' });

    expect(service.exposeParseState(state)).toEqual({
      userId: 'user-1',
      workspaceId: 'ws-1',
    });
  });

  it('rejects OAuth state with invalid signature', () => {
    const state = service.exposeBuildState({ userId: 'user-1' });
    const [payload] = state.split('.');

    expect(() => service.exposeParseState(`${payload}.invalid`)).toThrow(BadRequestException);
  });

  it('marks connected integrations without required tokens as needing reauth', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { accessToken: null, refreshToken: 'encrypted-refresh' },
      dropboxSettings: {
        folderId: '/seneca',
        folderName: APP_NAME,
        syncEnabled: true,
        syncTime: '03:00',
        timeZone: 'UTC',
        lastSyncAt: null,
      },
    });

    await expect(service.getStatus('ws-1')).resolves.toEqual({
      connected: false,
      status: IntegrationStatus.NEEDS_REAUTH,
      settings: {
        folderId: '/seneca',
        folderName: APP_NAME,
        syncEnabled: true,
        syncTime: '03:00',
        timeZone: 'UTC',
        lastSyncAt: null,
      },
      scopes: [],
    });
    expect(integrationRepository.findOne).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', provider: IntegrationProvider.DROPBOX },
      relations: ['token', 'dropboxSettings'],
    });
  });

  it('disconnects the integration and deletes its token', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { integrationId: 'integration-1' },
      dropboxSettings: null,
    });

    await expect(service.disconnect('ws-1')).resolves.toEqual({ ok: true });
    expect(integrationTokenRepository.delete).toHaveBeenCalledWith({ integrationId: 'integration-1' });
    expect(integrationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'integration-1',
        status: IntegrationStatus.DISCONNECTED,
      }),
    );
  });

  it('returns picker token after refreshing an expired access token', async () => {
    const token = {
      integrationId: 'integration-1',
      accessToken: encryptText('expired-access'),
      refreshToken: encryptText('refresh-1'),
      expiresAt: new Date(Date.now() - 60_000),
    };

    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token,
      dropboxSettings: null,
    });
    service.refreshAccessTokenMock.mockResolvedValue({
      accessToken: 'fresh-access',
      expiresAt: new Date('2026-04-05T00:00:00.000Z'),
    });

    await expect(service.getPickerToken('ws-1')).resolves.toEqual({ accessToken: 'fresh-access' });
    expect(service.refreshAccessTokenMock).toHaveBeenCalledWith('refresh-1');
    expect(integrationTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: expect.any(String),
        expiresAt: new Date('2026-04-05T00:00:00.000Z'),
      }),
    );
  });

  it('syncs only integrations that are enabled and due in the current sync window', async () => {
    integrationRepository.find.mockResolvedValue([
      {
        id: 'due',
        provider: IntegrationProvider.DROPBOX,
        status: IntegrationStatus.CONNECTED,
        dropboxSettings: {
          syncEnabled: true,
          syncTime: '03:00',
          timeZone: 'UTC',
          lastSyncAt: new Date('2026-04-03T00:00:00.000Z'),
        },
      },
      {
        id: 'disabled',
        provider: IntegrationProvider.DROPBOX,
        status: IntegrationStatus.CONNECTED,
        dropboxSettings: {
          syncEnabled: false,
          syncTime: '03:00',
          timeZone: 'UTC',
          lastSyncAt: null,
        },
      },
      {
        id: 'already-synced',
        provider: IntegrationProvider.DROPBOX,
        status: IntegrationStatus.CONNECTED,
        dropboxSettings: {
          syncEnabled: true,
          syncTime: '03:00',
          timeZone: 'UTC',
          lastSyncAt: new Date('2026-04-04T01:00:00.000Z'),
        },
      },
    ]);

    jest.useFakeTimers().setSystemTime(new Date('2026-04-04T03:05:00.000Z'));

    await service.syncDueIntegrations();

    expect(service.syncIntegrationMock).toHaveBeenCalledTimes(1);
    expect(service.syncIntegrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'due' }),
    );
    // A past version files nothing new, so its copied connection is never picked up.
    expect(integrationRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspace: { kind: WorkspaceKind.STANDARD } }),
      }),
    );

    jest.useRealTimers();
  });

  it('builds a shared sync query scoped to workspace and last sync time', () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };
    const statementRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const lastSyncAt = new Date('2026-04-03T00:00:00.000Z');

    const result = service.exposeBuildSyncQuery(
      statementRepository,
      { workspaceId: 'ws-1', connectedByUserId: 'user-1' },
      lastSyncAt,
    );

    expect(statementRepository.createQueryBuilder).toHaveBeenCalledWith('statement');
    expect(qb.where).toHaveBeenCalledWith('statement.deletedAt IS NULL');
    // The statements' own workspace, not their uploaders' registration workspace.
    expect(qb.andWhere).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('statement.createdAt > :lastSyncAt', { lastSyncAt });
    expect(result).toBe(qb);
  });

  it('builds a shared sync result payload', () => {
    const lastSyncAt = new Date('2026-04-04T03:05:00.000Z');

    expect(service.exposeBuildSyncResult(3, lastSyncAt)).toEqual({
      ok: true,
      uploaded: 3,
      lastSyncAt,
    });
  });

  it('runs manual sync through the shared base method', async () => {
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { integrationId: 'integration-1' },
      dropboxSettings: null,
    });
    service.syncIntegrationMock.mockResolvedValue({ ok: true, uploaded: 2 });

    await expect(service.syncNow('ws-1')).resolves.toEqual({ ok: true, uploaded: 2 });
    expect(service.syncIntegrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'integration-1' }),
    );
  });

  it('persists an imported file through the shared helper', async () => {
    const importFile = jest.fn().mockResolvedValue(undefined);
    const uploadsDir = `/tmp/seneca-test-${Date.now()}`;
    fs.mkdirSync(uploadsDir, { recursive: true });

    await service.exposePersistImportedFile({
      uploadsDir,
      safeBaseName: 'statement.pdf',
      mimeType: 'application/pdf',
      contents: Buffer.from('%PDF-1.4\npdf-data'),
      importFile,
    });

    expect(importFile).toHaveBeenCalledWith(
      expect.objectContaining({
        originalname: 'statement.pdf',
        mimetype: 'application/pdf',
        size: Buffer.byteLength('%PDF-1.4\npdf-data'),
      }),
    );
  });

  it('rejects unsupported import mime types through the shared validator', () => {
    expect(
      service.exposeValidateImportCandidate({
        fileId: 'file-1',
        originalName: 'notes.txt',
        mimeType: 'text/plain',
        size: 128,
      }),
    ).toEqual({
      ok: false,
      result: {
        fileId: 'file-1',
        status: 'error',
        message: 'Unsupported file type: text/plain',
      },
    });
  });

  it('normalizes import names and enforces shared size limit', () => {
    expect(
      service.exposeValidateImportCandidate({
        fileId: 'file-1',
        originalName: '../statement.pdf',
        mimeType: 'application/pdf',
        size: 11 * 1024 * 1024,
      }),
    ).toEqual({
      ok: false,
      result: {
        fileId: 'file-1',
        status: 'error',
        message: 'File size exceeds limit',
      },
    });

    expect(
      service.exposeValidateImportCandidate({
        fileId: 'file-2',
        originalName: '../statement.pdf',
        mimeType: 'application/pdf',
        size: 128,
      }),
    ).toEqual({
      ok: true,
      safeBaseName: 'statement.pdf',
    });
  });

  it('runs shared import orchestration with provider hooks', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { integrationId: 'integration-1' },
      dropboxSettings: null,
    });

    const getClient = jest.fn().mockResolvedValue({ provider: 'client' });
    const importFile = jest.fn().mockResolvedValue(undefined);
    const loadFile = jest
      .fn()
      .mockResolvedValueOnce({
        originalName: 'statement.pdf',
        mimeType: 'application/pdf',
        size: 128,
        getContents: async () => Buffer.from('%PDF-1.4\npdf-data'),
      })
      .mockResolvedValueOnce({
        result: {
          fileId: 'file-2',
          status: 'error',
          message: 'Not a file',
        },
      });

    await expect(
      service.exposeImportFilesWithClient({
        userId: 'user-1',
        workspaceId: 'ws-1',
        fileIds: ['file-1', 'file-2'],
        getClient,
        loadFile,
        importFile: (user, file) => importFile(user, file),
        getErrorMessage: error => String(error),
      }),
    ).resolves.toEqual({
      ok: true,
      results: [
        { fileId: 'file-1', status: 'ok' },
        { fileId: 'file-2', status: 'error', message: 'Not a file' },
      ],
    });

    expect(getClient).toHaveBeenCalledWith(expect.objectContaining({ id: 'integration-1' }));
    expect(importFile).toHaveBeenCalledTimes(1);
    expect(loadFile).toHaveBeenCalledTimes(2);
  });

  it('runs shared sync orchestration with provider hooks', async () => {
    const statement = { id: 'statement-1' } as Statement;
    const qb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([statement]),
    };
    const statementRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const stream = { [Symbol.asyncIterator]: async function* () {} } as NodeJS.ReadableStream;
    const getClient = jest.fn().mockResolvedValue({ provider: 'client' });
    const getStatementStream = jest.fn().mockResolvedValue({
      stream,
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
    });
    const uploadStatement = jest.fn().mockResolvedValue(undefined);
    const saveSettings = jest.fn(async settings => settings);
    const createAuditEvent = jest.fn().mockResolvedValue(undefined);
    const settings = {
      integrationId: 'integration-1',
      folderId: '/seneca',
      folderName: APP_NAME,
      syncEnabled: true,
      syncTime: '03:00',
      timeZone: 'UTC',
      lastSyncAt: new Date('2026-04-03T00:00:00.000Z'),
    } as TestSettings;
    const integration = {
      id: 'integration-1',
      workspaceId: 'ws-1',
      connectedByUserId: 'user-1',
    } as Integration;

    const result = await service.exposeRunSyncWithClient({
      integration,
      settings,
      statementRepository,
      getClient,
      getStatementStream,
      uploadStatement,
      saveSettings,
      createAuditEvent,
      getWarningMessage: (statementId, error) => `failed ${statementId}: ${String(error)}`,
    });

    expect(getClient).toHaveBeenCalledWith(integration);
    expect(getStatementStream).toHaveBeenCalledWith(statement);
    expect(uploadStatement).toHaveBeenCalledWith({
      client: { provider: 'client' },
      statement,
      stream,
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
      settings,
    });
    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ lastSyncAt: expect.any(Date) }));
    expect(createAuditEvent).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      ok: true,
      uploaded: 1,
      lastSyncAt: expect.any(Date),
    });
  });
});
