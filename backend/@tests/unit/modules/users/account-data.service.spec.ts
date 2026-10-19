import { AuditAction, EntityType, Severity } from '@/entities/audit-event.entity';
import { WorkspaceRole } from '@/entities/workspace-member.entity';
import { AccountDataService } from '@/modules/users/services/account-data.service';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const createRepoMock = () =>
  ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
  }) as any;

describe('AccountDataService', () => {
  const userRepo = createRepoMock();
  const memberRepo = createRepoMock();
  const sessionRepo = createRepoMock();
  const preferenceRepo = createRepoMock();
  const notificationRepo = createRepoMock();
  const auditRepo = createRepoMock();
  const auditService = { createEvent: jest.fn() };

  let service: AccountDataService;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.find.mockResolvedValue([]);
    memberRepo.find.mockResolvedValue([]);
    sessionRepo.find.mockResolvedValue([]);
    notificationRepo.find.mockResolvedValue([]);
    auditRepo.find.mockResolvedValue([]);
    preferenceRepo.findOne.mockResolvedValue(null);
    auditService.createEvent.mockResolvedValue({});
    service = new AccountDataService(
      userRepo,
      memberRepo,
      sessionRepo,
      preferenceRepo,
      notificationRepo,
      auditRepo,
      auditService as never,
    );
  });

  describe('exportMyData', () => {
    it('never includes the password hash or refresh token hashes', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.c',
        passwordHash: 'super-secret-hash',
      });
      sessionRepo.find.mockResolvedValue([
        {
          id: 'session-1',
          refreshTokenHash: 'refresh-secret',
          device: 'Mac',
          browser: 'Chrome',
          os: 'macOS',
          ipAddress: null,
          userAgent: null,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          revokedAt: null,
        },
      ]);

      const result = await service.exportMyData('user-1');

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('super-secret-hash');
      expect(serialized).not.toContain('refresh-secret');
      expect(result.profile.email).toBe('a@b.c');
      expect(result.authSessions).toHaveLength(1);
    });
  });

  describe('deleteMyAccount', () => {
    it('rejects a wrong password without touching the account', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        passwordHash: await bcrypt.hash('right-password', 4),
      });

      await expect(service.deleteMyAccount('user-1', 'wrong-password')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(userRepo.softDelete).not.toHaveBeenCalled();
      expect(sessionRepo.update).not.toHaveBeenCalled();
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('refuses to strand a workspace whose only owner is the caller', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        passwordHash: await bcrypt.hash('right-password', 4),
      });
      memberRepo.find.mockResolvedValue([
        { workspaceId: 'ws-1', role: WorkspaceRole.OWNER, workspace: { name: 'Acme' } },
      ]);
      memberRepo.count.mockResolvedValue(1);

      await expect(service.deleteMyAccount('user-1', 'right-password')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(userRepo.softDelete).not.toHaveBeenCalled();
    });

    it('soft-deletes and revokes every live session when a co-owner remains', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        passwordHash: await bcrypt.hash('right-password', 4),
      });
      memberRepo.find.mockResolvedValue([
        { workspaceId: 'ws-1', role: WorkspaceRole.OWNER, workspace: { name: 'Acme' } },
      ]);
      memberRepo.count.mockResolvedValue(2);

      await service.deleteMyAccount('user-1', 'right-password');

      expect(sessionRepo.update).toHaveBeenCalled();
      expect(userRepo.softDelete).toHaveBeenCalledWith('user-1');
    });

    it('logs the deletion as CRITICAL into the home workspace before deleting', async () => {
      const passwordHash = await bcrypt.hash('right-password', 4);
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.c',
        workspaceId: 'ws-home',
        passwordHash,
      });
      memberRepo.find.mockResolvedValue([]);
      auditService.createEvent.mockImplementation(async () => {
        expect(userRepo.softDelete).not.toHaveBeenCalled();
        return {};
      });

      await service.deleteMyAccount('user-1', 'right-password');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-home',
          actorId: 'user-1',
          entityType: EntityType.USER,
          entityId: 'user-1',
          action: AuditAction.DELETE,
          severity: Severity.CRITICAL,
        }),
      );
      const payload = JSON.stringify(auditService.createEvent.mock.calls);
      expect(payload).not.toContain(passwordHash);
      expect(payload).not.toContain('right-password');
      expect(userRepo.softDelete).toHaveBeenCalledWith('user-1');
    });

    it('still deletes the account when the audit write fails', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        workspaceId: 'ws-home',
        passwordHash: await bcrypt.hash('right-password', 4),
      });
      memberRepo.find.mockResolvedValue([]);
      auditService.createEvent.mockRejectedValue(new Error('audit down'));

      await service.deleteMyAccount('user-1', 'right-password');

      expect(userRepo.softDelete).toHaveBeenCalledWith('user-1');
    });
  });
});
