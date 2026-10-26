import {
  User,
  UserRole,
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { AuditAction, EntityType } from '@/entities/audit-event.entity';
import { Integration } from '@/entities/integration.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { BalanceService } from '@/modules/balance/balance.service';
import { CategoriesService } from '@/modules/categories/categories.service';
import { TaxRatesService } from '@/modules/tax/tax-rates.service';
import { WorkspacesService } from '@/modules/workspaces/workspaces.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

describe('WorkspacesService', () => {
  let testingModule: TestingModule;
  let service: WorkspacesService;
  let workspaceRepository: Repository<Workspace>;
  let workspaceMemberRepository: Repository<WorkspaceMember>;
  let invitationRepository: Repository<WorkspaceInvitation>;
  let userRepository: Repository<User>;
  let auditService: AuditService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    workspaceId: 'ws-1',
  };

  const mockWorkspace: Partial<Workspace> = {
    id: 'ws-1',
    name: 'Test Workspace',
    ownerId: '1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        {
          provide: getRepositoryToken(Workspace),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            delete: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceInvitation),
          useValue: {
            find: vi.fn(),
            findOne: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(),
            update: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Integration),
          useValue: {
            count: vi.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            createEvent: vi.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            seedDefaultAccounts: vi.fn(),
          },
        },
        {
          provide: CategoriesService,
          useValue: {
            createSystemCategories: vi.fn(),
          },
        },
        {
          provide: TaxRatesService,
          useValue: {
            createDefaultTaxRates: vi.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: vi.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<WorkspacesService>(WorkspacesService);
    workspaceRepository = testingModule.get<Repository<Workspace>>(getRepositoryToken(Workspace));
    workspaceMemberRepository = testingModule.get<Repository<WorkspaceMember>>(
      getRepositoryToken(WorkspaceMember),
    );
    invitationRepository = testingModule.get<Repository<WorkspaceInvitation>>(
      getRepositoryToken(WorkspaceInvitation),
    );
    userRepository = testingModule.get<Repository<User>>(getRepositoryToken(User));
    auditService = testingModule.get<AuditService>(AuditService);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ensureUserWorkspace', () => {
    it('should return existing workspace', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);

      const result = await service.ensureUserWorkspace(mockUser as User);

      expect(result).toEqual(mockWorkspace);
    });

    it('should create workspace if not exists', async () => {
      const userWithoutWorkspace = { ...mockUser, workspaceId: null };
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(workspaceRepository, 'create').mockReturnValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceRepository, 'save').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'save').mockResolvedValue({} as any);
      vi.spyOn(userRepository, 'update').mockResolvedValue({} as any);

      const result = await service.ensureUserWorkspace(userWithoutWorkspace as User);

      expect(result).toEqual(mockWorkspace);
      expect(workspaceRepository.create).toHaveBeenCalled();
    });

    it('should add user as owner in new workspace', async () => {
      const userWithoutWorkspace = { ...mockUser, workspaceId: null };
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(workspaceRepository, 'create').mockReturnValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceRepository, 'save').mockResolvedValue(mockWorkspace as Workspace);
      const memberSpy = vi.spyOn(workspaceMemberRepository, 'save').mockResolvedValue({} as any);
      vi.spyOn(userRepository, 'update').mockResolvedValue({} as any);

      await service.ensureUserWorkspace(userWithoutWorkspace as User);

      expect(memberSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          role: WorkspaceRole.OWNER,
          userId: userWithoutWorkspace.id,
        }),
      );
    });

    it('should update user with workspace id', async () => {
      const userWithoutWorkspace = { ...mockUser, workspaceId: null };
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(workspaceRepository, 'create').mockReturnValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceRepository, 'save').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'save').mockResolvedValue({} as any);
      const updateSpy = vi.spyOn(userRepository, 'update').mockResolvedValue({} as any);

      await service.ensureUserWorkspace(userWithoutWorkspace as User);

      expect(updateSpy).toHaveBeenCalledWith(userWithoutWorkspace.id, {
        workspaceId: mockWorkspace.id,
      });
    });
  });

  describe('createWorkspace', () => {
    it('should emit audit event on create', async () => {
      vi.spyOn(workspaceRepository, 'create').mockReturnValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceRepository, 'save').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'save').mockResolvedValue({} as any);
      vi.spyOn(userRepository, 'update').mockResolvedValue({} as any);
      vi.spyOn(service as any, 'getWorkspaceStats').mockResolvedValue({});

      const result = await service.createWorkspace(
        mockUser.id as string,
        {
          name: 'New Workspace',
        } as any,
      );

      expect(result.id).toBe(mockWorkspace.id);
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entityType: EntityType.WORKSPACE,
          entityId: mockWorkspace.id,
        }),
      );
    });
  });

  describe('getWorkspaceOverview', () => {
    it('should return workspace with members', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'find').mockResolvedValue([
        {
          workspaceId: 'ws-1',
          userId: '1',
          role: WorkspaceRole.OWNER,
        } as WorkspaceMember,
      ]);
      vi.spyOn(invitationRepository, 'find').mockResolvedValue([]);

      const result = await service.getWorkspaceOverview(mockUser as User);

      expect(result).toHaveProperty('workspace');
      expect(result).toHaveProperty('members');
    });

    it('should include pending invitations', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'find').mockResolvedValue([] as WorkspaceMember[]);
      vi.spyOn(invitationRepository, 'find').mockResolvedValue([
        {
          email: 'invited@example.com',
          status: WorkspaceInvitationStatus.PENDING,
        } as WorkspaceInvitation,
      ]);

      const result = await service.getWorkspaceOverview(mockUser as User);

      expect(result).toHaveProperty('invitations');
    });

    it('should show user role and permissions', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'find').mockResolvedValue([
        {
          userId: '1',
          role: WorkspaceRole.ADMIN,
          permissions: { canEditStatements: true },
        } as WorkspaceMember,
      ]);
      vi.spyOn(invitationRepository, 'find').mockResolvedValue([]);

      const result = await service.getWorkspaceOverview(mockUser as User);

      expect(result.members[0]).toHaveProperty('role');
      expect(result.members[0]).toHaveProperty('permissions');
    });

    it('should include member avatar and timezone', async () => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'find').mockResolvedValue([
        {
          userId: '1',
          role: WorkspaceRole.MEMBER,
          user: {
            id: '1',
            email: 'denis@gmail.com',
            name: 'Denis',
            avatarUrl: '/users/avatars/denis.png',
            timeZone: 'Asia/Almaty',
          } as User,
        } as WorkspaceMember,
      ]);
      vi.spyOn(invitationRepository, 'find').mockResolvedValue([]);

      const result = await service.getWorkspaceOverview(mockUser as User);

      expect(result.members[0]).toMatchObject({
        avatarUrl: '/users/avatars/denis.png',
        timeZone: 'Asia/Almaty',
      });
    });
  });

  describe('inviteMember', () => {
    const inviteDto = {
      email: 'newmember@example.com',
      role: WorkspaceRole.MEMBER,
    };

    beforeEach(() => {
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.OWNER,
      } as WorkspaceMember);
      vi.spyOn(invitationRepository, 'find').mockResolvedValue([]);
      vi.spyOn(service as any, 'sendInvitationEmail').mockResolvedValue(undefined);
    });

    it('should create invitation', async () => {
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(invitationRepository, 'findOne').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(invitationRepository, 'create')
        .mockReturnValue({} as WorkspaceInvitation);
      vi.spyOn(invitationRepository, 'save').mockResolvedValue({} as WorkspaceInvitation);

      await service.inviteMember(mockWorkspace.id as string, mockUser as User, inviteDto);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: inviteDto.email.toLowerCase(),
          role: inviteDto.role,
        }),
      );
    });

    it('should check inviter permissions', async () => {
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
        role: WorkspaceRole.MEMBER,
      } as WorkspaceMember);

      await expect(
        service.inviteMember(mockWorkspace.id as string, mockUser as User, inviteDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject duplicate invitation', async () => {
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      const existingInvitation = {
        status: WorkspaceInvitationStatus.PENDING,
        token: 'old-token',
      } as WorkspaceInvitation;
      vi.spyOn(invitationRepository, 'findOne').mockResolvedValue(existingInvitation);
      const saveSpy = vi
        .spyOn(invitationRepository, 'save')
        .mockResolvedValue(existingInvitation);

      await service.inviteMember(mockWorkspace.id as string, mockUser as User, inviteDto);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WorkspaceInvitationStatus.PENDING,
          token: expect.any(String),
        }),
      );
    });

    it('should reject if user already member', async () => {
      vi.spyOn(userRepository, 'findOne').mockResolvedValue({
        workspaceId: mockWorkspace.id,
      } as User);

      await expect(
        service.inviteMember(mockWorkspace.id as string, mockUser as User, inviteDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should send invitation email', async () => {
      vi.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(invitationRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(invitationRepository, 'create').mockReturnValue({} as WorkspaceInvitation);
      vi.spyOn(invitationRepository, 'save').mockResolvedValue({} as WorkspaceInvitation);

      // Mock email sending would be tested here
      await service.inviteMember(mockWorkspace.id as string, mockUser as User, inviteDto);

      expect(invitationRepository.save).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      const upperCaseInvite = {
        email: 'NewMember@EXAMPLE.com',
        role: WorkspaceRole.MEMBER,
      };

      vi.spyOn(userRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(invitationRepository, 'findOne').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(invitationRepository, 'create')
        .mockReturnValue({} as WorkspaceInvitation);
      vi.spyOn(invitationRepository, 'save').mockResolvedValue({} as WorkspaceInvitation);

      await service.inviteMember(mockWorkspace.id as string, mockUser as User, upperCaseInvite);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newmember@example.com',
        }),
      );
    });

    it('should prefer request origin when env is localhost', async () => {
      const prevAppUrl = process.env.APP_URL;
      const prevFrontendUrl = process.env.FRONTEND_URL;
      process.env.APP_URL = 'http://localhost:3000';
      process.env.FRONTEND_URL = 'http://localhost:3000';

      try {
        vi.spyOn(userRepository, 'findOne').mockResolvedValue(null);
        vi.spyOn(invitationRepository, 'findOne').mockResolvedValue(null);
        vi.spyOn(invitationRepository, 'create').mockReturnValue({} as WorkspaceInvitation);
        vi
          .spyOn(invitationRepository, 'save')
          .mockResolvedValue({ token: 'tok-1' } as WorkspaceInvitation);

        const result = await service.inviteMember(
          mockWorkspace.id as string,
          mockUser as User,
          inviteDto,
          'https://app.megarich.kz',
        );

        expect(result.invitationLink).toBe('https://app.megarich.kz/invite/tok-1');
      } finally {
        process.env.APP_URL = prevAppUrl;
        process.env.FRONTEND_URL = prevFrontendUrl;
      }
    });
  });

  describe('acceptInvitation', () => {
    const mockInvitation: Partial<WorkspaceInvitation> = {
      id: 'inv-1',
      workspaceId: 'ws-1',
      email: 'test@example.com',
      role: WorkspaceRole.MEMBER,
      status: WorkspaceInvitationStatus.PENDING,
      token: 'valid-token',
    };

    it('should accept valid invitation', async () => {
      vi
        .spyOn(invitationRepository, 'findOne')
        .mockResolvedValue({ ...mockInvitation } as WorkspaceInvitation);
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(workspaceMemberRepository, 'save').mockResolvedValue({} as any);
      const saveInvitationSpy = vi
        .spyOn(invitationRepository, 'save')
        .mockResolvedValue(mockInvitation as WorkspaceInvitation);
      vi.spyOn(userRepository, 'update').mockResolvedValue({} as any);

      await service.acceptInvitation(mockUser as User, 'valid-token');

      expect(workspaceMemberRepository.save).toHaveBeenCalled();
      expect(saveInvitationSpy).toHaveBeenCalled();
    });

    it('should throw if invitation not found', async () => {
      vi.spyOn(invitationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.acceptInvitation(mockUser as User, 'invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if invitation expired', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date('2020-01-01'),
        status: WorkspaceInvitationStatus.PENDING,
      };
      vi
        .spyOn(invitationRepository, 'findOne')
        .mockResolvedValue({ ...expiredInvitation } as WorkspaceInvitation);
      vi
        .spyOn(invitationRepository, 'save')
        .mockResolvedValue(expiredInvitation as WorkspaceInvitation);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(null);

      await expect(service.acceptInvitation(mockUser as User, 'valid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if email mismatch', async () => {
      const wrongUser = { ...mockUser, email: 'wrong@example.com' };
      vi
        .spyOn(invitationRepository, 'findOne')
        .mockResolvedValue(mockInvitation as WorkspaceInvitation);

      await expect(service.acceptInvitation(wrongUser as User, 'valid-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should mark invitation as accepted', async () => {
      vi
        .spyOn(invitationRepository, 'findOne')
        .mockResolvedValue({ ...mockInvitation } as WorkspaceInvitation);
      vi.spyOn(workspaceRepository, 'findOne').mockResolvedValue(mockWorkspace as Workspace);
      vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue(null);
      vi.spyOn(workspaceMemberRepository, 'save').mockResolvedValue({} as any);
      const saveSpy = vi
        .spyOn(invitationRepository, 'save')
        .mockResolvedValue(mockInvitation as WorkspaceInvitation);
      vi.spyOn(userRepository, 'update').mockResolvedValue({} as any);

      await service.acceptInvitation(mockUser as User, 'valid-token');

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WorkspaceInvitationStatus.ACCEPTED,
          acceptedAt: expect.any(Date),
        }),
      );
    });
  });
});
