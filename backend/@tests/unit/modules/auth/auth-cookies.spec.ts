import {
  ACCESS_TOKEN_COOKIE,
  clearAuthCookies,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  setCsrfCookie,
} from '@/modules/auth/auth-cookies';
import type { Response } from 'express';

type Recorded = { name: string; value: string; options: Record<string, unknown> };

const makeResponse = () => {
  const set: Recorded[] = [];
  const cleared: Recorded[] = [];
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      set.push({ name, value, options });
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      cleared.push({ name, value: '', options });
    },
  } as unknown as Response;
  return { res, set, cleared };
};

const find = (entries: Recorded[], name: string) => entries.find(entry => entry.name === name);

describe('auth cookies', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('marks both token cookies httpOnly and the CSRF cookie readable', () => {
    const { res, set } = makeResponse();

    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' });
    setCsrfCookie(res, 'csrf');

    expect(find(set, ACCESS_TOKEN_COOKIE)?.options.httpOnly).toBe(true);
    expect(find(set, REFRESH_TOKEN_COOKIE)?.options.httpOnly).toBe(true);
    // Readable on purpose: the double-submit check needs the page to echo it.
    expect(find(set, CSRF_TOKEN_COOKIE)?.options.httpOnly).toBe(false);
  });

  it('derives Max-Age from the JWT expiry strings', () => {
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';
    const { res, set } = makeResponse();

    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' });

    expect(find(set, ACCESS_TOKEN_COOKIE)?.options.maxAge).toBe(15 * 60 * 1000);
    expect(find(set, REFRESH_TOKEN_COOKIE)?.options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('falls back to the code defaults when the expiry is unset or unparseable', () => {
    process.env.JWT_EXPIRES_IN = 'not-a-duration';
    process.env.JWT_REFRESH_EXPIRES_IN = undefined;
    const { res, set } = makeResponse();

    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' });

    expect(find(set, ACCESS_TOKEN_COOKIE)?.options.maxAge).toBe(30 * 60 * 1000);
    expect(find(set, REFRESH_TOKEN_COOKIE)?.options.maxAge).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('is not secure in development but is in production', () => {
    process.env.NODE_ENV = 'development';
    const dev = makeResponse();
    setAuthCookies(dev.res, { accessToken: 'a', refreshToken: 'r' });
    expect(find(dev.set, ACCESS_TOKEN_COOKIE)?.options.secure).toBe(false);

    process.env.NODE_ENV = 'production';
    const prod = makeResponse();
    setAuthCookies(prod.res, { accessToken: 'a', refreshToken: 'r' });
    expect(find(prod.set, ACCESS_TOKEN_COOKIE)?.options.secure).toBe(true);
  });

  it('forces Secure when SameSite=None, which browsers require', () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_COOKIE_SAMESITE = 'none';
    const { res, set } = makeResponse();

    setAuthCookies(res, { accessToken: 'a', refreshToken: 'r' });

    expect(find(set, ACCESS_TOKEN_COOKIE)?.options.sameSite).toBe('none');
    expect(find(set, ACCESS_TOKEN_COOKIE)?.options.secure).toBe(true);
  });

  it('clears all three cookies on logout', () => {
    const { res, cleared } = makeResponse();

    clearAuthCookies(res);

    expect(cleared.map(entry => entry.name).sort()).toEqual(
      [ACCESS_TOKEN_COOKIE, CSRF_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE].sort(),
    );
  });
});
