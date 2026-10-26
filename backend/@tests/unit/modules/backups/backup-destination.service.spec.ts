import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { BackupDestinationKind } from '../../../../src/entities';
import { BackupDestinationService } from '../../../../src/modules/backups/backup-destination.service';

describe('BackupDestinationService', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-destination-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('stores local workspace backups under the configured relative destination and prunes old snapshots', async () => {
    const service = new BackupDestinationService(root, { findOne: vi.fn() } as never);
    const config = {
      destinationKind: BackupDestinationKind.LOCAL,
      destinationPath: 'nightly',
      retentionCount: 1,
      workspaceId: 'workspace-1',
    } as never;

    await service.store(config, 'backup-1.seneca-backup', Buffer.from('first'));
    const saved = await service.store(config, 'backup-2.seneca-backup', Buffer.from('second'));

    expect(saved).toBe('nightly-workspace-1/backup-2.seneca-backup');
    await expect(fs.readdir(path.join(root, 'nightly-workspace-1'))).resolves.toEqual([
      'backup-2.seneca-backup',
    ]);
  });

  it('retains only the requested number of completed Nextcloud snapshots', async () => {
    const service = new BackupDestinationService(root, { findOne: vi.fn() } as never);
    const client = {
      getDirectoryContents: vi.fn().mockResolvedValue([
        { type: 'directory', filename: '/seneca/workspace/folder' },
        { type: 'file', filename: '/seneca/workspace/readme.txt' },
        { type: 'file', filename: '/seneca/workspace/backup-1.seneca-backup' },
        { type: 'file', filename: '/seneca/workspace/backup-2.seneca-backup' },
        { type: 'file', filename: '/seneca/workspace/backup-3.seneca-backup' },
      ]),
      deleteFile: vi.fn(),
    };

    await (service as never as { retainNextcloud: (client: unknown, directory: string, keep: number) => Promise<void> }).retainNextcloud(
      client,
      '/seneca/workspace',
      2,
    );

    expect(client.deleteFile).toHaveBeenCalledTimes(1);
    expect(client.deleteFile).toHaveBeenCalledWith('/seneca/workspace/backup-1.seneca-backup');
  });
});
