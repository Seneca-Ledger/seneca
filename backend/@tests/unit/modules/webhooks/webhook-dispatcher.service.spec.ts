import { WebhookEvent } from '../../../../src/entities/webhook-subscription.entity';
import { WebhookDispatcherService } from '../../../../src/modules/webhooks/services/webhook-dispatcher.service';

describe('WebhookDispatcherService', () => {
  const subscriptions = { findActiveByWorkspaceAndEvent: jest.fn() };
  const deliveries = { enqueue: jest.fn() };
  const plugins = { isEnabled: jest.fn() };
  const service = new WebhookDispatcherService(
    subscriptions as any,
    deliveries as any,
    plugins as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    subscriptions.findActiveByWorkspaceAndEvent.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
  });

  it('queues a delivery per matching subscription while webhooks are on', async () => {
    plugins.isEnabled.mockResolvedValue(true);

    await service.dispatch('ws-1', WebhookEvent.STATEMENT_PROCESSED, { a: 1 });

    expect(plugins.isEnabled).toHaveBeenCalledWith('ws-1', 'webhooks');
    expect(deliveries.enqueue).toHaveBeenCalledTimes(2);
  });

  it('queues nothing while webhooks are off', async () => {
    plugins.isEnabled.mockResolvedValue(false);

    await service.dispatch('ws-1', WebhookEvent.STATEMENT_PROCESSED, { a: 1 });

    expect(subscriptions.findActiveByWorkspaceAndEvent).not.toHaveBeenCalled();
    expect(deliveries.enqueue).not.toHaveBeenCalled();
  });
});
