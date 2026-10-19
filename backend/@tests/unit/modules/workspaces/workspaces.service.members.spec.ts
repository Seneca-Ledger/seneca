import {
  type Integration,
  type User,
  type Workspace,
  type WorkspaceInvitation,
  WorkspaceInvitationStatus,
  type WorkspaceMember,
  WorkspaceRole,
} from '@/entities';
import { ActorType, AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { WorkspacesService } from '@/modules/workspaces/workspaces.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

function createRepoMock<T>() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((data: Partial<T>) => data as T),
    save: jest.fn(async (data: Partial<T>) => data as T),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
    remove: jest.fn(async (data: T) => data),
  } as unknown as Repository<T> & Record<string, jest.Mock>;
}

describe('WorkspacesService — member management', () => {
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

  const WS_ID = 'ws-1';
  const OWNER_ID = 'owner-1';
  const ADMIN_ID = 'admin-1';
  const MEMBER_ID = 'member-1';

  const makeWorkspace = (overrides: Partial<Workspace> = {}) =>
    ({ id: WS_ID, name: 'Test', ownerId: OWNER_ID, ...overrides }) as Workspace;

  const makeMember = (userId: string, role: WorkspaceRole, overrides = {}) =>
    ({ id: `m-${userId}`, workspaceId: WS_ID, userId, role, permissions: null, ...overrides }) as WorkspaceMember;

  /** Stubs requireAdminMembership to return given membership */
  function stubAdminCheck(membership: WorkspaceMember) {
    (service as any).requireAdminMembership = jest.fn().mockResolvedValue(membership);
  }

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

  // ─────────────────────────────────────────────────────────────────────────
  // updateMemberRole
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateMemberRole', () => {
    it('throws BadRequestException for empty targetUserId', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));

      await expect(
        service.updateMemberRole(WS_ID, OWNER_ID, '   ', WorkspaceRole.MEMBER),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when workspace not found', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.ADMIN),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target member not found', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateMemberRole(WS_ID, OWNER_ID, 'ghost-id', WorkspaceRole.MEMBER),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user tries to change their own role', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(OWNER_ID, WorkspaceRole.OWNER));

      await expect(
        service.updateMemberRole(WS_ID, OWNER_ID, OWNER_ID, WorkspaceRole.MEMBER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when demoting OWNER without ownership transfer', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(OWNER_ID, WorkspaceRole.OWNER));

      await expect(
        service.updateMemberRole(WS_ID, ADMIN_ID, OWNER_ID, WorkspaceRole.MEMBER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when ADMIN tries to manage another ADMIN', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember('other-admin', WorkspaceRole.ADMIN));

      await expect(
        service.updateMemberRole(WS_ID, ADMIN_ID, 'other-admin', WorkspaceRole.MEMBER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when ADMIN tries to promote to ADMIN', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(MEMBER_ID, WorkspaceRole.MEMBER));

      await expect(
        service.updateMemberRole(WS_ID, ADMIN_ID, MEMBER_ID, WorkspaceRole.ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns early with "Роль не изменилась" when role is unchanged', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(MEMBER_ID, WorkspaceRole.MEMBER));

      const result = await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.MEMBER);

      expect(result).toMatchObject({ role: WorkspaceRole.MEMBER });
      expect(workspaceMemberRepository.save).not.toHaveBeenCalled();
    });

    it('transfers ownership: sets new owner and demotes old owner to ADMIN', async () => {
      const ownerMember = makeMember(OWNER_ID, WorkspaceRole.OWNER);
      const targetMember = makeMember(MEMBER_ID, WorkspaceRole.MEMBER);

      stubAdminCheck(ownerMember);
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne
        .mockResolvedValueOnce(targetMember)   // target member lookup
        .mockResolvedValueOnce(ownerMember);   // current owner lookup

      await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.OWNER);

      // Old owner is demoted
      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: OWNER_ID, role: WorkspaceRole.ADMIN }),
      );
      // New owner is promoted
      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: MEMBER_ID, role: WorkspaceRole.OWNER }),
      );
      // Workspace ownerId is updated
      expect(workspaceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: MEMBER_ID }),
      );
    });

    it('throws ForbiddenException when non-owner tries to transfer ownership', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace({ ownerId: OWNER_ID }));
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(MEMBER_ID, WorkspaceRole.MEMBER));

      await expect(
        service.updateMemberRole(WS_ID, ADMIN_ID, MEMBER_ID, WorkspaceRole.OWNER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates member role and saves', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      const member = makeMember(MEMBER_ID, WorkspaceRole.MEMBER);
      workspaceMemberRepository.findOne.mockResolvedValue(member);

      const result = await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.ADMIN);

      expect(workspaceMemberRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: WorkspaceRole.ADMIN }),
      );
      expect(result).toMatchObject({ role: WorkspaceRole.ADMIN });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cancelInvitation
  // ─────────────────────────────────────────────────────────────────────────
  describe('cancelInvitation', () => {
    it('throws BadRequestException for empty invitationId', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));

      await expect(service.cancelInvitation(WS_ID, ADMIN_ID, '')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when invitation not found', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      invitationRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelInvitation(WS_ID, ADMIN_ID, 'inv-99')).rejects.toThrow(NotFoundException);
    });

    it('returns early when invitation is already not PENDING', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      invitationRepository.findOne.mockResolvedValue({
        id: 'inv-1', workspaceId: WS_ID, status: WorkspaceInvitationStatus.CANCELLED,
      } as WorkspaceInvitation);

      const result = await service.cancelInvitation(WS_ID, ADMIN_ID, 'inv-1');

      expect(result).toMatchObject({ message: 'Invitation is already inactive' });
      expect(invitationRepository.save).not.toHaveBeenCalled();
    });

    it('marks PENDING invitation as CANCELLED', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      const invitation = {
        id: 'inv-1', workspaceId: WS_ID, status: WorkspaceInvitationStatus.PENDING,
      } as WorkspaceInvitation;
      invitationRepository.findOne.mockResolvedValue(invitation);

      const result = await service.cancelInvitation(WS_ID, ADMIN_ID, 'inv-1');

      expect(invitationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: WorkspaceInvitationStatus.CANCELLED }),
      );
      expect(result).toMatchObject({ message: 'Invitation revoked' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // removeMember
  // ─────────────────────────────────────────────────────────────────────────
  describe('removeMember', () => {
    it('throws BadRequestException for empty targetUserId', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));

      await expect(service.removeMember(WS_ID, OWNER_ID, '')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when workspace not found', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(null);

      await expect(service.removeMember(WS_ID, OWNER_ID, MEMBER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target member not found', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.removeMember(WS_ID, OWNER_ID, 'ghost')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when trying to remove OWNER', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(OWNER_ID, WorkspaceRole.OWNER));

      await expect(service.removeMember(WS_ID, ADMIN_ID, OWNER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when ADMIN tries to remove another ADMIN', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember('other-admin', WorkspaceRole.ADMIN));

      await expect(service.removeMember(WS_ID, ADMIN_ID, 'other-admin')).rejects.toThrow(ForbiddenException);
    });

    it('deletes member and creates audit event', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      const member = { ...makeMember(MEMBER_ID, WorkspaceRole.MEMBER), user: { workspaceId: WS_ID } };
      workspaceMemberRepository.findOne.mockResolvedValue(member);

      const result = await service.removeMember(WS_ID, OWNER_ID, MEMBER_ID);

      expect(workspaceMemberRepository.delete).toHaveBeenCalledWith(member.id);
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'workspace' }),
      );
      expect(result).toMatchObject({ message: 'Member access revoked' });
    });

    it('clears user workspaceId when they belong to removed workspace', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      const member = { ...makeMember(MEMBER_ID, WorkspaceRole.MEMBER), user: { workspaceId: WS_ID } };
      workspaceMemberRepository.findOne.mockResolvedValue(member);

      await service.removeMember(WS_ID, OWNER_ID, MEMBER_ID);

      expect(userRepository.update).toHaveBeenCalledWith(MEMBER_ID, { workspaceId: null });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // deleteWorkspace
  // ─────────────────────────────────────────────────────────────────────────
  describe('deleteWorkspace', () => {
    it('throws NotFoundException when workspace not found', async () => {
      workspaceRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteWorkspace(WS_ID, OWNER_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-owner tries to delete', async () => {
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());

      await expect(service.deleteWorkspace(WS_ID, MEMBER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('removes workspace and creates audit event', async () => {
      const workspace = makeWorkspace();
      workspaceRepository.findOne.mockResolvedValue(workspace);

      await service.deleteWorkspace(WS_ID, OWNER_ID);

      expect(workspaceRepository.remove).toHaveBeenCalledWith(workspace);
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', isUndoable: true }),
      );
      // Аудит — строго до remove: после удаления createEvent отверг бы событие
      // (воркспейса больше нет), и след удаления пропал бы.
      const auditOrder = auditService.createEvent.mock.invocationCallOrder[0];
      const removeOrder = workspaceRepository.remove.mock.invocationCallOrder[0];
      expect(auditOrder).toBeLessThan(removeOrder);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // switchWorkspace
  // ─────────────────────────────────────────────────────────────────────────
  describe('switchWorkspace', () => {
    it('throws ForbiddenException when user is not a member', async () => {
      workspaceMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.switchWorkspace(WS_ID, MEMBER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('updates lastWorkspaceId and increments accessCount', async () => {
      const membership = { id: 'm-1', workspaceId: WS_ID, userId: MEMBER_ID, accessCount: 5 } as WorkspaceMember;
      workspaceMemberRepository.findOne.mockResolvedValue(membership);

      await service.switchWorkspace(WS_ID, MEMBER_ID);

      expect(userRepository.update).toHaveBeenCalledWith(MEMBER_ID, { lastWorkspaceId: WS_ID });
      expect(workspaceMemberRepository.update).toHaveBeenCalledWith(
        'm-1',
        expect.objectContaining({ accessCount: 6, lastAccessedAt: expect.any(Date) }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getWorkspaceStats
  // ─────────────────────────────────────────────────────────────────────────
  describe('getWorkspaceStats', () => {
    it('returns integrationCount, memberCount and recentActivity', async () => {
      integrationRepository.count.mockResolvedValue(3);
      workspaceMemberRepository.count.mockResolvedValue(5);
      const recentDate = new Date(Date.now() - 1000 * 60 * 10); // 10 min ago
      workspaceMemberRepository.findOne.mockResolvedValue({ lastAccessedAt: recentDate } as WorkspaceMember);

      const result = await service.getWorkspaceStats(WS_ID);

      expect(result.integrationCount).toBe(3);
      expect(result.memberCount).toBe(5);
      expect(result.recentActivity).toBe(true);
      expect(result.lastAccessedAt).toEqual(recentDate);
    });

    it('reports no recentActivity when lastAccessedAt is older than 24h', async () => {
      integrationRepository.count.mockResolvedValue(0);
      workspaceMemberRepository.count.mockResolvedValue(1);
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago
      workspaceMemberRepository.findOne.mockResolvedValue({ lastAccessedAt: oldDate } as WorkspaceMember);

      const result = await service.getWorkspaceStats(WS_ID);

      expect(result.recentActivity).toBe(false);
    });

    it('returns recentActivity false and null lastAccessedAt when no members accessed', async () => {
      integrationRepository.count.mockResolvedValue(0);
      workspaceMemberRepository.count.mockResolvedValue(0);
      workspaceMemberRepository.findOne.mockResolvedValue(null);

      const result = await service.getWorkspaceStats(WS_ID);

      expect(result.recentActivity).toBe(false);
      expect(result.lastAccessedAt).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // toggleFavorite
  // ─────────────────────────────────────────────────────────────────────────
  describe('toggleFavorite', () => {
    it('throws ForbiddenException when user is not a member', async () => {
      workspaceMemberRepository.findOne.mockResolvedValue(null);

      await expect(service.toggleFavorite(WS_ID, MEMBER_ID)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when workspace not found', async () => {
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(MEMBER_ID, WorkspaceRole.MEMBER));
      workspaceRepository.findOne.mockResolvedValue(null);

      await expect(service.toggleFavorite(WS_ID, MEMBER_ID)).rejects.toThrow(NotFoundException);
    });

    it('flips isFavorite from false to true', async () => {
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(MEMBER_ID, WorkspaceRole.MEMBER));
      const workspace = makeWorkspace({ isFavorite: false } as any);
      workspaceRepository.findOne.mockResolvedValue(workspace);
      workspaceRepository.save.mockResolvedValue({ ...workspace, isFavorite: true });

      const result = await service.toggleFavorite(WS_ID, MEMBER_ID);

      expect(result.isFavorite).toBe(true);
    });

    it('flips isFavorite from true to false', async () => {
      workspaceMemberRepository.findOne.mockResolvedValue(makeMember(MEMBER_ID, WorkspaceRole.MEMBER));
      const workspace = makeWorkspace({ isFavorite: true } as any);
      workspaceRepository.findOne.mockResolvedValue(workspace);
      workspaceRepository.save.mockResolvedValue({ ...workspace, isFavorite: false });

      const result = await service.toggleFavorite(WS_ID, MEMBER_ID);

      expect(result.isFavorite).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // audit events for invitations and member management
  // ─────────────────────────────────────────────────────────────────────────
  describe('member audit events', () => {
    const owner = { id: OWNER_ID, email: 'owner@example.com', name: 'Owner' } as User;

    function stubNewInvitation() {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      userRepository.findOne.mockResolvedValue(null);
      invitationRepository.findOne.mockResolvedValue(null);
      invitationRepository.save.mockImplementationOnce(async (data: any) => ({
        ...data,
        id: 'inv-new',
      }));
    }

    it('logs WORKSPACE_MEMBER CREATE with invitation id when inviting', async () => {
      stubNewInvitation();

      await service.inviteMember(WS_ID, owner, {
        email: ' New@Example.com ',
        role: WorkspaceRole.VIEWER,
      } as any);

      expect(auditService.createEvent).toHaveBeenCalledTimes(1);
      expect(auditService.createEvent).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        actorType: ActorType.USER,
        actorId: OWNER_ID,
        entityType: EntityType.WORKSPACE_MEMBER,
        entityId: 'inv-new',
        action: AuditAction.CREATE,
        meta: { email: 'new@example.com', role: WorkspaceRole.VIEWER },
      });
    });

    it('logs WORKSPACE_MEMBER CREATE when re-sending a pending invitation', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      userRepository.findOne.mockResolvedValue(null);
      invitationRepository.findOne.mockResolvedValueOnce({
        id: 'inv-old',
        workspaceId: WS_ID,
        email: 'again@example.com',
        role: WorkspaceRole.MEMBER,
        status: WorkspaceInvitationStatus.PENDING,
      } as WorkspaceInvitation);

      await service.inviteMember(WS_ID, owner, {
        email: 'again@example.com',
        role: WorkspaceRole.ADMIN,
      } as any);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: EntityType.WORKSPACE_MEMBER,
          entityId: 'inv-old',
          action: AuditAction.CREATE,
          meta: { email: 'again@example.com', role: WorkspaceRole.ADMIN },
        }),
      );
    });

    it('does not fail the invitation when the audit write fails', async () => {
      stubNewInvitation();
      auditService.createEvent.mockRejectedValueOnce(new Error('audit down'));

      const result = await service.inviteMember(WS_ID, owner, {
        email: 'x@example.com',
        role: WorkspaceRole.MEMBER,
      } as any);

      expect(result.invitation).toMatchObject({ id: 'inv-new' });
      expect((service as any).sendInvitationEmail).toHaveBeenCalled();
    });

    it('logs WORKSPACE_MEMBER DELETE when revoking a pending invitation', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      invitationRepository.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        workspaceId: WS_ID,
        email: 'gone@example.com',
        status: WorkspaceInvitationStatus.PENDING,
      } as WorkspaceInvitation);

      await service.cancelInvitation(WS_ID, ADMIN_ID, 'inv-1');

      expect(auditService.createEvent).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        actorType: ActorType.USER,
        actorId: ADMIN_ID,
        entityType: EntityType.WORKSPACE_MEMBER,
        entityId: 'inv-1',
        action: AuditAction.DELETE,
        meta: { email: 'gone@example.com' },
      });
    });

    it('does not log when the invitation was already inactive', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      invitationRepository.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        workspaceId: WS_ID,
        status: WorkspaceInvitationStatus.CANCELLED,
      } as WorkspaceInvitation);

      await service.cancelInvitation(WS_ID, ADMIN_ID, 'inv-1');

      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('does not fail the revoke when the audit write fails', async () => {
      stubAdminCheck(makeMember(ADMIN_ID, WorkspaceRole.ADMIN));
      invitationRepository.findOne.mockResolvedValueOnce({
        id: 'inv-1',
        workspaceId: WS_ID,
        email: 'gone@example.com',
        status: WorkspaceInvitationStatus.PENDING,
      } as WorkspaceInvitation);
      auditService.createEvent.mockRejectedValueOnce(new Error('audit down'));

      await expect(service.cancelInvitation(WS_ID, ADMIN_ID, 'inv-1')).resolves.toMatchObject({
        message: 'Invitation revoked',
      });
    });

    it('logs WORKSPACE_MEMBER UPDATE with role diff (INFO) for a member role change', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValueOnce(
        makeMember(MEMBER_ID, WorkspaceRole.MEMBER, { user: { email: 'm@example.com' } }),
      );

      await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.VIEWER);

      expect(workspaceMemberRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['user'] }),
      );
      expect(auditService.createEvent).toHaveBeenCalledWith({
        workspaceId: WS_ID,
        actorType: ActorType.USER,
        actorId: OWNER_ID,
        entityType: EntityType.WORKSPACE_MEMBER,
        entityId: `m-${MEMBER_ID}`,
        action: AuditAction.UPDATE,
        diff: { before: { role: WorkspaceRole.MEMBER }, after: { role: WorkspaceRole.VIEWER } },
        meta: { userId: MEMBER_ID, email: 'm@example.com' },
        severity: Severity.INFO,
      });
    });

    it('uses WARN severity when promoting to admin', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValueOnce(
        makeMember(MEMBER_ID, WorkspaceRole.MEMBER),
      );

      await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.ADMIN);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          diff: { before: { role: WorkspaceRole.MEMBER }, after: { role: WorkspaceRole.ADMIN } },
          meta: { userId: MEMBER_ID, email: null },
          severity: Severity.WARN,
        }),
      );
    });

    it('uses WARN severity when transferring ownership', async () => {
      const ownerMember = makeMember(OWNER_ID, WorkspaceRole.OWNER);
      stubAdminCheck(ownerMember);
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne
        .mockResolvedValueOnce(makeMember(MEMBER_ID, WorkspaceRole.MEMBER))
        .mockResolvedValueOnce(ownerMember);

      await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.OWNER);

      expect(auditService.createEvent).toHaveBeenCalledTimes(1);
      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: `m-${MEMBER_ID}`,
          diff: { before: { role: WorkspaceRole.MEMBER }, after: { role: WorkspaceRole.OWNER } },
          severity: Severity.WARN,
        }),
      );
    });

    it('does not log when the role is unchanged', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValueOnce(
        makeMember(MEMBER_ID, WorkspaceRole.MEMBER),
      );

      await service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.MEMBER);

      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('does not fail the role change when the audit write fails', async () => {
      stubAdminCheck(makeMember(OWNER_ID, WorkspaceRole.OWNER));
      workspaceRepository.findOne.mockResolvedValue(makeWorkspace());
      workspaceMemberRepository.findOne.mockResolvedValueOnce(
        makeMember(MEMBER_ID, WorkspaceRole.MEMBER),
      );
      auditService.createEvent.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.updateMemberRole(WS_ID, OWNER_ID, MEMBER_ID, WorkspaceRole.VIEWER),
      ).resolves.toMatchObject({ role: WorkspaceRole.VIEWER });
      expect(workspaceMemberRepository.save).toHaveBeenCalled();
    });
  });
});
