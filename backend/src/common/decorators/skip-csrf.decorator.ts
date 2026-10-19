import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Exempts a route from the double-submit CSRF check.
 *
 * Only for endpoints that do not act on the caller's cookie identity: they
 * authenticate by credentials in the body (login, register) or by a token from
 * an email (password reset, email confirmation). Gating those on a cookie is
 * not just unnecessary, it is a trap — a browser left holding a stale httpOnly
 * auth cookie and no CSRF cookie could not sign in again, and only the server
 * can clear an httpOnly cookie, so nothing the page did could recover it.
 *
 * Do NOT put this on anything that reads the session: /auth/refresh consumes
 * the refresh cookie and keeps the check.
 */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
