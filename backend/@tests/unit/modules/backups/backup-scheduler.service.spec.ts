import { BackupDestinationKind, BackupRunTrigger } from '../../../../src/entities';
import { BackupSchedulerService } from '../../../../src/modules/backups/backup-scheduler.service';

describe('BackupSchedulerService', () => {
  it('runs an enabled configuration at its scheduled local minute only once', async () => {
    const configuration = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      dailyTime: '03:00',
      timeZone: 'Asia/Jerusalem',
      enabled: true,
      destinationKind: BackupDestinationKind.LOCAL,
    };
    const configurations = { find: vi.fn().mockResolvedValue([configuration]) };
    const workspaces = { findOne: vi.fn().mockResolvedValue({ id: 'workspace-1' }) };
    const backups = { runConfiguration: vi.fn().mockResolvedValue(undefined) };
    const scheduler = new BackupSchedulerService(configurations as never, workspaces as never, backups as never);
    const now = new Date('2026-01-01T01:00:00.000Z');

    await scheduler.runDueBackups(now);
    await scheduler.runDueBackups(now);

    expect(backups.runConfiguration).toHaveBeenCalledTimes(1);
    expect(backups.runConfiguration).toHaveBeenCalledWith(
      { id: 'workspace-1' },
      configuration,
      BackupRunTrigger.SCHEDULED,
    );
  });

  it('skips disabled configurations and configurations outside their local scheduled minute', async () => {
    const configurations = {
      find: vi.fn().mockResolvedValue([
        { id: 'disabled', workspaceId: 'one', dailyTime: '03:00', timeZone: 'Asia/Jerusalem', enabled: false },
        { id: 'later', workspaceId: 'two', dailyTime: '04:00', timeZone: 'Asia/Jerusalem', enabled: true },
      ]),
    };
    const workspaces = { findOne: vi.fn() };
    const backups = { runConfiguration: vi.fn() };
    const scheduler = new BackupSchedulerService(configurations as never, workspaces as never, backups as never);

    await scheduler.runDueBackups(new Date('2026-01-01T01:00:00.000Z'));

    expect(workspaces.findOne).not.toHaveBeenCalled();
    expect(backups.runConfiguration).not.toHaveBeenCalled();
  });
});
