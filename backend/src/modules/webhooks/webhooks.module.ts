import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { WebhookEndpoint } from '../../entities/webhook-endpoint.entity';
import { WebhookSubscription } from '../../entities/webhook-subscription.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { AuditModule } from '../audit/audit.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { StatementsModule } from '../statements/statements.module';
import { WorkspacePluginsModule } from '../workspaces/workspace-plugins.module';
import { WebhookTokenGuard } from './guards/webhook-token.guard';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhookEndpointsService } from './services/webhook-endpoints.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { WebhookSubscriptionsService } from './services/webhook-subscriptions.service';
import { WebhookDeliveriesController } from './webhook-deliveries.controller';
import { WebhookEndpointsController } from './webhook-endpoints.controller';
import { WebhookEventsListener } from './webhook-events.listener';
import { WebhookInboundController } from './webhook-inbound.controller';
import { WebhookInboundService } from './webhook-inbound.service';
import { WebhookSubscriptionsController } from './webhook-subscriptions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEndpoint,
      WebhookSubscription,
      WebhookDelivery,
      WorkspaceMember,
    ]),
    StatementsModule,
    ReceiptsModule,
    AuditModule,
    WorkspacePluginsModule,
  ],
  controllers: [
    WebhookInboundController,
    WebhookEndpointsController,
    WebhookSubscriptionsController,
    WebhookDeliveriesController,
  ],
  providers: [
    WebhookEndpointsService,
    WebhookSubscriptionsService,
    WebhookDeliveryService,
    WebhookDispatcherService,
    WebhookProcessorService,
    WebhookInboundService,
    WebhookEventsListener,
    WebhookTokenGuard,
  ],
})
export class WebhooksModule {}
