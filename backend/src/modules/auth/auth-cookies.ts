import type { CookieOptions, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/**
 * Readable by JavaScript on purpose: the double-submit CSRF check needs the
 * client to copy this value into a request header, which an attacker's origin
 * cannot do because it cannot read another origin's cookies.
 */
export const CSRF_TOKEN_COOKIE = 'csrf_token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * `lax`, not `strict`, despite .claude/rules/security.md §1: the OAuth callbacks
 * (Google, Dropbox, Drive, Gmail) come back as a top-level cross-site redirect,
 * and `strict` withholds the cookie on exactly that navigation — the user would
 * land back on the app logged out. `lax` still blocks the cross-site
 * POST/PUT/DELETE that CSRF relies on. Override with AUTH_COOKIE_SAMESITE when a
 * deployment puts the frontend on a different registrable domain, which needs
 * `none` (and therefore HTTPS).
 */
const sameSite = (): CookieOptions['sameSite'] => {
  const configured = process.env.AUTH_COOKIE_SAMESITE?.toLowerCase();
  if (configured === 'strict' || configured === 'lax' || configured === 'none') {
    return configured;
  }
  return 'lax';
};

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: isProduction() || sameSite() === 'none',
  sameSite: sameSite(),
  path: '/',
  ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
});

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parses the same duration strings the JWT options use ("30m", "30d") into
 * milliseconds for the cookie's Max-Age, so a cookie never outlives its token.
 * Hand-rolled rather than pulling in `ms`: that package is CommonJS and its
 * interop shape differs between the app's transform and Jest's, which made the
 * call site throw under test while working at runtime.
 */
const parseDurationMs = (value: string, fallbackMs: number): number => {
  const match = /^(\d+)\s*(s|m|h|d|w)?$/.exec(value.trim());
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  return unit ? amount * UNIT_MS[unit] : amount;
};

const maxAgeFrom = (value: string | undefined, fallbackMs: number): number =>
  value ? parseDurationMs(value, fallbackMs) : fallbackMs;

const THIRTY_MINUTES_MS = 30 * UNIT_MS.m;
const THIRTY_DAYS_MS = 30 * UNIT_MS.d;

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(),
    maxAge: maxAgeFrom(process.env.JWT_EXPIRES_IN, THIRTY_MINUTES_MS),
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    maxAge: maxAgeFrom(process.env.JWT_REFRESH_EXPIRES_IN, THIRTY_DAYS_MS),
  });
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_TOKEN_COOKIE, token, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: maxAgeFrom(process.env.JWT_REFRESH_EXPIRES_IN, THIRTY_DAYS_MS),
  });
}

export function clearAuthCookies(res: Response): void {
  // Express only matches a cookie for clearing when path/domain/sameSite line
  // up with how it was set, so reuse the same options rather than the defaults.
  const options = baseOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
  res.clearCookie(CSRF_TOKEN_COOKIE, { ...options, httpOnly: false });
}
