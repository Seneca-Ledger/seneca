import { User, UserRole } from '@/entities/user.entity';
import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { AuthSession } from '@/entities/auth-session.entity';
import { WorkspaceMember } from '@/entities/workspace-member.entity';
import { Workspace } from '@/entities/workspace.entity';
import { EmailChangeService } from '@/modules/users/services/email-change.service';
import { PAGE_HINTS_MAX_KEYS, UsersService } from '@/modules/users/users.service';
import { WorkspacesService } from '@/modules/workspaces/workspaces.service';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { getMetadataArgsStorage, IsNull, type Repository } from 'typeorm';
import { passwordHashRounds } from '@/common/utils/password-hash.util';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('UsersService', () => {
  let testingModule: TestingModule;
  let service: UsersService;
  let repository: Repository<User>;
  let workspaceRepository: Repository<Workspace>;
  let workspacesService: WorkspacesService;
  const auditService = { createEvent: jest.fn() };

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    name: 'Test User',
    role: UserRole.USER,
    workspaceId: '1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const { passwordHash: _, ...mockUserWithoutPasswordHash } = mockUser;

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            softDelete: jest.fn(),
            query: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: { count: jest.fn(async () => 0) },
        },
        {
          provide: getRepositoryToken(AuthSession),
          useValue: { update: jest.fn(async () => ({ affected: 0 })) },
        },
        {
          provide: WorkspacesService,
          useValue: {
            ensureUserWorkspace: jest.fn(),
          },
        },
        {
          provide: EmailChangeService,
          useValue: {
            requestEmailChange: jest.fn(),
            confirmEmailChange: jest.fn(),
          },
        },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = testingModule.get<UsersService>(UsersService);
    repository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    workspaceRepository = testingModule.get<Repository<Workspace>>(getRepositoryToken(Workspace));
    workspacesService = testingModule.get<WorkspacesService>(WorkspacesService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUserWithoutPasswordHash as User);

      const result = await service.findOne('1');

      expect(result).toEqual(mockUserWithoutPasswordHash);
      expect(repository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          select: expect.any(Object),
        }),
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });

    it('should not expose password field', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUserWithoutPasswordHash as User);

      const result = await service.findOne('1');

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const updateDto = {
        name: 'Updated Name',
        company: 'Updated Company',
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser as User);
      jest.spyOn(repository, 'save').mockResolvedValue({
        ...mockUser,
        ...updateDto,
      } as User);

      const result = await service.update('1', updateDto, mockUser as User);

      expect(result.name).toBe(updateDto.name);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.update('999', { name: 'Test' }, adminUser as User)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      const adminUser = { ...mockUser, id: '2', role: UserRole.ADMIN };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser as User);
      const softDeleteSpy = jest
        .spyOn(repository, 'softDelete')
        .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.remove('1', adminUser as User);

      expect(softDeleteSpy).toHaveBeenCalledWith('1');
    });

    it('should not physically delete from database', async () => {
      const adminUser = { ...mockUser, id: '2', role: UserRole.ADMIN };
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockUser as User);
      const deleteSpy = jest.spyOn(repository, 'delete');
      jest
        .spyOn(repository, 'softDelete')
        .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.remove('1', adminUser as User);

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user does not exist', async () => {
      const adminUser = { ...mockUser, role: UserRole.ADMIN };
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.remove('999', adminUser as User)).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new_hashed' as never);
    });

    it('should verify old password', async () => {
      const changePasswordDto = {
        currentPassword: 'old_password',
        newPassword: 'new_password',
      };

      jest.spyOn<any, any>(service as any, 'findOneWithPassword').mockResolvedValue({
        ...mockUser,
        passwordHash: await bcrypt.hash('old_password', 10),
      } as User);
      const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(repository, 'save').mockResolvedValue(mockUser as User);

      await service.changePassword('1', changePasswordDto);

      expect(compareSpy).toHaveBeenCalledWith('old_password', expect.any(String));
    });

    it('should throw UnauthorizedException if old password wrong', async () => {
      const changePasswordDto = {
        currentPassword: 'wrong_password',
        newPassword: 'new_password',
      };

      jest.spyOn<any, any>(service as any, 'findOneWithPassword').mockResolvedValue({
        ...mockUser,
        passwordHash: await bcrypt.hash('correct_password', 10),
      } as User);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.changePassword('1', changePasswordDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should hash new password', async () => {
      const changePasswordDto = {
        currentPassword: 'old_password',
        newPassword: 'new_password',
      };

      jest.spyOn<any, any>(service as any, 'findOneWithPassword').mockResolvedValue({
        ...mockUser,
        passwordHash: await bcrypt.hash('old_password', 10),
      } as User);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const hashSpy = jest.spyOn(bcrypt, 'hash');
      const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(mockUser as User);

      await service.changePassword('1', changePasswordDto);

      // Cost comes from passwordHashRounds() (12 by default, OWASP's current
      // recommendation), not the hardcoded 10 this used to assert.
      expect(hashSpy).toHaveBeenCalledWith('new_password', passwordHashRounds());
      const savedUser = saveSpy.mock.calls[0][0];
      expect(savedUser.passwordHash).toBe('new_hashed');
    });

    it('should increment token version to revoke all refresh tokens', async () => {
      const changePasswordDto = {
        currentPassword: 'old_password',
        newPassword: 'new_password',
      };

      const userWithTokenVersion = {
        ...mockUser,
        passwordHash: await bcrypt.hash('old_password', 10),
        tokenVersion: 1,
      };
      const initialTokenVersion = userWithTokenVersion.tokenVersion;

      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(userWithTokenVersion as User);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(mockUser as User);

      await service.changePassword('1', changePasswordDto);

      const savedUser = saveSpy.mock.calls[0][0];
      expect(savedUser.tokenVersion).toBe(initialTokenVersion + 1);
    });
  });

  describe('findAll', () => {
    const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';

    it('should return all users in workspace', async () => {
      const users = [mockUser, { ...mockUser, id: '2' }];
      jest.spyOn(repository, 'find').mockResolvedValue(users as User[]);

      const result = await service.findAll(WORKSPACE_ID, 20);

      expect(result).toHaveLength(2);
      expect(repository.find).toHaveBeenCalled();
    });

    it('should not include deleted users', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([mockUser] as User[]);

      await service.findAll(WORKSPACE_ID, 20);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: IsNull(),
          }),
        }),
      );
    });

    it('lists the members of the workspace, whichever workspace they registered with', async () => {
      const findSpy = jest.spyOn(repository, 'find').mockResolvedValue([mockUser] as User[]);

      await service.findAll(WORKSPACE_ID, 20);

      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceMemberships: { workspaceId: WORKSPACE_ID },
          }),
        }),
      );
    });

    it('should handle empty result', async () => {
      jest.spyOn(repository, 'find').mockResolvedValue([]);

      const result = await service.findAll(WORKSPACE_ID, 20);

      expect(result).toEqual([]);
    });
  });

  describe('updateMyAvatar', () => {
    it('should store new avatar url for user', async () => {
      const userWithPassword = { ...mockUser } as User;
      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(userWithPassword);
      const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue({
        ...userWithPassword,
        avatarUrl: '/uploads/user-avatars/avatar.png',
      } as User);

      const result = await service.updateMyAvatar('1', '/uploads/user-avatars/avatar.png');

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: '/uploads/user-avatars/avatar.png' }),
      );
      expect(result.avatarUrl).toBe('/uploads/user-avatars/avatar.png');
    });
  });

  describe('updateMyPreferences', () => {
    it('stores themePreference on the user profile', async () => {
      const userWithPassword = {
        ...mockUser,
        timeZone: 'Asia/Almaty',
        locale: 'ru',
        themePreference: 'light',
      } as User;

      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(userWithPassword);
      const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue({
        ...userWithPassword,
        themePreference: 'auto',
      } as User);

      const result = await service.updateMyPreferences('1', {
        themePreference: 'auto',
      } as any);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          themePreference: 'auto',
          timeZone: 'Asia/Almaty',
          locale: 'ru',
        }),
      );
      expect(result.themePreference).toBe('auto');
    });

    it('turns the daily quote off and leaves the other preferences alone', async () => {
      const userWithPassword = { ...mockUser, showDailyQuote: true, reduceMotion: true } as User;
      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(userWithPassword);
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockImplementation(async user => user as User);

      await service.updateMyPreferences('1', { showDailyQuote: false } as any);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ showDailyQuote: false, reduceMotion: true }),
      );
    });

    it('stores a trimmed map style and clears it with null', async () => {
      const userWithPassword = { ...mockUser, mapStylePreference: 'positron' } as User;

      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(userWithPassword);
      const saveSpy = jest
        .spyOn(repository, 'save')
        .mockImplementation(async (user: any) => user as User);

      await service.updateMyPreferences('1', { mapStylePreference: ' dark-matter ' } as any);
      expect(saveSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ mapStylePreference: 'dark-matter' }),
      );

      await service.updateMyPreferences('1', { mapStylePreference: null } as any);
      expect(saveSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ mapStylePreference: null }),
      );
    });

  });

  describe('completeOnboarding', () => {
    it('updates user preferences, workspace setup and completion timestamp', async () => {
      const userWithPassword = {
        ...mockUser,
        onboardingCompletedAt: null,
      } as User;
      const workspace = {
        id: 'workspace-1',
        name: 'Old workspace',
        currency: null,
        backgroundImage: null,
      } as Workspace;

      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(userWithPassword);
      jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(workspace);
      const workspaceSaveSpy = jest.spyOn(workspaceRepository, 'save').mockResolvedValue({
        ...workspace,
        name: 'My workspace',
        currency: 'USD',
        backgroundImage: 'hero.jpg',
      } as Workspace);
      const userSaveSpy = jest.spyOn(repository, 'save').mockResolvedValue({
        ...userWithPassword,
        locale: 'en',
        timeZone: 'Asia/Almaty',
        onboardingCompletedAt: new Date(),
      } as User);

      const result = await service.completeOnboarding('1', {
        locale: 'en',
        timeZone: 'Asia/Almaty',
        workspaceName: 'My workspace',
        workspaceCurrency: 'USD',
        workspaceBackgroundImage: 'hero.jpg',
      });

      expect(workspaceSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My workspace',
          currency: 'USD',
          backgroundImage: 'hero.jpg',
        }),
      );
      expect(userSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'en',
          timeZone: 'Asia/Almaty',
          onboardingCompletedAt: expect.any(Date),
        }),
      );
      expect(result.onboardingCompletedAt).toBeTruthy();
    });

    it('ensures workspace when user has none', async () => {
      const alreadyCompleted = {
        ...mockUser,
        workspaceId: null,
        onboardingCompletedAt: new Date('2026-01-01T00:00:00.000Z'),
      } as User;

      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue(alreadyCompleted);
      const ensureWorkspaceSpy = jest
        .spyOn(workspacesService, 'ensureUserWorkspace')
        .mockResolvedValue({ id: 'workspace-ensured' } as Workspace);
      const workspaceFindSpy = jest.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);
      const workspaceSaveSpy = jest.spyOn(workspaceRepository, 'save');
      const userSaveSpy = jest.spyOn(repository, 'save').mockResolvedValue(alreadyCompleted);

      await service.completeOnboarding('1', {});

      expect(ensureWorkspaceSpy).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
      expect(workspaceFindSpy).not.toHaveBeenCalled();
      expect(workspaceSaveSpy).not.toHaveBeenCalled();
      expect(userSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-ensured',
          onboardingCompletedAt: alreadyCompleted.onboardingCompletedAt,
        }),
      );
    });
  });

  describe('markWelcomeTutorialSeen', () => {
    it('stamps the time with one conditional update and returns the stored time', async () => {
      const seenAt = new Date('2026-09-25T12:00:00.000Z');
      const querySpy = jest.spyOn(repository, 'query').mockResolvedValue([]);
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockUserWithoutPasswordHash, welcomeTutorialSeenAt: seenAt } as User);
      const saveSpy = jest.spyOn(repository, 'save');

      await expect(service.markWelcomeTutorialSeen('1')).resolves.toEqual(seenAt);
      // Only a still-NULL stamp is set: the first close wins, even for concurrent ones,
      // and no other column is rewritten.
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringMatching(/SET "welcome_tutorial_seen_at" = NOW\(\).*"welcome_tutorial_seen_at" IS NULL/),
        ['1'],
      );
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user', async () => {
      jest.spyOn(repository, 'query').mockResolvedValue([]);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.markWelcomeTutorialSeen('999')).rejects.toThrow(NotFoundException);
    });

    // Preferences, avatar and onboarding saves load the whole user; they must not be
    // able to write back a NULL they read before the tutorial was closed.
    it('keeps the column out of whole-row saves', () => {
      const column = getMetadataArgsStorage().columns.find(
        args => args.target === User && args.propertyName === 'welcomeTutorialSeenAt',
      );
      expect(column?.options.update).toBe(false);
    });

    // The onboarding page replaces its copy of the user with the response, and
    // the tutorial opens only when the field is explicitly null — so every
    // profile the service returns has to load it.
    it('loads the flag in the profile and in the onboarding response', async () => {
      // The completeOnboarding cases above stub this loader, and clearAllMocks
      // keeps stubs; the real one has to run to expose its select list.
      jest.spyOn<any, any>(service as any, 'findOneWithPassword').mockRestore();
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockUser, onboardingCompletedAt: new Date() } as User);
      jest.spyOn(repository, 'save').mockResolvedValue({} as User);

      await service.findOne('1');
      await service.completeOnboarding('1', {});

      expect(findOneSpy).toHaveBeenCalledTimes(2);
      for (const [options] of findOneSpy.mock.calls) {
        expect((options as { select: Record<string, boolean> }).select).toHaveProperty('welcomeTutorialSeenAt', true);
      }
    });
  });

  describe('page hints', () => {
    it('keeps the higher version with one conditional update and returns the stored map', async () => {
      const querySpy = jest.spyOn(repository, 'query').mockResolvedValue([]);
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockUserWithoutPasswordHash, pageHintsSeen: { budgets: 2 } } as User);
      const saveSpy = jest.spyOn(repository, 'save');

      await expect(service.markPageHintsSeen('1', 'budgets', 2)).resolves.toEqual({ budgets: 2 });
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringMatching(/GREATEST\(COALESCE\(\("page_hints_seen" ->> \$2::text\)::int, 0\), \$3::int\)/),
        ['1', 'budgets', 2, PAGE_HINTS_MAX_KEYS],
      );
      // A new key only while the map is below the cap.
      expect(querySpy.mock.calls[0][0]).toMatch(/jsonb_object_keys\("page_hints_seen"\)\) < \$4/);
      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('empties the map on reset', async () => {
      const querySpy = jest.spyOn(repository, 'query').mockResolvedValue([]);
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockUserWithoutPasswordHash, pageHintsSeen: {} } as User);

      await expect(service.resetPageHints('1')).resolves.toEqual({});
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringMatching(/SET "page_hints_seen" = '\{\}'::jsonb WHERE "id" = \$1/),
        ['1'],
      );
    });

    it('throws NotFoundException for an unknown user', async () => {
      jest.spyOn(repository, 'query').mockResolvedValue([]);
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.markPageHintsSeen('999', 'budgets', 1)).rejects.toThrow(NotFoundException);
    });

    it('keeps the column out of whole-row saves', () => {
      const column = getMetadataArgsStorage().columns.find(
        args => args.target === User && args.propertyName === 'pageHintsSeen',
      );
      expect(column?.options.update).toBe(false);
    });

    // A profile loaded without the column would answer an empty map, which the
    // client reads as "nothing seen" and shows every hint again.
    it('loads the map in the profile and in the onboarding response', async () => {
      jest.spyOn<any, any>(service as any, 'findOneWithPassword').mockRestore();
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockUser, onboardingCompletedAt: new Date() } as User);
      jest.spyOn(repository, 'save').mockResolvedValue({} as User);

      await service.findOne('1');
      await service.completeOnboarding('1', {});

      expect(findOneSpy).toHaveBeenCalledTimes(2);
      for (const [options] of findOneSpy.mock.calls) {
        expect((options as { select: Record<string, boolean> }).select).toHaveProperty('pageHintsSeen', true);
      }
    });
  });

  describe('security audit events', () => {
    const admin = { ...mockUser, id: 'admin-1', role: UserRole.ADMIN } as User;

    beforeEach(() => {
      auditService.createEvent.mockResolvedValue({});
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('new_hashed' as never);
    });

    it('logs a password change as WARN without any password or hash', async () => {
      jest.spyOn<any, any>(service as any, 'findOneWithPassword').mockResolvedValue({
        ...mockUser,
        workspaceId: 'ws-home',
      } as User);
      jest.spyOn(repository, 'save').mockResolvedValue(mockUser as User);

      await service.changePassword('1', { currentPassword: 'old_pw', newPassword: 'new_pw' });

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-home',
          actorId: '1',
          entityType: EntityType.USER,
          entityId: '1',
          action: AuditAction.UPDATE,
          severity: Severity.WARN,
          meta: { password: 'changed' },
        }),
      );
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      for (const leaked of ['old_pw', 'new_pw', 'new_hashed', 'hashed_password']) {
        expect(payload).not.toContain(leaked);
      }
    });

    it('still changes the password when the audit write fails', async () => {
      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue({ ...mockUser } as User);
      const saveSpy = jest.spyOn(repository, 'save').mockResolvedValue(mockUser as User);
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await expect(
        service.changePassword('1', { currentPassword: 'a', newPassword: 'b' }),
      ).resolves.toBeUndefined();
      expect(saveSpy).toHaveBeenCalled();
    });

    it('skips the event when the user has no home workspace', async () => {
      jest
        .spyOn<any, any>(service as any, 'findOneWithPassword')
        .mockResolvedValue({ ...mockUser, workspaceId: null } as User);
      jest.spyOn(repository, 'save').mockResolvedValue(mockUser as User);

      await service.changePassword('1', { currentPassword: 'a', newPassword: 'b' });

      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('logs an admin update against the target with the admin as actor', async () => {
      const target = { ...mockUser, id: 'target-1', workspaceId: 'ws-target', role: UserRole.USER };
      jest.spyOn(repository, 'findOne').mockResolvedValue(target as User);
      jest.spyOn(repository, 'save').mockImplementation(async user => user as User);

      await service.update('target-1', { role: UserRole.ADMIN }, admin);

      const [event] = auditService.createEvent.mock.calls[0];
      expect(event).toMatchObject({
        workspaceId: 'ws-target',
        actorId: 'admin-1',
        entityType: EntityType.USER,
        entityId: 'target-1',
        action: AuditAction.UPDATE,
        severity: Severity.WARN,
        diff: { before: { role: UserRole.USER }, after: { role: UserRole.ADMIN } },
      });
      expect(JSON.stringify(event)).not.toMatch(/passwordHash|hashed_password|tokenVersion/);
    });

    it('logs an admin removal as DELETE', async () => {
      jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue({ ...mockUser, id: 'target-1', workspaceId: 'ws-target' } as User);
      jest
        .spyOn(repository, 'softDelete')
        .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.remove('target-1', admin);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-target',
          actorId: 'admin-1',
          entityId: 'target-1',
          action: AuditAction.DELETE,
          severity: Severity.WARN,
        }),
      );
    });
  });
});
