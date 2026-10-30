import { WebhookDeliveryStatus } from '../../../../src/entities/webhook-delivery.entity';
import { WebhookDeliveryService } from '../../../../src/modules/webhooks/services/webhook-delivery.service';

describe('WebhookDeliveryService', () => {
  const repo = { update: vi.fn(), create: vi.fn(), save: vi.fn() };
  const service = new WebhookDeliveryService(repo as any);

  beforeEach(() => vi.clearAllMocks());

  it('gives a retried delivery its attempts back, so an exhausted one is sent again', async () => {
    await service.resetForRetry('d1');

    expect(repo.update).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      }),
    );
  });
});
