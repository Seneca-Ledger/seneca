export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'X-CSRF-Token';

/**
 * The auth cookies are httpOnly and unreadable here by design; this one is not,
 * because the double-submit check needs the value echoed back in a header. A
 * cross-origin page can make the browser send our cookies but cannot read them,
 * so it cannot produce this header.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.split('; ').find(part => part.startsWith(`${CSRF_COOKIE}=`));
  if (!match) return null;

  return decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) || null;
}

export function getCsrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { [CSRF_HEADER]: token } : {};
}

/**
 * Best-effort "is there a session" check for pre-flight UI decisions. The auth
 * cookies themselves are httpOnly and invisible here, but this one is set and
 * cleared alongside them, so its presence is the closest readable signal.
 * The server remains the authority — requests can still come back 401.
 */
export function hasSessionCookie(): boolean {
  return getCsrfToken() !== null;
}

/**
 * Drops the readable session marker.
 *
 * The access and refresh cookies are httpOnly and only the server can clear
 * them, but this one is not — and leaving it behind after a failed session
 * teardown is a redirect loop: AuthProvider reads it as "there is a session",
 * asks for /auth/me, gets 401, bounces to /login, and finds the cookie still
 * sitting there on the next load.
 */
export function clearCsrfCookie(): void {
  if (typeof document === 'undefined') return;

  document.cookie = `${CSRF_COOKIE}=; path=/; max-age=0`;
}
