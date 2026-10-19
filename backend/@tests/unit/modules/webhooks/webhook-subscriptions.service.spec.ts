import { AuditAction, EntityType, Severity } from '../../../../src/entities/audit-event.entity';
import { WebhookEvent } from '../../../../src/entities/webhook-subscription.entity';
import { WebhookSubscriptionsService } from '../../../../src/modules/webhooks/services/webhook-subscriptions.service';

jest.mock('../../../../src/common/utils/egress-url.util', () => ({
  assertPublicEgressUrl: jest.fn().mockResolvedValue(undefined),
}));

describe('WebhookSubscriptionsService audit events', () => {
  const SECRET = 'super-signing-secret-123';
  const repo = {
    create: jest.fn((e: any) => ({ ...e })),
    save: jest.fn(async (e: any) => ({ id: 'sub-1', isActive: true, ...e })),
    findOne: jest.fn(),
    delete: jest.fn(),
  };
  const auditService = { createEvent: jest.fn() };
  let service: WebhookSubscriptionsService;

  const payload = () => JSON.stringify(auditService.createEvent.mock.calls);

  beforeEach(() => {
    jest.clearAllMocks();
    auditService.createEvent.mockResolvedValue({});
    service = new WebhookSubscriptionsService(repo as any, auditService as any);
  });

  it('logs creation as WARN with the URL host and events, never the secret or full URL', async () => {
    await service.create(
      'ws-1',
      {
        name: 'Zapier',
        url: 'https://hooks.example.com/catch/123?key=private-query',
        secret: SECRET,
        events: [WebhookEvent.STATEMENT_PROCESSED],
      },
      'user-1',
    );

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        entityType: EntityType.WEBHOOK,
        entityId: 'sub-1',
        action: AuditAction.CREATE,
        severity: Severity.WARN,
        meta: expect.objectContaining({
          urlHost: 'hooks.example.com',
          events: [WebhookEvent.STATEMENT_PROCESSED],
        }),
      }),
    );
    expect(payload()).not.toContain(SECRET);
    expect(payload()).not.toContain('private-query');
    expect(payload()).not.toMatch(/"secret"/);
  });

  it('flags a rotated secret without logging it, and a URL change as WARN', async () => {
    repo.findOne.mockResolvedValue({
      id: 'sub-1',
      workspaceId: 'ws-1',
      name: 'Zapier',
      url: 'https://old.example.com/hook',
      secret: 'old-secret-value-xyz',
      events: [],
      isActive: true,
    });

    await service.update(
      'sub-1',
      'ws-1',
      { url: 'https://new.example.com/hook', secret: SECRET },
      'user-1',
    );

    const [event] = auditService.createEvent.mock.calls[0];
    expect(event).toMatchObject({
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: {
        before: { urlHost: 'old.example.com' },
        after: { urlHost: 'new.example.com' },
      },
      meta: expect.objectContaining({ secretChanged: true }),
    });
    expect(payload()).not.toContain(SECRET);
    expect(payload()).not.toContain('old-secret-value-xyz');
  });

  it('logs a rename as INFO', async () => {
    repo.findOne.mockResolvedValue({
      id: 'sub-1',
      name: 'a',
      url: 'https://x.example.com',
      secret: SECRET,
      events: [],
      isActive: true,
    });

    await service.update('sub-1', 'ws-1', { name: 'b' }, 'user-1');

    expect(auditService.createEvent.mock.calls[0][0].severity).toBe(Severity.INFO);
  });

  it('logs deletion and still deletes when the audit write fails', async () => {
    repo.findOne.mockResolvedValue({
      id: 'sub-1',
      name: 'a',
      url: 'https://x.example.com',
      secret: SECRET,
      events: [],
      isActive: true,
    });
    auditService.createEvent.mockRejectedValue(new Error('audit down'));

    await expect(service.delete('sub-1', 'ws-1', 'user-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith({ id: 'sub-1', workspaceId: 'ws-1' });
    expect(auditService.createEvent.mock.calls[0][0]).toMatchObject({
      action: AuditAction.DELETE,
      severity: Severity.WARN,
    });
  });
});
