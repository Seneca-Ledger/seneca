import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { IsNull, type Repository } from 'typeorm';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { hashPassword } from '../../common/utils/password-hash.util';
import type {
  ChangeEmailBody,
  ChangePasswordBody,
  CompleteOnboardingBody,
  UpdateMyPreferencesBody,
  UpdateUserBody,
} from '../../contracts';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import {
  DateFormatPreference,
  ThemePreference,
  UiDensity,
  User,
  UserRole,
} from '../../entities/user.entity';
import { Workspace } from '../../entities/workspace.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { CURRENT_DISCLAIMER_VERSION } from './disclaimer.constant';
import { EmailChangeService } from './services/email-change.service';

/** How many pages the page-hint map may name; see markPageHintsSeen. */
export const PAGE_HINTS_MAX_KEYS = 100;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    private readonly workspacesService: WorkspacesService,
    private readonly emailChangeService: EmailChangeService,
    private readonly auditService: AuditService,
  ) {}

  private getUserFindAllOptions(workspaceId: string, limit = 20) {
    return {
      where: { deletedAt: IsNull(), workspaceMemberships: { workspaceId } },
      take: limit,
      order: { createdAt: 'DESC' as const },
    };
  }

  private async findOneWithPassword(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
        company: true,
        role: true,
        workspaceId: true,
        telegramId: true,
        telegramChatId: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        isActive: true,
        permissions: true,
        locale: true,
        timeZone: true,
        dateFormat: true,
        firstDayOfWeek: true,
        uiDensity: true,
        reduceMotion: true,
        showDailyQuote: true,
        themePreference: true,
        mapStylePreference: true,
        avatarUrl: true,
        onboardingCompletedAt: true,
        disclaimerAcceptedAt: true,
        disclaimerVersion: true,
        welcomeTutorialSeenAt: true,
        pageHintsSeen: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // workspaceId is required, not optional: as an optional parameter the tenant
  // filter silently disappeared whenever a caller passed the wrong argument,
  // which is exactly what the controller used to do (it passed the page number).
  // The workspace's users are its members; users.workspace_id is only the one
  // each registered with, which left out members who registered elsewhere.
  async findAll(workspaceId: string, limit = 20): Promise<User[]> {
    if (typeof this.userRepository.createQueryBuilder === 'function') {
      return this.userRepository
        .createQueryBuilder('user')
        .innerJoin(
          'user.workspaceMemberships',
          'membership',
          'membership.workspaceId = :workspaceId',
          {
            workspaceId,
          },
        )
        .where('user.deletedAt IS NULL')
        .orderBy('user.createdAt', 'DESC')
        .take(limit)
        .getMany();
    }

    return this.userRepository.find(this.getUserFindAllOptions(workspaceId, limit));
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        role: true,
        workspaceId: true,
        telegramId: true,
        telegramChatId: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        isActive: true,
        permissions: true,
        locale: true,
        timeZone: true,
        themePreference: true,
        mapStylePreference: true,
        onboardingCompletedAt: true,
        disclaimerAcceptedAt: true,
        disclaimerVersion: true,
        welcomeTutorialSeenAt: true,
        pageHintsSeen: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserBody, currentUser: User): Promise<User> {
    // Only admins can update users
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const user = await this.findOne(id);

    // Only admins can change roles
    if (updateUserDto.role && currentUser.role !== UserRole.ADMIN) {
      updateUserDto.role = undefined;
    }

    // Only admins can change permissions
    if (updateUserDto.permissions && currentUser.role !== UserRole.ADMIN) {
      updateUserDto.permissions = undefined;
    }

    // Validate permissions if provided
    if (updateUserDto.permissions) {
      const validPermissions = Object.values(Permission);
      const invalidPermissions = updateUserDto.permissions.filter(
        p => !validPermissions.includes(p as Permission),
      );
      if (invalidPermissions.length > 0) {
        throw new BadRequestException(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }
    }

    const before = this.snapshotAdminFields(user);
    Object.assign(user, updateUserDto);
    const saved = await this.userRepository.save(user);

    // Logged into the target's home workspace, like every other account event:
    // this route carries no workspace of its own.
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: currentUser.id,
      entityType: EntityType.USER,
      entityId: id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      diff: { before, after: this.snapshotAdminFields(saved) },
    });

    return saved;
  }

  /** The fields UpdateUserDto can change — nothing credential-bearing. */
  private snapshotAdminFields(user: User) {
    return {
      email: user.email,
      name: user.name,
      company: user.company,
      role: user.role,
      isActive: user.isActive,
      permissions: user.permissions ?? null,
    };
  }

  async remove(id: string, currentUser: User): Promise<void> {
    // Only admins can delete users
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can delete users');
    }

    // Prevent self-deletion
    if (currentUser.id === id) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const target = await this.findOne(id);
    await this.userRepository.softDelete(id);

    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: target.workspaceId,
      actorId: currentUser.id,
      entityType: EntityType.USER,
      entityId: id,
      action: AuditAction.DELETE,
      severity: Severity.WARN,
      meta: { email: target.email },
    });
  }

  async getProfile(userId: string): Promise<User> {
    return this.findOne(userId);
  }

  /**
   * Records that the user accepted the current no-warranty disclaimer.
   *
   * Accepting the same revision twice keeps the original timestamp: the first
   * acceptance is the one that carries meaning, and overwriting it would erase
   * when consent was actually given.
   */
  async acceptDisclaimer(userId: string): Promise<User> {
    const user = await this.findOne(userId);

    if (user.disclaimerVersion === CURRENT_DISCLAIMER_VERSION && user.disclaimerAcceptedAt) {
      return user;
    }

    user.disclaimerAcceptedAt = new Date();
    user.disclaimerVersion = CURRENT_DISCLAIMER_VERSION;

    return this.userRepository.save(user);
  }

  /**
   * Stops the welcome tutorial from opening by itself. A single conditional UPDATE:
   * the first close wins even when several arrive at once (two tabs), and no other
   * column of the user is read back and rewritten.
   */
  async markWelcomeTutorialSeen(userId: string): Promise<Date | null> {
    await this.userRepository.query(
      'UPDATE "users" SET "welcome_tutorial_seen_at" = NOW() WHERE "id" = $1 AND "welcome_tutorial_seen_at" IS NULL',
      [userId],
    );
    const { welcomeTutorialSeenAt } = await this.findOne(userId);
    return welcomeTutorialSeenAt;
  }

  /**
   * Records that the hints of `page` were closed up to `version`. One conditional
   * UPDATE keeps the higher of the stored and the given version, so an older tab
   * cannot lower it, and no other column is read back and rewritten. A new key is
   * refused once the map holds PAGE_HINTS_MAX_KEYS pages: the client only knows a
   * few dozen, so anything beyond that is someone filling the column.
   */
  async markPageHintsSeen(
    userId: string,
    page: string,
    version: number,
  ): Promise<Record<string, number>> {
    await this.userRepository.query(
      `UPDATE "users"
       SET "page_hints_seen" = "page_hints_seen" || jsonb_build_object(
         $2::text,
         GREATEST(COALESCE(("page_hints_seen" ->> $2::text)::int, 0), $3::int)
       )
       WHERE "id" = $1
         AND (
           ("page_hints_seen" -> $2::text) IS NOT NULL
           OR (SELECT count(*) FROM jsonb_object_keys("page_hints_seen")) < $4
         )`,
      [userId, page, version, PAGE_HINTS_MAX_KEYS],
    );
    const { pageHintsSeen } = await this.findOne(userId);
    return pageHintsSeen;
  }

  /** Settings → "Show hints again": every page shows its hints once more. */
  async resetPageHints(userId: string): Promise<Record<string, number>> {
    await this.userRepository.query(
      `UPDATE "users" SET "page_hints_seen" = '{}'::jsonb WHERE "id" = $1`,
      [userId],
    );
    const { pageHintsSeen } = await this.findOne(userId);
    return pageHintsSeen;
  }

  /**
   * Confirms the caller owns the account, then hands off to EmailChangeService,
   * which mails a confirmation link to the new address. The account keeps its
   * current email until that link is opened.
   */
  async requestEmailChange(userId: string, dto: ChangeEmailBody): Promise<void> {
    const user = await this.findOneWithPassword(userId);

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new ForbiddenException('Current password is incorrect');
    }

    await this.emailChangeService.requestEmailChange(user, dto.email);
  }

  async changePassword(userId: string, dto: ChangePasswordBody): Promise<void> {
    const user = await this.findOneWithPassword(userId);

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      throw new ForbiddenException('Current password is incorrect');
    }

    user.passwordHash = await hashPassword(dto.newPassword);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await this.userRepository.save(user);

    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: user.workspaceId,
      actorId: user.id,
      entityType: EntityType.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      severity: Severity.WARN,
      meta: { password: 'changed' },
    });
  }

  async updateMyPreferences(userId: string, dto: UpdateMyPreferencesBody): Promise<User> {
    const user = await this.findOneWithPassword(userId);

    if (dto.name != null) {
      user.name = dto.name.trim();
    }
    if (dto.locale != null) {
      user.locale = dto.locale;
    }
    if (dto.timeZone !== undefined) {
      const tz = dto.timeZone;
      user.timeZone = tz === null ? null : String(tz).trim() || null;
    }
    if (dto.themePreference != null) {
      user.themePreference = toEnum(ThemePreference, dto.themePreference);
    }
    if (dto.mapStylePreference !== undefined) {
      const style = dto.mapStylePreference;
      user.mapStylePreference = style === null ? null : String(style).trim() || null;
    }
    if (dto.dateFormat != null) {
      user.dateFormat = toEnum(DateFormatPreference, dto.dateFormat);
    }
    if (dto.firstDayOfWeek !== undefined) {
      user.firstDayOfWeek = dto.firstDayOfWeek;
    }
    if (dto.uiDensity != null) {
      user.uiDensity = toEnum(UiDensity, dto.uiDensity);
    }
    if (dto.reduceMotion != null) {
      user.reduceMotion = dto.reduceMotion;
    }
    if (dto.showDailyQuote != null) {
      user.showDailyQuote = dto.showDailyQuote;
    }

    return this.userRepository.save(user);
  }

  async updateMyAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.findOneWithPassword(userId);
    user.avatarUrl = avatarUrl;
    return this.userRepository.save(user);
  }

  async completeOnboarding(userId: string, dto: CompleteOnboardingBody): Promise<User> {
    const user = await this.findOneWithPassword(userId);

    if (!user.workspaceId) {
      const ensuredWorkspace = await this.workspacesService.ensureUserWorkspace(user);
      user.workspaceId = ensuredWorkspace.id;
    }

    if (dto.locale != null) {
      user.locale = dto.locale;
    }

    if (dto.timeZone !== undefined) {
      user.timeZone = dto.timeZone === null ? null : String(dto.timeZone).trim() || null;
    }

    const shouldUpdateWorkspace =
      Boolean(user.workspaceId) &&
      (dto.workspaceName !== undefined ||
        dto.workspaceCurrency !== undefined ||
        dto.workspaceBackgroundImage !== undefined);

    if (shouldUpdateWorkspace) {
      const workspace = await this.workspaceRepository.findOne({
        where: { id: user.workspaceId as string },
      });

      if (workspace) {
        if (dto.workspaceName != null) {
          const workspaceName = dto.workspaceName.trim();
          if (workspaceName.length > 0) {
            workspace.name = workspaceName;
          }
        }

        if (dto.workspaceCurrency != null) {
          const workspaceCurrency = dto.workspaceCurrency.trim().toUpperCase();
          if (workspaceCurrency.length > 0) {
            workspace.currency = workspaceCurrency;
          }
        }

        if (dto.workspaceBackgroundImage != null) {
          const workspaceBackgroundImage = dto.workspaceBackgroundImage.trim();
          workspace.backgroundImage =
            workspaceBackgroundImage.length > 0 ? workspaceBackgroundImage : null;
        }

        await this.workspaceRepository.save(workspace);
      }
    }

    if (!user.onboardingCompletedAt) {
      user.onboardingCompletedAt = new Date();
    }

    return this.userRepository.save(user);
  }
}
