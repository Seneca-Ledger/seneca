import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isPublicPath } from './app/lib/public-paths';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Server-side gate for app routes.
 *
 * This used to return `NextResponse.next()` down both branches — the public
 * check was there but decided nothing — so gating lived entirely in
 * AuthContext: the page shell rendered first and redirected only once
 * `/auth/me` came back, which meant disabling JavaScript showed the whole
 * shell. No data ever leaked (every API route sits behind the backend's global
 * JwtAuthGuard), but the UI told an untrue story. Reading the cookie here is
 * only possible now that the token is a cookie rather than localStorage.
 *
 * Presence is all this checks. Whether the session is valid, active and
 * unrevoked stays the backend's call — an expired or revoked cookie passes
 * here and is rejected on the first API request.
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Either cookie will do. The access cookie lapses after 30 minutes and the
  // refresh cookie after 30 days; requiring the access cookie sent anyone who
  // had been away for half an hour back to /login before the client could
  // refresh the session.
  if (request.cookies.has(ACCESS_TOKEN_COOKIE) || request.cookies.has(REFRESH_TOKEN_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  // Round-trip the visitor back to where they were aiming once signed in. The
  // login page runs this through safeInternalPath before using it.
  if (pathname !== '/') {
    loginUrl.searchParams.set('next', `${pathname}${search}`);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /*
   * Everything except:
   *  - /api and /uploads, which are rewritten to the backend and carry their
   *    own authentication (an API call must answer 401, not redirect to HTML)
   *  - Next's build output and static assets
   *  - the favicon and other public files with a file extension
   */
  matcher: ['/((?!api|uploads|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
