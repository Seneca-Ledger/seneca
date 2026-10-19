import { ConflictException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, type Repository } from 'typeorm';
import {
  AuditAction,
  AuditEvent,
  EntityType,
  Severity,
} from '../../../entities/audit-event.entity';
import { AuthSession } from '../../../entities/auth-session.entity';
import { Notification } from '../../../entities/notification.entity';
import { NotificationPreference } from '../../../entities/notification-preference.entity';
import { User } from '../../../entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '../../../entities/workspace-member.entity';
import { AuditService } from '../../audit/audit.service';
import { recordSecurityEvent } from '../../auth/security-audit.util';

/** How many of the user's own audit entries the export carries. */
const EXPORT_AUDIT_LIMIT = 5000;
/** How many of the user's notifications the export carries. */
const EXPORT_NOTIFICATION_LIMIT = 5000;

export interface AccountExport {
  exportedAt: string;
  profile: Record<string, unknown>;
  workspaceMemberships: Array<Record<string, unknown>>;
  authSessions: Array<Record<string, unknown>>;
  notificationPreferences: Record<string, unknown> | null;
  notifications: Array<Record<string, unknown>>;
  auditEvents: Array<Record<string, unknown>>;
}

/**
 * Serves the two things a person can ask about their own account: give me a copy,
 * and delete it. Workspace financial records are deliberately out of scope — those
 * belong to the workspace and its other members, not to one account.
 */
@Injectable()
export class AccountDataService {
  private readonly logger = new Logger(AccountDataService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepository: Repository<WorkspaceMember>,
    @InjectRepository(AuthSession)
    private readonly sessionRepository: Repository<AuthSession>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(AuditEvent)
    private readonly auditRepository: Repository<AuditEvent>,
    private readonly auditService: AuditService,
  ) {}

  async exportMyData(userId: string): Promise<AccountExport> {
    const [user, memberships, sessions, preferences, notifications, auditEvents] =
      await Promise.all([
        this.userRepository.findOne({ where: { id: userId } }),
        this.memberRepository.find({
          where: { userId },
          relations: { workspace: true },
        }),
        this.sessionRepository.find({ where: { userId }, order: { createdAt: 'DESC' } }),
        this.preferenceRepository.findOne({ where: { userId } }),
        this.notificationRepository.find({
          where: { recipientId: userId },
          order: { createdAt: 'DESC' },
          take: EXPORT_NOTIFICATION_LIMIT,
        }),
        this.auditRepository.find({
          where: { actorId: userId },
          order: { createdAt: 'DESC' },
          take: EXPORT_AUDIT_LIMIT,
        }),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: this.serializeProfile(user),
      workspaceMemberships: memberships.map(member => ({
        workspaceId: member.workspaceId,
        workspaceName: member.workspace?.name ?? null,
        role: member.role,
        permissions: member.permissions,
        lastAccessedAt: member.lastAccessedAt,
        joinedAt: member.createdAt,
      })),
      // Token hashes stay server-side; the export describes the session, not its secret.
      authSessions: sessions.map(session => ({
        id: session.id,
        device: session.device,
        browser: session.browser,
        os: session.os,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        revokedAt: session.revokedAt,
      })),
      notificationPreferences: preferences ? { ...preferences, id: undefined } : null,
      notifications: notifications.map(notification => ({ ...notification })),
      auditEvents: auditEvents.map(event => ({ ...event })),
    };
  }

  /**
   * Soft-deletes the caller's own account after a password check, and kills every
   * live session so the JWT that made the request cannot be refreshed afterwards.
   */
  async deleteMyAccount(userId: string, currentPassword: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'workspaceId', 'passwordHash'],
    });

    if (!user) {
      throw new ForbiddenException('Account not found');
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash ?? '');
    if (!passwordMatches) {
      throw new ForbiddenException('Current password is incorrect');
    }

    await this.assertNotSoleOwner(userId);

    // Written before the deletion, while the account can still be resolved as
    // the actor. The home workspace survives: accounts are soft-deleted.
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.DELETE,
      severity: Severity.CRITICAL,
      meta: { email: user.email, reason: 'self-service' },
    });

    await this.sessionRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
    await this.userRepository.softDelete(userId);

    this.logger.log(`Account ${userId} deleted on the owner's request`);
  }

  /**
   * Refuses to strand a workspace. Losing its last owner would leave the workspace
   * and everything in it unmanageable, so the user has to hand it over first.
   */
  private async assertNotSoleOwner(userId: string): Promise<void> {
    const ownedWorkspaces = await this.memberRepository.find({
      where: { userId, role: WorkspaceRole.OWNER },
      relations: { workspace: true },
    });

    for (const membership of ownedWorkspaces) {
      const ownerCount = await this.memberRepository.count({
        where: { workspaceId: membership.workspaceId, role: WorkspaceRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new ConflictException(
          `You are the only owner of workspace "${membership.workspace?.name ?? membership.workspaceId}". Transfer ownership or delete the workspace before deleting your account.`,
        );
      }
    }
  }

  private serializeProfile(user: User | null): Record<string, unknown> {
    if (!user) {
      return {};
    }
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
