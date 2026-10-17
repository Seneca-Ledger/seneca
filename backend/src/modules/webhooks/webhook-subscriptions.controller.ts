import { Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreateWebhookSubscriptionBody,
  UpdateWebhookSubscriptionBody,
  WebhookSubscriptionList,
} from '../../contracts';
import { User } from '../../entities/user.entity';
import { WebhookEvent } from '../../entities/webhook-subscription.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WorkspacePluginsService } from '../workspaces/workspace-plugins.service';
import { WebhookDeliveryService } from './services/webhook-delivery.service';
import { WebhookDispatcherService } from './services/webhook-dispatcher.service';
import { WebhookSubscriptionsService } from './services/webhook-subscriptions.service';

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
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
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
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    const { secret, ...rest } = await this.service.findOne(id, workspaceId);
    return rest;
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async update(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateWebhookSubscriptionBody) dto: UpdateWebhookSubscriptionBody,
    @CurrentUser() user: User,
  ) {
    const { secret, ...rest } = await this.service.update(id, workspaceId, dto, user.id);
    return rest;
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.STATEMENT_DELETE)
  async delete(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.service.delete(id, workspaceId, user.id);
    return { success: true };
  }

  @Get(':id/deliveries')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async deliveries(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    await this.service.findOne(id, workspaceId); // scope check
    return this.deliveryService.findForSubscription(id);
  }

  @Post(':id/test')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Send a test ping to the subscription URL' })
  async testPing(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
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
