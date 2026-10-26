import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { appError } from '../../../common/errors/app-error';
import { WorkspacePluginsService } from '../../workspaces/workspace-plugins.service';
import { WebhookEndpointsService } from '../services/webhook-endpoints.service';

@Injectable()
export class WebhookTokenGuard implements CanActivate {
  constructor(
    private readonly endpointsService: WebhookEndpointsService,
    private readonly plugins: WorkspacePluginsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { webhookEndpoint: any }>();
    const token = request.params.token;
    if (!token) throw new UnauthorizedException(appError('WEBHOOK_TOKEN_MISSING'));

    const endpoint = await this.endpointsService.findByToken(token);
    if (!endpoint) throw new UnauthorizedException(appError('WEBHOOK_TOKEN_INVALID'));
    await this.plugins.assertEnabled(endpoint.workspaceId, 'webhooks');

    request.webhookEndpoint = endpoint;
    return true;
  }
}
