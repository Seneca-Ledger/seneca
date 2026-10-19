import type { FileStorageService } from '@/common/services/file-storage.service';
import type { DriveSettings } from '@/entities/drive-settings.entity';
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
import { GoogleDriveService } from '@/modules/google-drive/google-drive.service';
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

type GoogleDriveClientMock = {
  files: {
    get: jest.Mock;
  };
};

type GoogleDriveServicePrivate = {
  getDriveClient: (integration: Integration) => Promise<GoogleDriveClientMock>;
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

describe('GoogleDriveService', () => {
  const integrationRepository = createRepoMock<Integration>();
  const integrationTokenRepository = createRepoMock<IntegrationToken>();
  const driveSettingsRepository = createRepoMock<DriveSettings>();
  const statementRepository = createRepoMock<Statement>();
  const userRepository = createRepoMock<User>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  const statementsService = { create: jest.fn() };
  const fileStorageService = { getStatementFileStream: jest.fn() };
  const auditService = { createEvent: jest.fn() };

  let service: GoogleDriveService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_DRIVE_CLIENT_ID = 'google-drive-client-id';
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'google-drive-client-secret';
    process.env.GOOGLE_DRIVE_REDIRECT_URI = 'https://app.example.com/api/google-drive/callback';

    service = new GoogleDriveService(
      integrationRepository as unknown as Repository<Integration>,
      integrationTokenRepository as unknown as Repository<IntegrationToken>,
      driveSettingsRepository as unknown as Repository<DriveSettings>,
      statementRepository as unknown as Repository<Statement>,
      userRepository as unknown as Repository<User>,
      workspaceMemberRepository as unknown as Repository<WorkspaceMember>,
      statementsService as unknown as StatementsService,
      fileStorageService as unknown as FileStorageService,
      auditService as unknown as AuditService,
    );
  });

  it('returns an error result for unsupported google drive file types', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.GOOGLE_DRIVE,
      status: IntegrationStatus.CONNECTED,
      token: { accessToken: 'enc:access', refreshToken: 'enc:refresh' },
      driveSettings: null,
    });

    jest
      .spyOn(service as unknown as GoogleDriveServicePrivate, 'getDriveClient')
      .mockResolvedValue({
        files: {
          get: jest.fn().mockResolvedValue({
            data: {
              id: 'file-1',
              name: 'notes.txt',
              mimeType: 'text/plain',
              size: '128',
            },
          }),
        },
      });

    await expect(service.importFiles('user-1', 'ws-open', { fileIds: ['file-1'] })).resolves.toEqual({
      ok: true,
      results: [
        {
          fileId: 'file-1',
          status: 'error',
          message: 'Unsupported file type: text/plain',
        },
      ],
    });
    expect(statementsService.create).not.toHaveBeenCalled();
  });

  it('returns an error result for oversized google drive files', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: 'user-1', workspaceId: 'ws-1' });
    integrationRepository.findOne.mockResolvedValue({
      id: 'integration-1',
      provider: IntegrationProvider.GOOGLE_DRIVE,
      status: IntegrationStatus.CONNECTED,
      token: { accessToken: 'enc:access', refreshToken: 'enc:refresh' },
      driveSettings: null,
    });

    jest
      .spyOn(service as unknown as GoogleDriveServicePrivate, 'getDriveClient')
      .mockResolvedValue({
        files: {
          get: jest.fn().mockResolvedValue({
            data: {
              id: 'file-1',
              name: 'statement.pdf',
              mimeType: 'application/pdf',
              size: String(11 * 1024 * 1024),
            },
          }),
        },
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
});
