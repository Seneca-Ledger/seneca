import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { appError } from '../../../common/errors/app-error';
import type { User } from '../../../entities/user.entity';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  /**
   * Nest calls this after the strategy validates the token. We add a small safety
   * check so tests (and production) fail fast when the user payload is missing
   * mandatory fields.
   */
  handleRequest<TUser extends User = User>(
    err: Error | null,
    user: TUser | false,
    _info?: unknown,
    _context?: ExecutionContext,
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    if (user.tokenVersion === undefined || user.tokenVersion === null) {
      throw new UnauthorizedException(appError('AUTH_REFRESH_TOKEN_VERSION_MISSING'));
    }

    return user;
  }
}
