import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { appError } from '../../common/errors/app-error';
import { type User, UserRole } from '../../entities/user.entity';

/**
 * Instance administrators signed in through the app. API keys are refused even
 * when their owner is an admin: replacing the running containers is not
 * something an integration should be able to do.
 */
@Injectable()
export class InstanceAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User; apiKey?: unknown }>();
    if (request.user?.role !== UserRole.ADMIN || request.apiKey) {
      throw new ForbiddenException(appError('SYSTEM_UPDATE_ADMIN_ONLY'));
    }
    return true;
  }
}
