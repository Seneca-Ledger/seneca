/**
 * Routes that must stay reachable without a session: the auth screens
 * themselves and invitation links (which decide what to show based on whether
 * the visitor is signed in).
 *
 * Shared by the server gate (proxy.ts) and the API client's 401 handler: a
 * failed refresh on one of these pages is expected, not a reason to bounce the
 * visitor to /login.
 */
export const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/invite',
] as const;

export const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
