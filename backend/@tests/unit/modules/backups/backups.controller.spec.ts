import { BackupDestinationKind, BackupRunTrigger } from '../../../../src/entities';
import { BackupsController } from '../../../../src/modules/backups/backups.controller';

describe('BackupsController', () => {
  it('forwards a configuration update and manual run to the backups service', async () => {
    const service = {
      configure: jest.fn().mockResolvedValue({ destinationKind: BackupDestinationKind.LOCAL }),
      createRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
    };
    const controller = new BackupsController(service as never, {} as never);
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

    await controller.configure(user, 'workspace-2', {
      destinationKind: BackupDestinationKind.LOCAL,
      destinationPath: 'nightly',
      password: 'backup password',
    });
    await controller.createRun(user, 'workspace-2');

    // The workspace of the request, not the one the user registered with.
    expect(service.configure).toHaveBeenCalledWith(
      user,
      'workspace-2',
      expect.objectContaining({ destinationPath: 'nightly' }),
    );
    expect(service.createRun).toHaveBeenCalledWith(user, 'workspace-2', BackupRunTrigger.MANUAL);
  });

  it('returns an owner-authorized archive as an attachment', async () => {
    const service = {
      downloadRun: jest.fn().mockResolvedValue({ fileName: 'backup.seneca-backup', contents: Buffer.from('backup') }),
    };
    const controller = new BackupsController(service as never, {} as never);
    const response = { setHeader: jest.fn(), send: jest.fn() };
    const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

    await controller.downloadRun('run-1', user, 'workspace-1', response as never);

    expect(service.downloadRun).toHaveBeenCalledWith(user, 'workspace-1', 'run-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
    // Built with the shared buildContentDisposition helper, which percent-encodes
    // the name and adds the RFC 5987 form instead of interpolating it raw.
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="backup.seneca-backup"; filename*=UTF-8\'\'backup.seneca-backup',
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from('backup'));
  });

  it('returns the new workspace identity after a confirmed import', async () => {
    const imports = { restore: jest.fn().mockResolvedValue({ id: 'workspace-new', name: 'Restored Finance' }) };
    const controller = new BackupsController({} as never, imports as never);
    const result = await controller.restoreImport(
      'import-1',
      { id: 'user-1' } as never,
      { buffer: Buffer.from('archive') } as never,
      'password',
    );

    expect(result).toEqual({ workspaceId: 'workspace-new', workspaceName: 'Restored Finance' });
  });
});
