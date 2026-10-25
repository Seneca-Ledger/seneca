import { S3BackupListener } from '../../../../src/modules/open-protocol-integrations/s3-backup.listener';
import { OpenProtocolIntegrationsService } from '../../../../src/modules/open-protocol-integrations/open-protocol-integrations.service';
import type { StatementUploadedEvent } from '../../../../src/modules/notifications/events/notification-events';

const mockService = {
  autoBackupStatementToS3: vi.fn(),
};

const makeListener = () =>
  new S3BackupListener(mockService as unknown as OpenProtocolIntegrationsService);

const makeEvent = (): StatementUploadedEvent => ({
  workspaceId: 'ws-1',
  actorId: 'user-1',
  actorName: 'Test User',
  statementId: 'stmt-1',
  statementName: 'bank.csv',
});

describe('S3BackupListener', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls autoBackupStatementToS3 with workspaceId and statementId', async () => {
    await makeListener().onStatementUploaded(makeEvent());

    expect(mockService.autoBackupStatementToS3).toHaveBeenCalledWith('ws-1', 'stmt-1');
  });

  it('does not throw when backup fails', async () => {
    mockService.autoBackupStatementToS3.mockRejectedValueOnce(new Error('S3 error'));

    await expect(makeListener().onStatementUploaded(makeEvent())).resolves.toBeUndefined();
  });
});
