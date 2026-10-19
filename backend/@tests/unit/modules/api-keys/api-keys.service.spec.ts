import { NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, Severity } from '../../../../src/entities/audit-event.entity';
import { ApiKeysService } from '../../../../src/modules/api-keys/api-keys.service';

describe('ApiKeysService audit events', () => {
  const repo = {
    create: jest.fn((e: any) => ({ ...e })),
    save: jest.fn(async (e: any) => ({ id: 'key-1', createdAt: new Date(), ...e })),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const auditService = { createEvent: jest.fn() };
  let service: ApiKeysService;

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.createEvent.mockResolvedValue({});
    service = new ApiKeysService(repo as any, auditService as any);
  });

  it('logs creation as WARN with name and prefix, never the key or its hash', async () => {
    const generated = await service.generate('ws-1', 'user-1', 'CI key');
    const { keyHash } = repo.save.mock.calls[0][0];

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        entityType: EntityType.API_KEY,
        entityId: 'key-1',
        action: AuditAction.CREATE,
        severity: Severity.WARN,
        meta: { name: 'CI key', prefix: generated.prefix, scopes: null },
      }),
    );
    const payload = JSON.stringify(auditService.createEvent.mock.calls);
    expect(payload).not.toContain(generated.key);
    expect(payload).not.toContain(generated.key.slice(12));
    expect(payload).not.toContain(keyHash);
  });

  it('logs revocation as DELETE with the revoking user', async () => {
    repo.findOne.mockResolvedValue({
      id: 'key-1',
      workspaceId: 'ws-1',
      name: 'CI key',
      prefix: 'abcd1234',
      keyHash: 'f'.repeat(64),
    });

    await service.revoke('key-1', 'ws-1', 'user-2');

    const [event] = auditService.createEvent.mock.calls[0];
    expect(event).toMatchObject({
      workspaceId: 'ws-1',
      actorId: 'user-2',
      entityId: 'key-1',
      action: AuditAction.DELETE,
      severity: Severity.WARN,
    });
    expect(JSON.stringify(event)).not.toContain('ffffffff');
  });

  it('does not log a revoke of an unknown key', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.revoke('nope', 'ws-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(auditService.createEvent).not.toHaveBeenCalled();
  });

  it('still returns the new key when the audit write fails', async () => {
    auditService.createEvent.mockRejectedValue(new Error('audit down'));

    await expect(service.generate('ws-1', 'user-1', 'CI key')).resolves.toMatchObject({
      id: 'key-1',
      key: expect.stringMatching(/^lum_/),
    });
  });
});
