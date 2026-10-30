import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test, type TestingModule } from '@nestjs/testing';

describe('JwtAuthGuard', () => {
  let testingModule: TestingModule;
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  const apiKeysService = {
    validate: vi.fn(),
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: ModuleRef,
          useValue: {
            get: vi.fn(() => apiKeysService),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: vi.fn(),
          },
        },
      ],
    }).compile();

    guard = testingModule.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = testingModule.get<Reflector>(Reflector);
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
    it('lets a WebSocket message through: its gateway authenticated the socket on connect', async () => {
      const switchToHttp = vi.fn();
      const context = {
        getType: () => 'ws',
        switchToHttp,
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(switchToHttp).not.toHaveBeenCalled();
    });

    it('should allow access for public routes', async () => {
      const context = createMockExecutionContext();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        expect.any(Object),
        expect.any(Object),
      ]);
    });

    it('should call super.canActivate for protected routes', async () => {
      const context = createMockExecutionContext();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('pins API-key authenticated requests to the API key workspace', async () => {
      apiKeysService.validate.mockResolvedValue({
        workspaceId: 'workspace-key',
        user: { id: 'user-1' },
      });
      const context = createMockExecutionContext({
        headers: {
          'x-api-key': 'seneca_test_key',
        },
      });
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).resolves.toBe(true);

      const request = context.switchToHttp().getRequest() as any;
      expect(request.headers['x-workspace-id']).toBe('workspace-key');
      expect(request.apiKeyWorkspaceId).toBe('workspace-key');
    });

    it('rejects API-key requests that try to override the key workspace', async () => {
      apiKeysService.validate.mockResolvedValue({
        workspaceId: 'workspace-key',
        user: { id: 'user-1' },
      });
      const context = createMockExecutionContext({
        headers: {
          'x-api-key': 'seneca_test_key',
          'x-workspace-id': 'workspace-other',
        },
      });
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(
        'API key is not valid for the requested workspace',
      );
    });

    it('refuses the API key of a deactivated user, as it refuses their session', async () => {
      apiKeysService.validate.mockResolvedValue({
        workspaceId: 'workspace-key',
        user: { id: 'user-1', isActive: false },
      });
      const context = createMockExecutionContext({
        headers: {
          'x-api-key': 'seneca_test_key',
        },
      });
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect((context.switchToHttp().getRequest() as any).apiKey).toBeUndefined();
    });

    describe('a scoped API key', () => {
      const keyRequest = () =>
        createMockExecutionContext({ headers: { 'x-api-key': 'seneca_test_key' } });
      const routeMetadata = (metadata: Record<string, unknown>) =>
        vi
          .spyOn(reflector, 'getAllAndOverride')
          .mockImplementation((key: unknown) => metadata[key as string]);

      it('is refused on a route that declares no permission', async () => {
        apiKeysService.validate.mockResolvedValue({
          workspaceId: 'workspace-key',
          user: { id: 'user-1' },
          scopes: ['transaction.view'],
        });
        routeMetadata({});

        await expect(guard.canActivate(keyRequest())).rejects.toThrow(
          'This route does not accept scoped API keys',
        );
      });

      it('passes on to the permission check where the route declares one', async () => {
        apiKeysService.validate.mockResolvedValue({
          workspaceId: 'workspace-key',
          user: { id: 'user-1' },
          scopes: ['transaction.view'],
        });
        routeMetadata({ permissions: ['transaction.view'] });

        await expect(guard.canActivate(keyRequest())).resolves.toBe(true);
      });

      it('passes where the route checks scopes itself', async () => {
        apiKeysService.validate.mockResolvedValue({
          workspaceId: 'workspace-key',
          user: { id: 'user-1' },
          scopes: [],
        });
        routeMetadata({ apiKeyAllowed: true });

        await expect(guard.canActivate(keyRequest())).resolves.toBe(true);
      });

      it('is refused even with an empty scope list', async () => {
        apiKeysService.validate.mockResolvedValue({
          workspaceId: 'workspace-key',
          user: { id: 'user-1' },
          scopes: [],
        });
        routeMetadata({});

        await expect(guard.canActivate(keyRequest())).rejects.toThrow(
          'This route does not accept scoped API keys',
        );
      });
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockRejectedValue(new UnauthorizedException());

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow request with valid JWT', async () => {
      const context = createMockExecutionContext({
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      });
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject request without authorization header', async () => {
      const context = createMockExecutionContext({
        headers: {},
      });
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      vi
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockRejectedValue(new UnauthorizedException());

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('handleRequest', () => {
    it('should return user when valid', () => {
      const user = { id: '1', email: 'test@example.com' };
      const result = guard.handleRequest(null, user, null, {} as any);

      expect(result).toEqual(user);
    });

    it('should throw UnauthorizedException when user is null', () => {
      expect(() => {
        guard.handleRequest(null, null, null, {} as any);
      }).toThrow(UnauthorizedException);
    });

    it('should throw error when error is present', () => {
      const error = new UnauthorizedException('Token expired');
      expect(() => {
        guard.handleRequest(error, null, null, {} as any);
      }).toThrow(UnauthorizedException);
    });

    it('should throw when user is undefined', () => {
      expect(() => {
        guard.handleRequest(null, undefined, null, {} as any);
      }).toThrow(UnauthorizedException);
    });
  });
});

function createMockExecutionContext(request = {}): ExecutionContext {
  const resolvedRequest = {
    headers: {},
    user: null,
    ...request,
  };
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => resolvedRequest,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}
