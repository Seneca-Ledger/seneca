import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { WorkspacePluginsService } from '../workspaces/workspace-plugins.service';

/**
 * The MCP endpoint takes API keys only, and only while the workspace has the
 * MCP plugin on. Switching it off leaves the key's REST access alone.
 */
@Injectable()
export class McpAccessGuard implements CanActivate {
  constructor(private readonly plugins: WorkspacePluginsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    if (!(request.apiKey && request.apiKeyWorkspaceId)) {
      http.getResponse<Response>().setHeader('WWW-Authenticate', 'ApiKey header="X-Api-Key"');
      throw new UnauthorizedException('The MCP endpoint takes an API key in the X-Api-Key header');
    }
    await this.plugins.assertEnabled(request.apiKeyWorkspaceId, 'mcp');
    return true;
  }
}
