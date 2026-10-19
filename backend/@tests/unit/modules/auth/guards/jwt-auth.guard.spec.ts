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
    validate: jest.fn(),
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn(() => apiKeysService),
          },
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = testingModule.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = testingModule.get<Reflector>(Reflector);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access for public routes', async () => {
      const context = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
        expect.any(Object),
        expect.any(Object),
      ]);
    });

    it('should call super.canActivate for protected routes', async () => {
      const context = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);

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
          'x-api-key': 'lumio_test_key',
        },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

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
          'x-api-key': 'lumio_test_key',
          'x-workspace-id': 'workspace-other',
        },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

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
          'x-api-key': 'lumio_test_key',
        },
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
      expect((context.switchToHttp().getRequest() as any).apiKey).toBeUndefined();
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const context = createMockExecutionContext();
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest
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
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject request without authorization header', async () => {
      const context = createMockExecutionContext({
        headers: {},
      });
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      jest
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
    switchToHttp: () => ({
      getRequest: () => resolvedRequest,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}
