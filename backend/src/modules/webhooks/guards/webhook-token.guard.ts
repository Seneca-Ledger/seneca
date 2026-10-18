import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
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
    if (!token) throw new UnauthorizedException('Missing webhook token');

    const endpoint = await this.endpointsService.findByToken(token);
    if (!endpoint) throw new UnauthorizedException('Invalid or inactive webhook token');
    await this.plugins.assertEnabled(endpoint.workspaceId, 'webhooks');

    request.webhookEndpoint = endpoint;
    return true;
  }
}
