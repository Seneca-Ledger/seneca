import {
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { ApiKeysService } from '../../modules/api-keys/api-keys.service';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../../modules/auth/strategies/jwt.strategy';
import { API_KEY_ALLOWED_KEY } from '../decorators/api-key-allowed.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import type { Permission } from '../enums/permissions.enum';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private apiKeysService: ApiKeysService | null = null;

  constructor(
    private reflector: Reflector,
    private moduleRef: ModuleRef,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (apiKey) {
      return this.authenticateWithApiKey(apiKey, request, context);
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  private async authenticateWithApiKey(
    rawKey: string,
    request: AuthenticatedRequest,
    context: ExecutionContext,
  ): Promise<boolean> {
    let apiKeysService = this.apiKeysService;
    if (!apiKeysService) {
      const { ApiKeysService } = await import('../../modules/api-keys/api-keys.service');
      apiKeysService = this.moduleRef.get<ApiKeysService>(ApiKeysService, { strict: false });
      this.apiKeysService = apiKeysService;
    }

    const apiKey = await apiKeysService.validate(rawKey);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }
    // A deactivated account loses its keys too, as it loses its sessions (JwtStrategy).
    if (apiKey.user?.isActive === false) {
      throw new UnauthorizedException('User is inactive');
    }

    request.user = apiKey.user as AuthenticatedUser;
    request.apiKeyWorkspaceId = apiKey.workspaceId;
    request.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes ?? null,
    };

    const requestedWorkspaceId = request.headers['x-workspace-id'];
    if (requestedWorkspaceId && String(requestedWorkspaceId) !== apiKey.workspaceId) {
      throw new ForbiddenException('API key is not valid for the requested workspace');
    }
    request.headers['x-workspace-id'] = apiKey.workspaceId;

    if (request.apiKey.scopes !== null && !this.checksScopes(context)) {
      throw new ForbiddenException('This route does not accept scoped API keys');
    }

    return true;
  }

  /**
   * Scopes are enforced by `PermissionsGuard`, against the permissions a route
   * declares. A route that declares none would run with the key owner's full
   * rights (deleting a workspace, inviting admins), so a scoped key may use it
   * only when the route is marked `@ApiKeyAllowed()`. Legacy keys without
   * scopes keep their owner's reach.
   */
  private checksScopes(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    return (
      (required?.length ?? 0) > 0 ||
      this.reflector.getAllAndOverride<boolean>(API_KEY_ALLOWED_KEY, targets) === true
    );
  }
}
