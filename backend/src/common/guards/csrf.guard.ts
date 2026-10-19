import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER,
  REFRESH_TOKEN_COOKIE,
} from '../../modules/auth/auth-cookies';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Double-submit CSRF check.
 *
 * Only requests authenticated by cookie need it: cookies are ambient
 * credentials the browser attaches to cross-site requests on its own, whereas
 * an `Authorization` or `X-Api-Key` header has to be set deliberately by the
 * caller and so cannot be forged by a third-party page. The token is delivered
 * in a readable cookie and must be echoed in a header — a cross-origin attacker
 * can cause the cookie to be sent but cannot read it to build the header.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    // Routes that establish a session rather than act on one — see @SkipCsrf.
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    // Header-authenticated clients are not exposed to CSRF.
    if (request.headers.authorization || request.headers['x-api-key']) {
      return true;
    }

    const cookies = request.cookies ?? {};
    const authenticatedByCookie = Boolean(
      cookies[ACCESS_TOKEN_COOKIE] || cookies[REFRESH_TOKEN_COOKIE],
    );
    if (!authenticatedByCookie) {
      return true;
    }

    const cookieToken = cookies[CSRF_TOKEN_COOKIE];
    const headerValue = request.headers[CSRF_TOKEN_HEADER];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!(cookieToken && headerToken && safeEquals(cookieToken, headerToken))) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
