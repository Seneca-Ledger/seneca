import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreatedWebhookEndpoint,
  CreateWebhookEndpointBody,
  UpdateWebhookEndpointBody,
  WebhookEndpointList,
  WebhookIdParams,
} from '../../contracts';
import { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhookEndpointsService } from './services/webhook-endpoints.service';

/**
 * An endpoint token lets anyone holding it upload into the workspace, so minting
 * or changing one is managing an integration (owner and admins).
 */
@ApiTags('Webhook Endpoints')
@Controller('webhook-endpoints')
export class WebhookEndpointsController {
  constructor(private readonly service: WebhookEndpointsService) {}

  @Post()
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Create inbound webhook endpoint' })
  @SchemaResponse(CreatedWebhookEndpoint)
  async create(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateWebhookEndpointBody) dto: CreateWebhookEndpointBody,
    @CurrentUser() user: User,
  ) {
    return this.service.create(workspaceId, dto, user.id); // token returned only on creation
  }

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(WebhookEndpointList)
  async findAll(@WorkspaceId() workspaceId: string) {
    const endpoints = await this.service.findAll(workspaceId);
    return endpoints.map(({ token, ...rest }) => ({
      ...rest,
      tokenPreview: `${token.slice(0, 8)}...`,
    }));
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async findOne(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const { token, ...rest } = await this.service.findOne(id, workspaceId);
    return { ...rest, tokenPreview: `${token.slice(0, 8)}...` };
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async update(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateWebhookEndpointBody) dto: UpdateWebhookEndpointBody,
    @CurrentUser() user: User,
  ) {
    const { token, ...rest } = await this.service.update(id, workspaceId, dto, user.id);
    return { ...rest, tokenPreview: `${token.slice(0, 8)}...` };
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  async delete(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.service.delete(id, workspaceId, user.id);
    return { success: true };
  }
}
