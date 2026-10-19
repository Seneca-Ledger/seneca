import { WebhookDeliveryStatus } from '../../../../src/entities/webhook-delivery.entity';
import { WebhookProcessorService } from '../../../../src/modules/webhooks/services/webhook-processor.service';

describe('WebhookProcessorService with webhooks switched off', () => {
  const deliveryRepo = { save: jest.fn() };
  const subRepo = { findOne: jest.fn() };
  const plugins = { isEnabled: jest.fn() };
  const service = new WebhookProcessorService(
    deliveryRepo as any,
    subRepo as any,
    plugins as any,
  );
  const post = jest.fn();
  (service as any).postWithPinnedDns = post;

  beforeEach(() => jest.clearAllMocks());

  it('does not send a delivery queued before the switch went off, and leaves it retryable', async () => {
    subRepo.findOne.mockResolvedValue({
      id: 'sub-a',
      workspaceId: 'ws-1',
      url: 'https://a.example',
      secret: 's',
      isActive: true,
    });
    plugins.isEnabled.mockResolvedValue(false);

    await (service as any).processDelivery({
      id: 'd1',
      subscriptionId: 'sub-a',
      attemptCount: 0,
      maxAttempts: 3,
    });

    expect(plugins.isEnabled).toHaveBeenCalledWith('ws-1', 'webhooks');
    expect(post).not.toHaveBeenCalled();
    expect(deliveryRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'd1',
        status: WebhookDeliveryStatus.EXHAUSTED,
        attemptCount: 0,
        lastError: 'Webhooks are turned off for this workspace',
      }),
    );
  });
});
