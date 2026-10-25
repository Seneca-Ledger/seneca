import { AuthController } from '@/modules/auth/auth.controller';

describe('AuthController', () => {
  it('proxies register/login/logout operations', async () => {
    const authService = {
      register: vi.fn(async () => ({ user: { id: 'u1' }, access_token: 'a', refresh_token: 'r' })),
      login: vi.fn(async () => ({ user: { id: 'u1' }, access_token: 'a', refresh_token: 'r' })),
      refreshToken: vi.fn(async () => ({ access_token: 'new', refresh_token: 'r2' })),
      logout: vi.fn(async () => ({ message: 'ok' })),
      logoutAll: vi.fn(async () => ({ message: 'ok-all' })),
      getSessions: vi.fn(async () => [{ id: 's1' }]),
      logoutSession: vi.fn(async () => ({ message: 'ok-session' })),
    };
    const twoFactorService = {
      getStatus: vi.fn(async () => ({
        enabled: false,
        pendingSetup: false,
        recoveryCodesRemaining: 0,
      })),
      setup: vi.fn(async () => ({ secret: 's', otpauthUrl: 'otpauth://', qrDataUrl: 'data:' })),
      enable: vi.fn(async () => ({ recoveryCodes: ['AAAAA-BBBBB'] })),
      disable: vi.fn(async () => undefined),
      regenerateRecoveryCodes: vi.fn(async () => ({ recoveryCodes: ['CCCCC-DDDDD'] })),
    };
    const controller = new AuthController(authService as any, twoFactorService as any);
    const cookies: Record<string, string> = {};
    const res = {
      cookie: vi.fn((name: string, value: string) => {
        cookies[name] = value;
      }),
      clearCookie: vi.fn((name: string) => {
        delete cookies[name];
      }),
    };
    const req = {
      headers: {
        authorization: 'Bearer token',
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '10.0.0.1',
      },
      cookies: {},
      user: { currentSessionId: 's1' },
      ip: '10.0.0.2',
    };

    // Tokens go into httpOnly cookies and must not reach the response body,
    // which is what keeps an XSS from reading them.
    await expect(
      controller.register({ email: 'a@b.com' } as any, req as any, res as any),
    ).resolves.toEqual({ user: { id: 'u1' } });
    expect(cookies.access_token).toBe('a');
    expect(cookies.refresh_token).toBe('r');
    expect(cookies.csrf_token).toEqual(expect.any(String));
    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'a',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'csrf_token',
      expect.any(String),
      expect.objectContaining({ httpOnly: false }),
    );

    await expect(
      controller.login({ email: 'a@b.com', password: 'x' } as any, req as any, res as any),
    ).resolves.toEqual({ user: { id: 'u1' } });

    await expect(controller.refresh(req as any, res as any)).resolves.toEqual({
      message: 'Token refreshed',
    });

    await expect(controller.logout({ id: 'u1' } as any, req as any, res as any)).resolves.toEqual({
      message: 'ok',
    });
    expect(cookies.access_token).toBeUndefined();
    expect(cookies.refresh_token).toBeUndefined();

    await expect(controller.logoutAll({ id: 'u1' } as any, res as any)).resolves.toEqual({
      message: 'ok-all',
    });
    await expect(controller.getSessions({ id: 'u1' } as any, req)).resolves.toEqual([{ id: 's1' }]);
    await expect(controller.logoutSession({ id: 'u1' } as any, 's1')).resolves.toEqual({
      message: 'ok-session',
    });
    // The profile is the user's view, never the row: no credentials ride along.
    const profile = await controller.getProfile({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'hash',
      tokenVersion: 3,
    } as any);
    expect(profile).toMatchObject({ id: 'u1', email: 'a@b.com' });
    expect(profile).not.toHaveProperty('passwordHash');
    expect(profile).not.toHaveProperty('tokenVersion');

    expect(authService.logout).toHaveBeenCalledWith('u1', 's1');
    expect(authService.getSessions).toHaveBeenCalledWith('u1', 's1');
  });
});
