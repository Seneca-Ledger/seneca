import { JwtRefreshGuard } from '@/modules/auth/guards/jwt-refresh.guard';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Test, type TestingModule } from '@nestjs/testing';

describe('JwtRefreshGuard', () => {
  let testingModule: TestingModule;
  let guard: JwtRefreshGuard;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [JwtRefreshGuard],
    }).compile();

    guard = testingModule.get<JwtRefreshGuard>(JwtRefreshGuard);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should use jwt-refresh strategy', async () => {
      const context = createMockExecutionContext();
      vi.spyOn(AuthGuard('jwt-refresh').prototype, 'canActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject without refresh token', async () => {
      const context = createMockExecutionContext({
        headers: {},
      });
      vi
        .spyOn(AuthGuard('jwt-refresh').prototype, 'canActivate')
        .mockRejectedValue(new UnauthorizedException());

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should accept valid refresh token', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid.refresh.token',
        },
      });
      vi.spyOn(AuthGuard('jwt-refresh').prototype, 'canActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject expired refresh token', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer expired.refresh.token',
        },
      });
      vi
        .spyOn(AuthGuard('jwt-refresh').prototype, 'canActivate')
        .mockRejectedValue(new UnauthorizedException('Token expired'));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleRequest', () => {
    it('should return user when valid', () => {
      const user = { id: '1', email: 'test@example.com', tokenVersion: 1 };
      const result = guard.handleRequest(null, user, null, {} as any);

      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => {
        guard.handleRequest(null, null, null, {} as any);
      }).toThrow(UnauthorizedException);
    });

    it('should throw when tokenVersion is missing', () => {
      const userWithoutVersion = { id: '1', email: 'test@example.com' };
      expect(() => {
        guard.handleRequest(null, userWithoutVersion, null, {} as any);
      }).toThrow(UnauthorizedException);
    });
  });
});

function createMockExecutionContext(request = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        user: null,
        ...request,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}
