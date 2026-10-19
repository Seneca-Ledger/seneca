import { CsrfGuard } from '@/common/guards/csrf.guard';
import { ForbiddenException } from '@nestjs/common';

type RequestShape = {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string>;
};

const contextFor = (request: RequestShape) =>
  ({
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as any;

const reflectorReturning = (skip: boolean) =>
  ({ getAllAndOverride: () => skip }) as any;

const request = (overrides: Partial<RequestShape> = {}): RequestShape => ({
  method: 'POST',
  headers: {},
  cookies: {},
  ...overrides,
});

describe('CsrfGuard', () => {
  const guard = new CsrfGuard(reflectorReturning(false));

  it('allows safe methods regardless of tokens', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(contextFor(request({ method, cookies: { access_token: 't' } })))).toBe(
        true,
      );
    }
  });

  it('allows unauthenticated requests through — there is no session to forge', () => {
    expect(guard.canActivate(contextFor(request()))).toBe(true);
  });

  it('allows header-authenticated clients without a CSRF token', () => {
    expect(
      guard.canActivate(contextFor(request({ headers: { authorization: 'Bearer x' } }))),
    ).toBe(true);
    expect(guard.canActivate(contextFor(request({ headers: { 'x-api-key': 'k' } })))).toBe(true);
  });

  it('rejects a cookie-authenticated write with no CSRF header', () => {
    expect(() =>
      guard.canActivate(
        contextFor(request({ cookies: { access_token: 't', csrf_token: 'abc' } })),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects a mismatched CSRF header — the cross-site case', () => {
    expect(() =>
      guard.canActivate(
        contextFor(
          request({
            cookies: { access_token: 't', csrf_token: 'abc' },
            headers: { 'x-csrf-token': 'wrong' },
          }),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects when the cookie is missing even though a header was supplied', () => {
    expect(() =>
      guard.canActivate(
        contextFor(
          request({ cookies: { access_token: 't' }, headers: { 'x-csrf-token': 'abc' } }),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts a matching double-submit pair', () => {
    expect(
      guard.canActivate(
        contextFor(
          request({
            cookies: { access_token: 't', csrf_token: 'abc' },
            headers: { 'x-csrf-token': 'abc' },
          }),
        ),
      ),
    ).toBe(true);
  });

  it('also guards requests carrying only the refresh cookie', () => {
    expect(() =>
      guard.canActivate(contextFor(request({ cookies: { refresh_token: 'r', csrf_token: 'a' } }))),
    ).toThrow(ForbiddenException);
  });

  // Regression: the guard gates on the presence of an auth cookie, and httpOnly
  // cookies can only be cleared by the server. A browser left holding a stale
  // one and no CSRF cookie could not POST anything — including /auth/login,
  // the one request that would have repaired the state. @SkipCsrf marks the
  // routes that establish a session rather than act on one.
  it('lets a @SkipCsrf route through even with a stale auth cookie and no CSRF cookie', () => {
    const skipGuard = new CsrfGuard(reflectorReturning(true));

    expect(
      skipGuard.canActivate(contextFor(request({ cookies: { access_token: 'stale' } }))),
    ).toBe(true);
  });

  it('still guards a route that is not marked, in the same state', () => {
    expect(() =>
      guard.canActivate(contextFor(request({ cookies: { access_token: 'stale' } }))),
    ).toThrow(ForbiddenException);
  });
});
