import { BackupDestinationKind, BackupRunStatus, BackupRunTrigger } from '../../../../src/entities';
import { AuditAction, EntityType, Severity } from '../../../../src/entities/audit-event.entity';
import { BackupsService } from '../../../../src/modules/backups/backups.service';

describe('BackupsService', () => {
  const user = { id: 'user-1', workspaceId: 'workspace-1' } as never;

  it('configures an encrypted automatic backup without persisting the password', async () => {
    const configurationRepository = repository();
    const service = createService({ configurationRepository });

    const result = await service.configure(user, 'workspace-1', {
      destinationKind: BackupDestinationKind.LOCAL,
      destinationPath: 'nightly',
      dailyTime: '02:30',
      timeZone: 'Asia/Jerusalem',
      retentionCount: 7,
      enabled: true,
      password: 'backup password',
    });

    expect(configurationRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedDataKey: 'server-wrapped-data-key',
        passwordEnvelope: expect.any(Object),
        destinationPath: 'nightly',
      }),
    );
    expect(JSON.stringify(configurationRepository.save.mock.calls[0][0])).not.toContain('backup password');
    expect(result).not.toHaveProperty('encryptedDataKey');
    expect(result).not.toHaveProperty('passwordEnvelope');
  });

  it('creates a manual run, stores the encrypted snapshot, and records success', async () => {
    const configuration = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      destinationKind: BackupDestinationKind.LOCAL,
      destinationPath: 'nightly',
      retentionCount: 7,
      encryptedDataKey: 'server-wrapped-data-key',
      passwordEnvelope: { kdf: {}, wrappedDataKey: {} },
      enabled: true,
    };
    const configurationRepository = repository(configuration);
    const runRepository = repository();
    const destination = { store: jest.fn().mockResolvedValue('nightly-workspace-1/backup.seneca-backup') };
    const archive = { create: jest.fn().mockResolvedValue(Buffer.from('encrypted archive')) };
    const service = createService({ configurationRepository, runRepository, destination, archive });

    const run = await service.createRun(user, 'workspace-1', BackupRunTrigger.MANUAL);

    expect(archive.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({ id: 'workspace-1' }),
        collections: {
          workspace: [expect.objectContaining({ id: 'workspace-1', name: 'Finance' })],
          categories: [{ id: 'category-1' }],
        },
      }),
    );
    expect(destination.store).toHaveBeenCalledWith(
      configuration,
      expect.stringMatching(/\.seneca-backup$/),
      Buffer.from('encrypted archive'),
    );
    expect(run.status).toBe(BackupRunStatus.SUCCEEDED);
    expect(run.trigger).toBe(BackupRunTrigger.MANUAL);
  });

  describe('audit events', () => {
    const configInput = {
      destinationKind: BackupDestinationKind.LOCAL,
      destinationPath: 'nightly',
      password: 'backup password',
    };

    it('logs configure as BACKUP UPDATE without the password or wrapped keys', async () => {
      const auditService = { createEvent: jest.fn().mockResolvedValue({}) };
      const service = createService({ auditService });

      await service.configure(user, 'workspace-1', configInput);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          actorId: 'user-1',
          entityType: EntityType.BACKUP,
          entityId: 'saved-1',
          action: AuditAction.UPDATE,
          severity: Severity.INFO,
          meta: expect.objectContaining({ passwordChanged: true, firstConfiguration: true }),
        }),
      );
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      for (const leaked of ['backup password', 'server-wrapped-data-key', 'wrapped', 'salt']) {
        expect(payload).not.toContain(leaked);
      }
      expect(payload).not.toMatch(/encryptedDataKey|passwordEnvelope/);
    });

    it('logs a manual run as BACKUP CREATE', async () => {
      const auditService = { createEvent: jest.fn().mockResolvedValue({}) };
      const configurationRepository = repository({
        id: 'config-1',
        workspaceId: 'workspace-1',
        destinationKind: BackupDestinationKind.LOCAL,
        destinationPath: 'nightly',
        encryptedDataKey: 'server-wrapped-data-key',
        passwordEnvelope: { kdf: {}, wrappedDataKey: {} },
      });
      const destination = { store: jest.fn().mockResolvedValue('nightly/backup.seneca-backup') };
      const archive = { create: jest.fn().mockResolvedValue(Buffer.from('encrypted archive')) };
      const service = createService({ configurationRepository, destination, archive, auditService });

      const run = await service.createRun(user, 'workspace-1', BackupRunTrigger.MANUAL);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          entityType: EntityType.BACKUP,
          entityId: run.id,
          action: AuditAction.CREATE,
          severity: Severity.INFO,
          meta: { trigger: BackupRunTrigger.MANUAL, status: BackupRunStatus.SUCCEEDED },
        }),
      );
      expect(JSON.stringify(auditService.createEvent.mock.calls)).not.toContain('server-wrapped');
    });

    it('still saves the configuration when the audit write fails', async () => {
      const auditService = { createEvent: jest.fn().mockRejectedValue(new Error('audit down')) };
      const configurationRepository = repository();
      const service = createService({ configurationRepository, auditService });

      await expect(service.configure(user, 'workspace-1', configInput)).resolves.toBeDefined();
      expect(configurationRepository.save).toHaveBeenCalled();
    });
  });

  it('loads a completed run only from the owner workspace destination', async () => {
    const configuration = {
      id: 'config-1',
      workspaceId: 'workspace-1',
      destinationKind: BackupDestinationKind.LOCAL,
      destinationPath: 'nightly',
    };
    const configurationRepository = repository(configuration);
    const runRepository = repository({
      id: 'run-1',
      workspaceId: 'workspace-1',
      status: BackupRunStatus.SUCCEEDED,
      destinationFile: 'nightly-workspace-1/backup.seneca-backup',
    });
    const destination = { load: jest.fn().mockResolvedValue(Buffer.from('archive')) };
    const service = createService({ configurationRepository, runRepository, destination });

    const result = await service.downloadRun(user, 'workspace-1', 'run-1');

    expect(destination.load).toHaveBeenCalledWith(configuration, 'nightly-workspace-1/backup.seneca-backup');
    expect(result).toEqual({ fileName: 'backup.seneca-backup', contents: Buffer.from('archive') });
  });

  it('limits configuration and backup runs to the workspace owner', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'workspace-1', ownerId: 'another-user', name: 'Finance' }),
    };
    const service = new BackupsService(
      repository() as never,
      repository() as never,
      workspaceRepository as never,
      { initializeEncryption: jest.fn(), create: jest.fn() } as never,
      { encryptDataKey: jest.fn(), decryptDataKey: jest.fn() } as never,
      { collect: jest.fn() } as never,
      { store: jest.fn(), load: jest.fn() } as never,
    );

    await expect(service.getConfiguration(user, 'workspace-1')).rejects.toThrow(
      'Only the workspace owner',
    );
  });

  it('manages the backups of the workspace of the request', async () => {
    const workspaceRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'workspace-2', ownerId: 'user-1', name: 'Second' }),
    };
    const service = new BackupsService(
      repository() as never,
      repository() as never,
      workspaceRepository as never,
      { initializeEncryption: jest.fn(), create: jest.fn() } as never,
      { encryptDataKey: jest.fn(), decryptDataKey: jest.fn() } as never,
      { collect: jest.fn() } as never,
      { store: jest.fn(), load: jest.fn() } as never,
    );

    await service.getConfiguration(user, 'workspace-2');

    expect(workspaceRepository.findOne).toHaveBeenCalledWith({ where: { id: 'workspace-2' } });
  });
});

function repository(existing?: Record<string, unknown>) {
  const save = jest.fn().mockImplementation(value => Promise.resolve({ id: value.id || 'saved-1', ...value }));
  return {
    findOne: jest.fn().mockResolvedValue(existing ?? null),
    create: jest.fn().mockImplementation(value => value),
    save,
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function createService(overrides: Record<string, unknown> = {}) {
  const configurationRepository = overrides.configurationRepository ?? repository();
  const runRepository = overrides.runRepository ?? repository();
  const workspaceRepository = {
    findOne: jest.fn().mockResolvedValue({ id: 'workspace-1', ownerId: 'user-1', name: 'Finance' }),
  };
  const archive =
    overrides.archive ??
    ({
      initializeEncryption: jest.fn().mockResolvedValue({
        dataKey: Buffer.alloc(32, 1),
        passwordEnvelope: { kdf: { salt: 'salt' }, wrappedDataKey: { ciphertext: 'wrapped' } },
      }),
      create: jest.fn(),
    } as never);
  const keyService = {
    encryptDataKey: jest.fn().mockReturnValue('server-wrapped-data-key'),
    decryptDataKey: jest.fn().mockReturnValue(Buffer.alloc(32, 1)),
  };
  const dataService = { collect: jest.fn().mockResolvedValue({ collections: { categories: [{ id: 'category-1' }] }, files: [] }) };
  const destination = overrides.destination ?? { store: jest.fn() };
  const auditService = overrides.auditService ?? { createEvent: jest.fn().mockResolvedValue({}) };

  return new BackupsService(
    configurationRepository as never,
    runRepository as never,
    workspaceRepository as never,
    archive as never,
    keyService as never,
    dataService as never,
    destination as never,
    auditService as never,
  );
}
