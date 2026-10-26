import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreateWebhookSubscriptionBody,
  UpdateWebhookSubscriptionBody,
  WebhookActionResult,
  WebhookDeliveryList,
  WebhookIdParams,
  WebhookSubscriptionItem,
  WebhookSubscriptionList,
  WebhookTestQueued,
} from '../../contracts';
import { User } from '../../entities/user.entity';
import { WebhookEvent } from '../../entities/webhook-subscription.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspacePluginsService } from '../workspaces/workspace-plugins.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhookSubscriptionsService } from './services/webhook-subscriptions.service';

/**
 * A subscription sends the workspace's events to any outside URL, so setting
 * one up is managing an integration (owner and admins), not editing statements.
 */
@ApiTags('Webhook Subscriptions')
@Controller('webhook-subscriptions')
export class WebhookSubscriptionsController {
  constructor(
    private readonly service: WebhookSubscriptionsService,
    private readonly deliveryService: WebhookDeliveryService,
    private readonly plugins: WorkspacePluginsService,
    dispatcher: WebhookDispatcherService,
  ) {}

  @Post()
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(WebhookSubscriptionItem)
  async create(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateWebhookSubscriptionBody) dto: CreateWebhookSubscriptionBody,
    @CurrentUser() user: User,
  ) {
    return this.service.create(workspaceId, dto, user.id); // secret returned only on creation
  }

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(WebhookSubscriptionList)
  async findAll(@WorkspaceId() workspaceId: string) {
    const subs = await this.service.findAll(workspaceId);
    return subs.map(({ secret, ...rest }) => rest); // never return secret
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(WebhookSubscriptionItem)
  async findOne(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const { secret, ...rest } = await this.service.findOne(id, workspaceId);
    return rest;
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(WebhookSubscriptionItem)
  async update(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateWebhookSubscriptionBody) dto: UpdateWebhookSubscriptionBody,
    @CurrentUser() user: User,
  ) {
    const { secret, ...rest } = await this.service.update(id, workspaceId, dto, user.id);
    return rest;
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(WebhookActionResult)
  async delete(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.service.delete(id, workspaceId, user.id);
    return { success: true };
  }

  @Get(':id/deliveries')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(WebhookDeliveryList)
  async deliveries(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.service.findOne(id, workspaceId); // scope check
    return this.deliveryService.findForSubscription(id);
  }

  @Post(':id/test')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @SchemaResponse(WebhookTestQueued)
  @ApiOperation({ summary: 'Send a test ping to the subscription URL' })
  async testPing(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const sub = await this.service.findOne(id, workspaceId);
    await this.plugins.assertEnabled(workspaceId, 'webhooks');
    await this.deliveryService.enqueue(sub.id, WebhookEvent.STATEMENT_PROCESSED, {
      event: WebhookEvent.STATEMENT_PROCESSED,
      test: true,
      timestamp: new Date().toISOString(),
    });
    return { success: true, message: 'Test delivery queued' };
  }
}
