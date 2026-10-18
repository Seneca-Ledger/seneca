import { Injectable, Logger } from '@nestjs/common';
import { WebhookEvent } from '../../../entities/webhook-subscription.entity';
import { WorkspacePluginsService } from '../../workspaces/workspace-plugins.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly subscriptionsService: WebhookSubscriptionsService,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly plugins: WorkspacePluginsService,
  ) {}

  async dispatch(
    workspaceId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (!(await this.plugins.isEnabled(workspaceId, 'webhooks'))) {
      return;
    }
    const subscriptions = await this.subscriptionsService.findActiveByWorkspaceAndEvent(
      workspaceId,
      event,
    );
    await Promise.all(
      subscriptions.map(async sub => {
        try {
          await this.deliveryService.enqueue(sub.id, event, payload);
        } catch (err) {
          this.logger.error(`Failed to enqueue delivery for subscription ${sub.id}`, err);
        }
      }),
    );
  }
}
