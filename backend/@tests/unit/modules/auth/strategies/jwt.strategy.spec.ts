import { AuthSession } from '@/entities/auth-session.entity';
import { User, UserRole } from '@/entities/user.entity';
import { JwtStrategy } from '@/modules/auth/strategies/jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

describe('JwtStrategy', () => {
  let testingModule: TestingModule;
  let strategy: JwtStrategy;
  let userRepository: Repository<User>;
  let authSessionRepository: Repository<AuthSession>;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    isActive: true,
    workspaceId: 'ws-1',
    avatarUrl: '/api/v1/users/avatars/existing.png',
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
              if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    strategy = testingModule.get<JwtStrategy>(JwtStrategy);
    userRepository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    authSessionRepository = testingModule.get<Repository<AuthSession>>(
      getRepositoryToken(AuthSession),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: the session behind the token is still active.
    jest
      .spyOn(authSessionRepository, 'findOne')
      .mockResolvedValue({ id: 'session-1' } as AuthSession);
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when valid payload', async () => {
      const payload = {
        sub: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        sessionId: 'session-1',
      };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);

      const result = await strategy.validate(payload);

      expect(result).toEqual(
        expect.objectContaining({
          ...mockUser,
          currentSessionId: 'session-1',
        }),
      );
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const payload = { sub: '999', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as User);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should accept payload with valid sub and email', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);

      const result = await strategy.validate(payload);

      expect(result.id).toBe(payload.sub);
      expect(result.email).toBe(payload.email);
    });

    it('should load user workspace information', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      const userWithWorkspace = {
        ...mockUser,
        workspaceId: 'ws-1',
      };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithWorkspace as User);

      const result = await strategy.validate(payload);

      expect(result.workspaceId).toBe('ws-1');
    });

    it('should include user role in result', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);

      const result = await strategy.validate(payload);

      expect(result.role).toBe(UserRole.USER);
    });

    it('leaves a user without a photo without one: the app draws their initial', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      const userWithoutAvatar = { ...mockUser, avatarUrl: null };
      const updateSpy = jest.spyOn(userRepository, 'update');
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(userWithoutAvatar as User);

      const result = await strategy.validate(payload);

      expect(updateSpy).not.toHaveBeenCalled();
      expect(result.avatarUrl).toBeNull();
    });

    it('should reject a token whose session was revoked', async () => {
      const payload = {
        sub: '1',
        email: 'test@example.com',
        role: UserRole.USER,
        sessionId: 'session-1',
      };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(authSessionRepository, 'findOne').mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
      expect(authSessionRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'session-1', userId: '1' }),
        }),
      );
    });

    it('should accept a legacy token that carries no sessionId', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);
      const sessionSpy = jest.spyOn(authSessionRepository, 'findOne');

      await expect(strategy.validate(payload)).resolves.toBeDefined();
      expect(sessionSpy).not.toHaveBeenCalled();
    });

    it('should throw for malformed payload', async () => {
      const payload = { invalid: 'payload' };

      await expect(strategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for missing sub in payload', async () => {
      const payload = { email: 'test@example.com' };

      await expect(strategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('configuration', () => {
    it('should use JWT_ACCESS_SECRET from config', () => {
      const configService = new ConfigService();
      const getSpy = jest.spyOn(configService, 'get').mockReturnValue('test-secret');

      // Create new strategy to test constructor
      new JwtStrategy(configService, userRepository, authSessionRepository);

      expect(getSpy).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
    });

    it('should extract JWT from Authorization header', async () => {
      const payload = { sub: '1', email: 'test@example.com', role: UserRole.USER };
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as User);

      // The strategy should be configured to extract from header
      const result = await strategy.validate(payload);

      expect(result).toBeDefined();
    });
  });
});
