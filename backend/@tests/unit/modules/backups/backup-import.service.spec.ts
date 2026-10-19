import { AuditAction, EntityType, Severity } from '../../../../src/entities/audit-event.entity';
import { BackupImportService } from '../../../../src/modules/backups/backup-import.service';

const audit = () => ({ createEvent: jest.fn().mockResolvedValue({}) });

describe('BackupImportService', () => {
  it('requires a verified preview by the same user before restoring its exact archive', async () => {
    const restore = {
      preview: jest.fn().mockResolvedValue({ workspaceName: 'Finance', fileCount: 2 }),
      restore: jest.fn().mockResolvedValue({ id: 'new-workspace' }),
    };
    const service = new BackupImportService(restore as never, audit() as never);
    const user = { id: 'user-1' } as never;
    const archive = Buffer.from('encrypted archive');

    const preview = await service.preview(user, archive, 'password');
    await service.restore(preview.importId, user, archive, 'password');

    expect(restore.restore).toHaveBeenCalledWith(archive, 'password', user, undefined);
  });

  it('rejects a restore with an archive different from the previewed one', async () => {
    const restore = { preview: jest.fn().mockResolvedValue({ workspaceName: 'Finance', fileCount: 2 }), restore: jest.fn() };
    const service = new BackupImportService(restore as never, audit() as never);
    const user = { id: 'user-1' } as never;
    const preview = await service.preview(user, Buffer.from('archive-a'), 'password');

    await expect(service.restore(preview.importId, user, Buffer.from('archive-b'), 'password')).rejects.toThrow('expired');
  });

  it('logs a completed restore as a CRITICAL import into the restored workspace', async () => {
    const restore = {
      preview: jest.fn().mockResolvedValue({ workspaceName: 'Finance', fileCount: 2 }),
      restore: jest.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance (restored)' }),
    };
    const auditService = audit();
    const service = new BackupImportService(restore as never, auditService as never);
    const user = { id: 'user-1' } as never;
    const archive = Buffer.from('encrypted archive');

    const preview = await service.preview(user, archive, 'backup password');
    expect(auditService.createEvent).not.toHaveBeenCalled();
    await service.restore(preview.importId, user, archive, 'backup password');

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'new-workspace',
        actorId: 'user-1',
        entityType: EntityType.BACKUP,
        entityId: preview.importId,
        action: AuditAction.IMPORT,
        severity: Severity.CRITICAL,
      }),
    );
    expect(JSON.stringify(auditService.createEvent.mock.calls)).not.toContain('backup password');
  });

  it('returns the restored workspace when the audit write fails', async () => {
    const restore = {
      preview: jest.fn().mockResolvedValue({ workspaceName: 'Finance', fileCount: 2 }),
      restore: jest.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance' }),
    };
    const auditService = { createEvent: jest.fn().mockRejectedValue(new Error('audit down')) };
    const service = new BackupImportService(restore as never, auditService as never);
    const user = { id: 'user-1' } as never;
    const archive = Buffer.from('encrypted archive');
    const preview = await service.preview(user, archive, 'password');

    await expect(service.restore(preview.importId, user, archive, 'password')).resolves.toEqual({
      id: 'new-workspace',
      name: 'Finance',
    });
  });
});
