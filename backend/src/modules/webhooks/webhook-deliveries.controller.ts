import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { WebhookActionResult, WebhookIdParams } from '../../contracts';
import { WebhookDeliveryService } from './services/webhook-delivery.service';

@ApiTags('Webhook Deliveries')
@Controller('webhook-deliveries')
export class WebhookDeliveriesController {
  constructor(private readonly deliveryService: WebhookDeliveryService) {}

  @Post(':id/retry')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(WebhookActionResult)
  async retry(
    @SchemaParams(WebhookIdParams) { id }: WebhookIdParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.deliveryService.findOneScoped(id, workspaceId);
    await this.deliveryService.resetForRetry(id);
    return { success: true };
  }
}
