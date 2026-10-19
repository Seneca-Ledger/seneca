import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { type User, UserRole } from '../../entities/user.entity';
import { appError } from '../errors/app-error';

/**
 * Instance administrators signed in through the app, for what belongs to the
 * whole server (updates, the shared Telegram bot). API keys are refused even
 * when their owner is an admin: server-wide changes are not something an
 * integration should be able to make.
 */
@Injectable()
export class InstanceAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User; apiKey?: unknown }>();
    if (request.user?.role !== UserRole.ADMIN || request.apiKey) {
      throw new ForbiddenException(appError('INSTANCE_ADMIN_ONLY'));
    }
    return true;
  }
}
