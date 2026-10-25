import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { Audit } from '@/modules/audit/decorators/audit.decorator';
import { AuditInterceptor } from '@/modules/audit/interceptors/audit.interceptor';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of } from 'rxjs';

class TestController {
  @Audit(EntityType.TRANSACTION, { includeBody: true, includeDiff: true, severity: Severity.WARN })
  handler() {
    return { id: 'tx-1' };
  }
}

describe('AuditInterceptor', () => {
  it('creates audit event for decorated handler', async () => {
    const auditService = {
      createEvent: vi.fn().mockResolvedValue({}),
    };
    const interceptor = new AuditInterceptor(new Reflector(), auditService as any);

    const context = {
      getHandler: () => TestController.prototype.handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          params: { id: 'tx-1' },
          body: { amount: 10 },
          user: { id: 'user-1' },
          workspace: { id: 'ws-1' },
          path: '/transactions/tx-1',
        }),
      }),
    } as any;

    const callHandler = {
      handle: () => of({ id: 'tx-1', amount: 20 }),
    };

    await lastValueFrom(interceptor.intercept(context as any, callHandler as any));

    expect(auditService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: EntityType.TRANSACTION,
        entityId: 'tx-1',
        action: AuditAction.CREATE,
        severity: Severity.WARN,
        diff: {
          before: { amount: 10 },
          after: { id: 'tx-1', amount: 20 },
        },
      }),
    );
  });
});
