import {
  type Integration,
  type User,
  type Workspace,
  type WorkspaceInvitation,
  WorkspaceInvitationStatus,
  type WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { WorkspacesService } from '@/modules/workspaces/workspaces.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Repository } from 'typeorm';

function createRepoMock<T>() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (data: Partial<T>) => data as T),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
  } as unknown as Repository<T> & Record<string, any>;
}

describe('WorkspacesService', () => {
  const workspaceRepository = createRepoMock<Workspace>();
  const workspaceMemberRepository = createRepoMock<WorkspaceMember>();
  const invitationRepository = createRepoMock<WorkspaceInvitation>();
  const userRepository = createRepoMock<User>();
  const integrationRepository = createRepoMock<Integration>();
  const auditService = { createEvent: jest.fn() };
  const balanceService = { seedDefaultAccounts: jest.fn(async () => undefined) };
  const categoriesService = { createSystemCategories: jest.fn(async () => undefined) };
  const taxRatesService = { createDefaultTaxRates: jest.fn(async () => undefined) };

  let service: WorkspacesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorkspacesService(
      workspaceRepository as any,
      workspaceMemberRepository as any,
      invitationRepository as any,
      userRepository as any,
      integrationRepository as any,
      auditService as any,
      balanceService as any,
      categoriesService as any,
      taxRatesService as any,
    );
    (service as any).sendInvitationEmail = jest.fn(async () => undefined);
  });

  describe('ensureUserWorkspace', () => {
    it('returns existing workspace when user.workspaceId is valid', async () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        workspaceId: 'w1',
      } as User;
      workspaceRepository.findOne = jest.fn(async () => ({ id: 'w1', name: 'W' }) as Workspace);

      const result = await service.ensureUserWorkspace(user);

      expect(result.id).toBe('w1');
      expect(workspaceRepository.create).not.toHaveBeenCalled();
      expect(workspaceMemberRepository.save).not.toHaveBeenCalled();
      expect(userRepository.update).not.toHaveBeenCalled();
      expect(categoriesService.createSystemCategories).not.toHaveBeenCalled();
    });

    it('creates workspace + membership when user has no workspace', async () => {
      const user = {
        id: 'u1',
        email: 'a@b.com',
        name: 'A',
        workspaceId: null,
      } as any as User;
      workspaceRepository.findOne = jest.fn(async () => null);
      workspaceRepository.create = jest.fn(data => ({ ...data }) as any);
      workspaceRepository.save = jest.fn(async (ws: any) => ({
        ...ws,
        id: 'w-new',
        createdAt: new Date(),
      }));

      const result = await service.ensureUserWorkspace(user);

      expect(result.id).toBe('w-new');
      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'w-new',
          userId: 'u1',
          role: WorkspaceRole.OWNER,
        }),
      );
      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        workspaceId: 'w-new',
      });
      expect(categoriesService.createSystemCategories).toHaveBeenCalledWith('w-new', 'u1');
    });
  });

  describe('inviteMember', () => {
    it('throws ConflictException when inviting an existing member', async () => {
      const currentUser = {
        id: 'u-owner',
        email: 'owner@example.com',
        name: 'Owner',
        workspaceId: 'w1',
      } as User;

      workspaceRepository.findOne = jest.fn(async () => ({
        id: 'w1',
        name: 'W',
        ownerId: 'u-owner',
      }));

      userRepository.findOne = jest.fn(async ({ where }: any) =>
        where?.email === 'member@example.com' ? ({ id: 'u2', workspaceId: null } as any) : null,
      );

      workspaceMemberRepository.findOne = jest.fn(async ({ where }: any) => {
        if (where?.workspaceId === 'w1' && where?.userId === 'u-owner') {
          return {
            id: 'm1',
            role: WorkspaceRole.OWNER,
            permissions: null,
          } as any;
        }
        if (where?.workspaceId === 'w1' && where?.userId === 'u2') {
          return {
            id: 'm2',
            role: WorkspaceRole.MEMBER,
            permissions: null,
          } as any;
        }
        return null;
      });

      await expect(
        service.inviteMember(
          'w1',
          currentUser,
          { email: 'member@example.com', role: WorkspaceRole.MEMBER } as any,
          'https://app.example.com',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('refreshes an existing pending invitation and sends email', async () => {
      const currentUser = {
        id: 'u-owner',
        email: 'owner@example.com',
        name: 'Owner',
        workspaceId: 'w1',
      } as User;

      const existingInvitation = {
        id: 'inv-1',
        workspaceId: 'w1',
        email: 'invited@example.com',
        role: WorkspaceRole.MEMBER,
        permissions: null,
        status: WorkspaceInvitationStatus.PENDING,
        token: 'old-token',
        expiresAt: new Date(Date.now() + 1000),
        invitedById: 'someone',
      } as any as WorkspaceInvitation;

      workspaceRepository.findOne = jest.fn(async () => ({
        id: 'w1',
        name: 'W',
        ownerId: 'u-owner',
      }));
      userRepository.findOne = jest.fn(async () => null);
      workspaceMemberRepository.findOne = jest.fn(async ({ where }: any) =>
        where?.workspaceId === 'w1' && where?.userId === 'u-owner'
          ? ({ id: 'm1', role: WorkspaceRole.OWNER, permissions: null } as any)
          : null,
      );
      invitationRepository.findOne = jest.fn(async () => existingInvitation);
      invitationRepository.save = jest.fn(async (inv: any) => inv);

      const result = await service.inviteMember(
        'w1',
        currentUser,
        { email: 'Invited@Example.com', role: WorkspaceRole.MEMBER } as any,
        'https://app.example.com',
      );

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'inv-1',
          email: 'invited@example.com',
          status: WorkspaceInvitationStatus.PENDING,
        }),
      );
      expect((service as any).sendInvitationEmail).toHaveBeenCalled();
      expect(result.invitationLink).toMatch(/\/invite\//);
    });
  });

  describe('updateMemberRole', () => {
    it('transfers ownership when owner assigns owner role to another member', async () => {
      const workspace = { id: 'w1', ownerId: 'u-owner' } as Workspace;
      const ownerMembership = {
        id: 'm-owner',
        workspaceId: 'w1',
        userId: 'u-owner',
        role: WorkspaceRole.OWNER,
        permissions: null,
      } as WorkspaceMember;
      const targetMembership = {
        id: 'm-target',
        workspaceId: 'w1',
        userId: 'u-target',
        role: WorkspaceRole.VIEWER,
        permissions: null,
      } as WorkspaceMember;

      workspaceRepository.findOne = jest.fn(async () => workspace);
      workspaceMemberRepository.findOne = jest.fn(async ({ where }: any) => {
        if (where?.workspaceId !== 'w1') return null;
        if (where?.userId === 'u-owner') return ownerMembership;
        if (where?.userId === 'u-target') return targetMembership;
        return null;
      });
      workspaceRepository.save = jest.fn(async (data: any) => data);
      workspaceMemberRepository.save = jest.fn(async (data: any) => data);

      const result = await service.updateMemberRole(
        'w1',
        'u-owner',
        'u-target',
        WorkspaceRole.OWNER,
      );

      expect(workspaceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: 'u-target' }),
      );
      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-owner', role: WorkspaceRole.ADMIN }),
      );
      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-target', role: WorkspaceRole.OWNER }),
      );
      expect(result).toEqual(expect.objectContaining({ role: WorkspaceRole.OWNER }));
    });
  });

  describe('cancelInvitation', () => {
    it('marks pending invitation as cancelled', async () => {
      workspaceMemberRepository.findOne = jest.fn(async ({ where }: any) =>
        where?.workspaceId === 'w1' && where?.userId === 'u-admin'
          ? ({ id: 'm-admin', role: WorkspaceRole.ADMIN } as WorkspaceMember)
          : null,
      );

      invitationRepository.findOne = jest.fn(async () => ({
        id: 'inv-1',
        workspaceId: 'w1',
        status: WorkspaceInvitationStatus.PENDING,
      }));
      invitationRepository.save = jest.fn(async (inv: any) => inv);

      const result = await service.cancelInvitation('w1', 'u-admin', 'inv-1');

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'inv-1', status: WorkspaceInvitationStatus.CANCELLED }),
      );
      expect(result).toEqual({ message: 'Invitation revoked' });
    });
  });

  describe('getInvitationInfo', () => {
    it('marks pending invitations as expired when TTL has passed', async () => {
      const workspace = { id: 'w1', name: 'W', ownerId: 'u1' } as Workspace;
      const invitation = {
        id: 'inv-1',
        workspaceId: 'w1',
        workspace,
        email: 'invited@example.com',
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.PENDING,
        token: 't1',
        expiresAt: new Date(Date.now() - 60_000),
      } as any as WorkspaceInvitation;

      invitationRepository.findOne = jest.fn(async () => invitation);
      invitationRepository.save = jest.fn(async (inv: any) => inv);

      const info = await service.getInvitationInfo('t1');

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WorkspaceInvitationStatus.EXPIRED }),
      );
      expect(info.workspace.id).toBe('w1');
      expect(info.status).toBe(WorkspaceInvitationStatus.EXPIRED);
    });

    it('throws BadRequestException for empty token', async () => {
      await expect(service.getInvitationInfo(' ')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invitation does not exist', async () => {
      invitationRepository.findOne = jest.fn(async () => null);
      await expect(service.getInvitationInfo('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptInvitation', () => {
    it('throws ForbiddenException when logged in as different email', async () => {
      const currentUser = { id: 'u2', email: 'wrong@example.com' } as User;
      invitationRepository.findOne = jest.fn(async () => ({
        id: 'inv-1',
        workspaceId: 'w1',
        email: 'right@example.com',
        role: WorkspaceRole.MEMBER,
        permissions: null,
        status: WorkspaceInvitationStatus.PENDING,
        token: 't1',
        expiresAt: new Date(Date.now() + 60_000),
      }));

      await expect(service.acceptInvitation(currentUser, 't1')).rejects.toThrow(ForbiddenException);
    });

    it('accepts pending invitation and creates membership if missing', async () => {
      const currentUser = { id: 'u2', email: 'invited@example.com' } as User;
      const invitation = {
        id: 'inv-1',
        workspaceId: 'w1',
        email: 'invited@example.com',
        role: WorkspaceRole.MEMBER,
        permissions: { canEditStatements: true },
        invitedById: 'u-owner',
        status: WorkspaceInvitationStatus.PENDING,
        token: 't1',
        expiresAt: new Date(Date.now() + 60_000),
      } as any;

      invitationRepository.findOne = jest.fn(async () => invitation);
      workspaceRepository.findOne = jest.fn(
        async () => ({ id: 'w1', name: 'W', ownerId: 'u-owner' }) as any,
      );
      workspaceMemberRepository.findOne = jest.fn(async () => null);
      workspaceMemberRepository.save = jest.fn(async (m: any) => m);
      invitationRepository.save = jest.fn(async (inv: any) => inv);

      const result = await service.acceptInvitation(currentUser, 't1');

      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'w1',
          userId: 'u2',
          role: WorkspaceRole.MEMBER,
        }),
      );
      expect(userRepository.update).toHaveBeenCalledWith('u2', {
        workspaceId: 'w1',
      });
      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WorkspaceInvitationStatus.ACCEPTED }),
      );
      expect(result.workspaceId).toBe('w1');
    });

    it('does not repoint the home workspace of a user who already has one', async () => {
      // The tenant-isolation bug: accepting an invitation used to overwrite the
      // invitee's home workspace, carrying everything scoped through it into
      // the inviting workspace. Membership alone must grant the access.
      const currentUser = {
        id: 'u2',
        email: 'invited@example.com',
        workspaceId: 'home-workspace',
      } as User;
      const invitation = {
        id: 'inv-1',
        workspaceId: 'w1',
        email: 'invited@example.com',
        role: WorkspaceRole.MEMBER,
        permissions: null,
        invitedById: 'u-owner',
        status: WorkspaceInvitationStatus.PENDING,
        token: 't1',
        expiresAt: new Date(Date.now() + 60_000),
      } as any;

      invitationRepository.findOne = jest.fn(async () => invitation);
      workspaceRepository.findOne = jest.fn(
        async () => ({ id: 'w1', name: 'W', ownerId: 'u-owner' }) as any,
      );
      workspaceMemberRepository.findOne = jest.fn(async () => null);
      workspaceMemberRepository.save = jest.fn(async (m: any) => m);
      invitationRepository.save = jest.fn(async (inv: any) => inv);

      await service.acceptInvitation(currentUser, 't1');

      // Membership is still created — the user does gain access to w1.
      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: 'w1', userId: 'u2' }),
      );
      // ...but their home workspace is left alone.
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });
});
