import type { FileStorageService } from '@/common/services/file-storage.service';
import type { DropboxSettings } from '@/entities/dropbox-settings.entity';
import type { IntegrationToken } from '@/entities/integration-token.entity';
import {
  type Integration,
  IntegrationProvider,
  IntegrationStatus,
} from '@/entities/integration.entity';
import type { Statement } from '@/entities/statement.entity';
import type { User } from '@/entities/user.entity';
import type { WorkspaceMember } from '@/entities/workspace-member.entity';
import type { AuditService } from '@/modules/audit/audit.service';
import { DropboxService } from '@/modules/dropbox/dropbox.service';
import type { StatementsService } from '@/modules/statements/statements.service';
import type { Repository } from 'typeorm';

type RepoMock<T> = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock<Promise<T>, [Partial<T>]>;
  create: jest.Mock<T, [Partial<T>]>;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
};

type DropboxClientMock = {
  filesGetMetadata: jest.Mock;
  filesDownload?: jest.Mock;
};

type DropboxServicePrivate = {
  getDropboxClientWithAuth: (integration: Integration) => Promise<DropboxClientMock>;
};

function createRepoMock<T>(): RepoMock<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (data: Partial<T>) => data as T),
    create: jest.fn((data: Partial<T>) => data as T),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('DropboxService', () => {
  const integrationRepository = createRepoMock<Integration>();
  const integrationTokenRepository = createRepoMock<IntegrationToken>();
  const dropboxSettingsRepository = createRepoMock<DropboxSettings>();
  const statementRepository = createRepoMock<Statement>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  const statementsService = { create: jest.fn() };
  const fileStorageService = { getStatementFileStream: jest.fn() };
  const auditService = { createEvent: jest.fn() };

  let service: DropboxService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DROPBOX_CLIENT_ID = 'dropbox-client-id';
    process.env.DROPBOX_CLIENT_SECRET = 'dropbox-client-secret';

    service = new DropboxService(
      integrationRepository as unknown as Repository<Integration>,
      integrationTokenRepository as unknown as Repository<IntegrationToken>,
      dropboxSettingsRepository as unknown as Repository<DropboxSettings>,
      statementRepository as unknown as Repository<Statement>,
      userRepository as unknown as Repository<User>,
      workspaceMemberRepository as unknown as Repository<WorkspaceMember>,
      statementsService as unknown as StatementsService,
      fileStorageService as unknown as FileStorageService,
      auditService as unknown as AuditService,
    );
  });

  it('returns an error result for unsupported dropbox file types', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { accessToken: 'enc:access', refreshToken: 'enc:refresh' },
      dropboxSettings: null,
    });

    jest
      .spyOn(service as unknown as DropboxServicePrivate, 'getDropboxClientWithAuth')
      .mockResolvedValue({
        filesGetMetadata: jest.fn().mockResolvedValue({
          result: {
            '.tag': 'file',
            name: 'notes.txt',
            size: 128,
          },
        }),
      });

    await expect(service.importFiles('user-1', 'ws-open', { fileIds: ['file-1'] })).resolves.toEqual({
      ok: true,
      results: [
        {
          fileId: 'file-1',
          status: 'error',
          message: 'Unsupported file type: application/octet-stream',
        },
      ],
    });
    expect(statementsService.create).not.toHaveBeenCalled();
  });

  it('returns an error result for oversized dropbox files', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { accessToken: 'enc:access', refreshToken: 'enc:refresh' },
      dropboxSettings: null,
    });

    jest
      .spyOn(service as unknown as DropboxServicePrivate, 'getDropboxClientWithAuth')
      .mockResolvedValue({
        filesGetMetadata: jest.fn().mockResolvedValue({
          result: {
            '.tag': 'file',
            name: 'statement.pdf',
            size: 11 * 1024 * 1024,
          },
        }),
      });

    await expect(service.importFiles('user-1', 'ws-open', { fileIds: ['file-1'] })).resolves.toEqual({
      ok: true,
      results: [
        {
          fileId: 'file-1',
          status: 'error',
          message: 'File size exceeds limit',
        },
      ],
    });
    expect(statementsService.create).not.toHaveBeenCalled();
  });

  it('imports a supported dropbox file successfully', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.DROPBOX,
      status: IntegrationStatus.CONNECTED,
      token: { accessToken: 'enc:access', refreshToken: 'enc:refresh' },
      dropboxSettings: null,
    });

    const filesGetMetadata = jest.fn().mockResolvedValue({
      result: {
        '.tag': 'file',
        name: 'statement.pdf',
        size: 128,
      },
    });
    const filesDownload = jest.fn().mockResolvedValue({
      result: {
        fileBinary: Buffer.from('%PDF-1.4\npdf-data'),
      },
    });
    jest
      .spyOn(service as unknown as DropboxServicePrivate, 'getDropboxClientWithAuth')
      .mockResolvedValue({
        filesGetMetadata,
        filesDownload,
      });

    await expect(service.importFiles('user-1', 'ws-open', { fileIds: ['file-1'] })).resolves.toEqual({
      ok: true,
      results: [{ fileId: 'file-1', status: 'ok' }],
    });
    expect(filesDownload).toHaveBeenCalledWith({ path: 'file-1' });
    expect(statementsService.create).toHaveBeenCalledTimes(1);
    expect(statementsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      'ws-open',
      expect.objectContaining({
        originalname: 'statement.pdf',
        mimetype: 'application/pdf',
      }),
      undefined,
      undefined,
      false,
    );
  });
});
