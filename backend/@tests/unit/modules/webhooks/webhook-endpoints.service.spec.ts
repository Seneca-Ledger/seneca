import { NotFoundException } from '@nestjs/common';
import { AuditAction, EntityType, Severity } from '../../../../src/entities/audit-event.entity';
import { WebhookEndpointsService } from '../../../../src/modules/webhooks/services/webhook-endpoints.service';

describe('WebhookEndpointsService', () => {
  let service: WebhookEndpointsService;
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };
  const auditService = { createEvent: jest.fn() };

  beforeEach(() => {
    service = new WebhookEndpointsService(mockRepo as any, auditService as any);
    jest.clearAllMocks();
    auditService.createEvent.mockResolvedValue({});
  });

  it('should generate a 64-char hex token on create', async () => {
    const dto = { name: 'n8n upload' };
    mockRepo.create.mockReturnValue({ ...dto, token: '' });
    mockRepo.save.mockImplementation(async (e: any) => e);

    const result = await service.create('ws-1', dto, 'user-1');

    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should throw NotFoundException for wrong workspace', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('id-1', 'ws-wrong')).rejects.toThrow(NotFoundException);
  });

  describe('audit events', () => {
    it('logs creation as WARN without the inbound token', async () => {
      mockRepo.create.mockImplementation((e: any) => ({ ...e }));
      mockRepo.save.mockImplementation(async (e: any) => ({ ...e, id: 'ep-1' }));

      const result = await service.create('ws-1', { name: 'n8n upload' }, 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          actorId: 'user-1',
          entityType: EntityType.WEBHOOK,
          entityId: 'ep-1',
          action: AuditAction.CREATE,
          severity: Severity.WARN,
        }),
      );
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      expect(payload).not.toContain(result.token);
      expect(payload).not.toContain(result.token.slice(0, 8));
      expect(payload).not.toMatch(/"token"/);
    });

    it('logs update and delete against the endpoint', async () => {
      const stored = { id: 'ep-1', workspaceId: 'ws-1', name: 'old', token: 'a'.repeat(64), isActive: true };
      mockRepo.findOne.mockResolvedValue({ ...stored });
      mockRepo.save.mockImplementation(async (e: any) => e);

      await service.update('ep-1', 'ws-1', { name: 'new' }, 'user-1');
      await service.delete('ep-1', 'ws-1', 'user-1');

      const [[updated], [deleted]] = auditService.createEvent.mock.calls;
      expect(updated).toMatchObject({
        action: AuditAction.UPDATE,
        diff: { before: { name: 'old' }, after: { name: 'new' } },
      });
      expect(deleted).toMatchObject({ action: AuditAction.DELETE, severity: Severity.WARN });
      expect(JSON.stringify(auditService.createEvent.mock.calls)).not.toContain('aaaaaaaa');
    });

    it('still creates the endpoint when the audit write fails', async () => {
      mockRepo.create.mockImplementation((e: any) => ({ ...e }));
      mockRepo.save.mockImplementation(async (e: any) => ({ ...e, id: 'ep-1' }));
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(service.create('ws-1', { name: 'n8n' }, 'user-1')).resolves.toMatchObject({
        id: 'ep-1',
      });
    });
  });
});
