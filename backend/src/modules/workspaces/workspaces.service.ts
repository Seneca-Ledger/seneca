import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { render } from '@react-email/render';
import nodemailer from 'nodemailer';
import * as React from 'react';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { retry, TimeoutError, withTimeout } from '../../common/utils/async.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { mergeProcessingSettings } from '../../common/utils/workspace-processing.util';
import { mergeWorkspaceProfile } from '../../common/utils/workspace-profile.util';
import {
  invitationRoleKey,
  renderInvitation,
} from '../../emails/workspace-invitation.translations';
import {
  Integration,
  User,
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceMember,
  type WorkspaceMemberPermissions,
  WorkspaceRole,
} from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { ApplicationSettingsService } from '../application-settings/application-settings.service';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { BalanceService } from '../balance/balance.service';
import { CategoriesService } from '../categories/categories.service';
import type {
  MemberInvitedEvent,
  MemberJoinedEvent,
  WorkspaceUpdatedEvent,
} from '../notifications/events/notification-events';
import { TaxRatesService } from '../tax/tax-rates.service';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import type { WorkspaceResponseDto, WorkspaceStatsDto } from './dto/workspace-response.dto';

const INVITATION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceInvitation)
    private readonly invitationRepository: Repository<WorkspaceInvitation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    private readonly auditService: AuditService,
    private readonly balanceService: BalanceService,
    private readonly categoriesService: CategoriesService,
    private readonly taxRatesService: TaxRatesService,
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    private readonly applicationSettingsService?: ApplicationSettingsService,
  ) {}

  private async resolveActorName(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['name', 'email'],
    });

    return user?.name || user?.email || 'User';
  }

  // Member/invitation audit must never fail the change it records.
  private async recordMemberAudit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Audit event failed for ${event.entityType} ${event.entityId} (${event.action}): ${message}`,
      );
    }
  }

  private auditRoleChange(
    workspaceId: string,
    actorId: string,
    member: WorkspaceMember,
    before: WorkspaceRole,
  ) {
    return this.recordMemberAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId,
      entityType: EntityType.WORKSPACE_MEMBER,
      entityId: member.id,
      action: AuditAction.UPDATE,
      diff: { before: { role: before }, after: { role: member.role } },
      meta: { userId: member.userId, email: member.user?.email ?? null },
      severity:
        member.role === WorkspaceRole.OWNER || member.role === WorkspaceRole.ADMIN
          ? Severity.WARN
          : Severity.INFO,
    });
  }

  private auditInvitationCreated(
    workspaceId: string,
    actorId: string,
    invitation: WorkspaceInvitation,
  ) {
    return this.recordMemberAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId,
      entityType: EntityType.WORKSPACE_MEMBER,
      entityId: invitation.id,
      action: AuditAction.CREATE,
      meta: { email: invitation.email, role: invitation.role },
    });
  }

  async ensureUserWorkspace(user: User): Promise<Workspace> {
    if (user.workspaceId) {
      const existing = await this.workspaceRepository.findOne({
        where: { id: user.workspaceId },
      });
      if (existing) {
        return existing;
      }
    }

    const workspace = this.workspaceRepository.create({
      name: `${user.name || user.email} workspace`,
      // No one picks a currency on sign-up, and a workspace without one is how
      // a hardcoded default used to end up on every amount in it.
      currency: currencyCodeOrDefault(null),
      ownerId: user.id,
    });
    const savedWorkspace = await this.workspaceRepository.save(workspace);

    await this.workspaceMemberRepository.save({
      workspaceId: savedWorkspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
      invitedById: user.id,
    });

    await this.userRepository.update(user.id, { workspaceId: savedWorkspace.id });
    await this.categoriesService.createSystemCategories(savedWorkspace.id, user.id);
    await this.taxRatesService.createDefaultTaxRates(savedWorkspace.id);
    await this.balanceService.seedDefaultAccounts(savedWorkspace.id);

    return savedWorkspace;
  }

  async getWorkspaceOverview(currentUser: User, requestAppOrigin?: string) {
    const workspace = await this.ensureUserWorkspace(currentUser);

    const members = await this.workspaceMemberRepository.find({
      where: { workspaceId: workspace.id },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    const invitations = await this.invitationRepository.find({
      where: { workspaceId: workspace.id, status: WorkspaceInvitationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    const invitationResponses = await Promise.all(
      invitations.map(async invite => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        permissions: invite.permissions,
        status: invite.status,
        token: invite.token,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        link: await this.buildInvitationLink(invite.token, requestAppOrigin, currentUser),
      })),
    );

    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        createdAt: workspace.createdAt,
      },
      members: members.map(member => ({
        id: member.userId,
        /** The membership row, which is what owns transactions and wallets. */
        memberId: member.id,
        email: member.user?.email,
        name: member.user?.name,
        avatarUrl: member.user?.avatarUrl,
        timeZone: member.user?.timeZone,
        role: member.role,
        permissions: member.permissions,
        joinedAt: member.createdAt,
      })),
      invitations: invitationResponses,
    };
  }

  async getWorkspaceMembers(workspaceId: string, userId: string) {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }

    const members = await this.workspaceMemberRepository.find({
      where: { workspaceId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    return members.map(member => ({
      id: member.userId,
      /** The membership row, which is what owns transactions and wallets. */
      memberId: member.id,
      email: member.user?.email,
      name: member.user?.name,
      avatarUrl: member.user?.avatarUrl,
      timeZone: member.user?.timeZone,
      role: member.role,
      permissions: member.permissions,
      joinedAt: member.createdAt,
    }));
  }

  async getWorkspaceInvitations(workspaceId: string, userId: string) {
    await this.requireAdminMembership(workspaceId, userId);

    const invitations = await this.invitationRepository.find({
      where: { workspaceId, status: WorkspaceInvitationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    return invitations.map(invite => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      permissions: invite.permissions,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    }));
  }

  private async requireAdminMembership(workspaceId: string, userId: string) {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }

    if (![WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(membership.role)) {
      throw new ForbiddenException(appError('WORKSPACE_ADMIN_REQUIRED_TO_INVITE'));
    }

    return membership;
  }

  /**
   * Replaces the toggles on one member. Only the `member` role carries them:
   * owners and admins are unrestricted, viewers never write, so for both the
   * column stays NULL rather than holding values nothing reads.
   */
  async updateMemberPermissions(
    workspaceId: string,
    requestingUserId: string,
    targetUserId: string,
    permissions: WorkspaceMemberPermissions,
  ) {
    await this.requireAdminMembership(workspaceId, requestingUserId);

    if (!targetUserId || targetUserId.trim().length === 0) {
      throw new BadRequestException(appError('USER_INVALID'));
    }

    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: targetUserId },
      relations: ['user'],
    });

    if (!member) {
      throw new NotFoundException(appError('MEMBER_NOT_FOUND'));
    }

    if (member.role !== WorkspaceRole.MEMBER) {
      throw new BadRequestException(appError('MEMBER_PERMISSIONS_ROLE_INVALID'));
    }

    const before = member.permissions;
    member.permissions = permissions;
    await this.workspaceMemberRepository.save(member);

    await this.recordMemberAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: requestingUserId,
      entityType: EntityType.WORKSPACE_MEMBER,
      entityId: member.id,
      action: AuditAction.UPDATE,
      diff: { before: { permissions: before }, after: { permissions: member.permissions } },
      meta: { userId: member.userId, email: member.user?.email ?? null },
      severity: Severity.WARN,
    });

    return { message: 'Member permissions updated', permissions: member.permissions };
  }

  async updateMemberRole(
    workspaceId: string,
    requestingUserId: string,
    targetUserId: string,
    role: WorkspaceRole,
  ) {
    const currentMembership = await this.requireAdminMembership(workspaceId, requestingUserId);

    if (!targetUserId || targetUserId.trim().length === 0) {
      throw new BadRequestException(appError('USER_INVALID'));
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: targetUserId },
      relations: ['user'],
    });

    if (!member) {
      throw new NotFoundException(appError('MEMBER_NOT_FOUND'));
    }

    if (member.userId === requestingUserId) {
      throw new ForbiddenException(appError('MEMBER_CANNOT_CHANGE_OWN_ROLE'));
    }

    if (member.role === WorkspaceRole.OWNER && role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException(appError('WORKSPACE_TRANSFER_OWNERSHIP_FIRST'));
    }

    if (currentMembership.role === WorkspaceRole.ADMIN) {
      if (
        member.role === WorkspaceRole.ADMIN ||
        member.role === WorkspaceRole.OWNER ||
        role === WorkspaceRole.ADMIN ||
        role === WorkspaceRole.OWNER
      ) {
        throw new ForbiddenException(appError('WORKSPACE_ONLY_OWNER_CAN_MANAGE_ADMINS_AND_OWNER'));
      }
    }

    if (member.role === role) {
      return { message: 'Role unchanged', role: member.role };
    }

    const previousRole = member.role;

    if (role === WorkspaceRole.OWNER) {
      if (workspace.ownerId !== requestingUserId) {
        throw new ForbiddenException(appError('WORKSPACE_ONLY_OWNER_CAN_TRANSFER'));
      }

      const currentOwnerMembership = await this.workspaceMemberRepository.findOne({
        where: { workspaceId, userId: workspace.ownerId },
      });

      if (!currentOwnerMembership) {
        throw new NotFoundException(appError('WORKSPACE_OWNER_NOT_FOUND'));
      }

      currentOwnerMembership.role = WorkspaceRole.ADMIN;
      member.role = WorkspaceRole.OWNER;
      member.permissions = null;

      workspace.ownerId = member.userId;

      await this.workspaceRepository.save(workspace);
      await this.workspaceMemberRepository.save(currentOwnerMembership);
      await this.workspaceMemberRepository.save(member);

      await this.auditRoleChange(workspaceId, requestingUserId, member, previousRole);

      return { message: 'Workspace ownership transferred', role: member.role };
    }

    member.role = role;
    if (role !== WorkspaceRole.MEMBER) {
      member.permissions = null;
    }

    await this.workspaceMemberRepository.save(member);

    await this.auditRoleChange(workspaceId, requestingUserId, member, previousRole);

    return { message: 'Role updated', role: member.role };
  }

  async cancelInvitation(workspaceId: string, requestingUserId: string, invitationId: string) {
    await this.requireAdminMembership(workspaceId, requestingUserId);

    if (!invitationId || invitationId.trim().length === 0) {
      throw new BadRequestException(appError('INVITATION_INVALID'));
    }

    const invitation = await this.invitationRepository.findOne({
      where: { id: invitationId, workspaceId },
    });

    if (!invitation) {
      throw new NotFoundException(appError('INVITATION_NOT_FOUND'));
    }

    if (invitation.status !== WorkspaceInvitationStatus.PENDING) {
      return { message: 'Invitation is already inactive' };
    }

    invitation.status = WorkspaceInvitationStatus.CANCELLED;
    await this.invitationRepository.save(invitation);

    await this.recordMemberAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: requestingUserId,
      entityType: EntityType.WORKSPACE_MEMBER,
      entityId: invitation.id,
      action: AuditAction.DELETE,
      meta: { email: invitation.email },
    });

    return { message: 'Invitation revoked' };
  }

  async removeMember(workspaceId: string, requestingUserId: string, targetUserId: string) {
    const currentMembership = await this.requireAdminMembership(workspaceId, requestingUserId);

    if (!targetUserId || targetUserId.trim().length === 0) {
      throw new BadRequestException(appError('USER_INVALID'));
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    const member = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId: targetUserId },
      relations: ['user'],
    });

    if (!member) {
      throw new NotFoundException(appError('MEMBER_NOT_FOUND'));
    }

    if (member.role === WorkspaceRole.OWNER || member.userId === workspace.ownerId) {
      throw new ForbiddenException(appError('MEMBER_CANNOT_REMOVE_OWNER'));
    }

    if (currentMembership.role === WorkspaceRole.ADMIN && member.role === WorkspaceRole.ADMIN) {
      throw new ForbiddenException(appError('WORKSPACE_ONLY_OWNER_CAN_MANAGE_ADMINS'));
    }

    await this.workspaceMemberRepository.delete(member.id);

    if (member.user?.workspaceId === workspaceId) {
      await this.userRepository.update(member.userId, { workspaceId: null });
    }

    // Audit: record member removal from workspace.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: requestingUserId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.UNLINK,
      meta: {
        memberId: targetUserId,
        role: member.role,
      },
    });

    return { message: 'Member access revoked' };
  }

  async removeMemberLegacy(currentUser: User, targetUserId: string) {
    const workspace = await this.ensureUserWorkspace(currentUser);
    return this.removeMember(workspace.id, currentUser.id, targetUserId);
  }

  async inviteMember(
    workspaceId: string,
    currentUser: User,
    dto: InviteMemberDto,
    requestAppOrigin?: string,
  ) {
    await this.requireAdminMembership(workspaceId, currentUser.id);

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    const email = dto.email.trim().toLowerCase();
    const role = dto.role || WorkspaceRole.MEMBER;
    const permissions: WorkspaceMemberPermissions | null =
      role === WorkspaceRole.MEMBER
        ? ((dto.permissions as WorkspaceMemberPermissions | undefined) ?? null)
        : null;

    const existingUser = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'workspaceId'],
    });

    if (existingUser) {
      const existingMembership = await this.workspaceMemberRepository.findOne({
        where: { workspaceId, userId: existingUser.id },
      });

      if (existingMembership) {
        throw new ConflictException(appError('MEMBER_ALREADY_IN_WORKSPACE'));
      }
    }

    const existingInvitation = await this.invitationRepository.findOne({
      where: { workspaceId, email, status: WorkspaceInvitationStatus.PENDING },
    });

    if (existingInvitation) {
      existingInvitation.expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
      existingInvitation.role = role;
      existingInvitation.permissions = permissions;
      existingInvitation.invitedById = currentUser.id;
      existingInvitation.token = randomUUID();
      const updated = await this.invitationRepository.save(existingInvitation);
      await this.auditInvitationCreated(workspaceId, currentUser.id, updated);
      const invitationLink = await this.buildInvitationLink(
        updated.token,
        requestAppOrigin,
        currentUser,
      );
      await this.sendInvitationEmail({
        email,
        workspaceName: workspace.name,
        invitationLink,
        invitedBy: currentUser.name || currentUser.email,
        role,
        user: currentUser,
      });

      this.eventEmitter?.emit('member.invited', {
        workspaceId,
        actorId: currentUser.id,
        actorName: currentUser.name || currentUser.email,
        invitedEmail: email,
        role,
      } satisfies MemberInvitedEvent);

      return { invitation: updated, invitationLink };
    }

    const invitation = this.invitationRepository.create({
      workspaceId,
      email,
      role,
      permissions,
      token: randomUUID(),
      status: WorkspaceInvitationStatus.PENDING,
      invitedById: currentUser.id,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });

    const savedInvitation = await this.invitationRepository.save(invitation);
    await this.auditInvitationCreated(workspaceId, currentUser.id, savedInvitation);
    const invitationLink = await this.buildInvitationLink(
      savedInvitation.token,
      requestAppOrigin,
      currentUser,
    );
    await this.sendInvitationEmail({
      email,
      workspaceName: workspace.name,
      invitationLink,
      invitedBy: currentUser.name || currentUser.email,
      role,
      user: currentUser,
    });

    this.eventEmitter?.emit('member.invited', {
      workspaceId,
      actorId: currentUser.id,
      actorName: currentUser.name || currentUser.email,
      invitedEmail: email,
      role,
    } satisfies MemberInvitedEvent);

    return { invitation: savedInvitation, invitationLink };
  }

  async inviteMemberLegacy(currentUser: User, dto: InviteMemberDto, requestAppOrigin?: string) {
    const workspace = await this.ensureUserWorkspace(currentUser);
    return this.inviteMember(workspace.id, currentUser, dto, requestAppOrigin);
  }

  private async buildInvitationLink(token: string, requestAppOrigin?: string, user?: User) {
    const settingsOrigin = this.normalizeToOrigin(
      (await this.applicationSettingsService?.getAppSettings(user))?.publicUrl,
    );
    const envOrigin = this.normalizeToOrigin(process.env.APP_URL || process.env.FRONTEND_URL);
    const requestOrigin = this.normalizeToOrigin(requestAppOrigin);

    const baseOrigin =
      (settingsOrigin && !this.isLocalhostOrigin(settingsOrigin)
        ? settingsOrigin
        : envOrigin && !this.isLocalhostOrigin(envOrigin)
          ? envOrigin
          : requestOrigin && !this.isLocalhostOrigin(requestOrigin)
            ? requestOrigin
            : settingsOrigin || envOrigin || requestOrigin) || 'http://localhost:3000';

    return `${baseOrigin.replace(/\/$/, '')}/invite/${token}`;
  }

  private normalizeToOrigin(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed);
      const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
      return url.origin;
    } catch {
      return null;
    }
  }

  private isLocalhostOrigin(origin: string): boolean {
    try {
      const { hostname } = new URL(origin);
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    } catch {
      return false;
    }
  }

  async getInvitationInfo(token: string) {
    const trimmedToken = token?.trim();
    if (!trimmedToken) {
      throw new BadRequestException(appError('INVITATION_TOKEN_INVALID'));
    }

    const invitation = await this.invitationRepository.findOne({
      where: { token: trimmedToken },
      relations: ['workspace'],
    });

    if (!invitation) {
      throw new NotFoundException(appError('INVITATION_NOT_FOUND'));
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      if (invitation.status === WorkspaceInvitationStatus.PENDING) {
        invitation.status = WorkspaceInvitationStatus.EXPIRED;
        await this.invitationRepository.save(invitation);
      }
    }

    const workspace =
      invitation.workspace ||
      (await this.workspaceRepository.findOne({
        where: { id: invitation.workspaceId },
      }));

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    return {
      status: invitation.status,
      email: invitation.email,
      workspace: {
        id: workspace.id,
        name: workspace.name,
      },
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async acceptInvitation(currentUser: User, token: string) {
    const trimmedToken = token?.trim();
    if (!trimmedToken) {
      throw new BadRequestException(appError('INVITATION_TOKEN_INVALID'));
    }

    const invitation = await this.invitationRepository.findOne({
      where: { token: trimmedToken },
    });

    if (!invitation) {
      throw new NotFoundException(appError('INVITATION_NOT_FOUND_OR_USED'));
    }

    const currentUserEmail = currentUser.email.trim().toLowerCase();
    const expectedEmail = invitation.email.trim().toLowerCase();

    if (currentUserEmail !== expectedEmail) {
      throw new ForbiddenException(appError('INVITATION_WRONG_ACCOUNT', { email: expectedEmail }));
    }

    if (
      invitation.status === WorkspaceInvitationStatus.PENDING &&
      invitation.expiresAt &&
      invitation.expiresAt.getTime() < Date.now()
    ) {
      invitation.status = WorkspaceInvitationStatus.EXPIRED;
      await this.invitationRepository.save(invitation);
      throw new BadRequestException(appError('INVITATION_EXPIRED'));
    }

    if (invitation.status === WorkspaceInvitationStatus.CANCELLED) {
      throw new BadRequestException(appError('INVITATION_REVOKED'));
    }

    if (
      ![WorkspaceInvitationStatus.PENDING, WorkspaceInvitationStatus.ACCEPTED].includes(
        invitation.status,
      )
    ) {
      throw new BadRequestException(appError('INVITATION_UNAVAILABLE'));
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: invitation.workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    const existingMembership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId: workspace.id, userId: currentUser.id },
    });

    let memberAdded = false;
    if (!existingMembership) {
      await this.workspaceMemberRepository.save({
        workspaceId: workspace.id,
        userId: currentUser.id,
        role: invitation.role,
        permissions: invitation.role === WorkspaceRole.MEMBER ? invitation.permissions : null,
        invitedById: invitation.invitedById,
      });
      memberAdded = true;
    }

    // Only fill in a home workspace the user does not have yet. Overwriting it
    // on every accepted invitation moved the user's default tenant into whoever
    // invited them last, which is how data scoped through it changed hands.
    // Membership is what grants access; `lastWorkspaceId` tracks the active one.
    if (!currentUser.workspaceId) {
      await this.userRepository.update(currentUser.id, { workspaceId: workspace.id });
    }

    if (invitation.status === WorkspaceInvitationStatus.PENDING) {
      invitation.status = WorkspaceInvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await this.invitationRepository.save(invitation);
    }

    if (memberAdded) {
      // Audit: record member linkage after accepting invitation.
      await this.auditService.createEvent({
        workspaceId: workspace.id,
        actorType: ActorType.USER,
        actorId: currentUser.id,
        entityType: EntityType.WORKSPACE,
        entityId: workspace.id,
        action: AuditAction.LINK,
        meta: {
          memberId: currentUser.id,
          role: invitation.role,
        },
      });

      this.eventEmitter?.emit('member.joined', {
        workspaceId: workspace.id,
        memberId: currentUser.id,
        memberName: currentUser.name || currentUser.email,
      } satisfies MemberJoinedEvent);
    }

    return {
      message: 'Invitation accepted. You are now a member of the workspace.',
      workspaceId: workspace.id,
    };
  }

  async getUserWorkspaces(userId: string): Promise<WorkspaceResponseDto[]> {
    const memberships = await this.workspaceMemberRepository.find({
      where: { userId },
      relations: ['workspace'],
      order: { lastAccessedAt: 'DESC' },
    });

    const workspaces = await Promise.all(
      memberships.map(async membership => {
        const workspace = membership.workspace;
        const stats = await this.getWorkspaceStats(workspace.id);

        return {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          icon: workspace.icon,
          color: workspace.color,
          backgroundImage: workspace.backgroundImage,
          currency: workspace.currency,
          isFavorite: workspace.isFavorite,
          settings: workspace.settings,
          ownerId: workspace.ownerId,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          memberRole: membership.role,
          memberPermissions: membership.permissions,
          stats,
        };
      }),
    );

    return workspaces;
  }

  async getWorkspaceById(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto | null> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      relations: ['workspace'],
    });

    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }

    const workspace = membership.workspace;
    const stats = await this.getWorkspaceStats(workspace.id);

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      icon: workspace.icon,
      color: workspace.color,
      backgroundImage: workspace.backgroundImage,
      currency: workspace.currency,
      isFavorite: workspace.isFavorite,
      settings: workspace.settings,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      memberRole: membership.role,
      memberPermissions: membership.permissions,
      stats,
    };
  }

  async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceResponseDto> {
    const workspace = this.workspaceRepository.create({
      name: dto.name,
      description: dto.description || null,
      icon: dto.icon || null,
      color: dto.color || null,
      backgroundImage: dto.backgroundImage || null,
      currency: currencyCodeOrDefault(dto.currency),
      ownerId: userId,
      settings: dto.profile ? mergeWorkspaceProfile(null, dto.profile) : null,
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    await this.workspaceMemberRepository.save({
      workspaceId: savedWorkspace.id,
      userId,
      role: WorkspaceRole.OWNER,
      invitedById: userId,
      lastAccessedAt: new Date(),
      accessCount: 1,
    });

    await this.userRepository.update(userId, { lastWorkspaceId: savedWorkspace.id });
    await this.categoriesService.createSystemCategories(savedWorkspace.id, userId);
    await this.taxRatesService.createDefaultTaxRates(savedWorkspace.id);
    await this.balanceService.seedDefaultAccounts(savedWorkspace.id);

    const stats = await this.getWorkspaceStats(savedWorkspace.id);

    // Audit: record workspace creation.
    await this.auditService.createEvent({
      workspaceId: savedWorkspace.id,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: savedWorkspace.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: savedWorkspace },
    });

    return {
      id: savedWorkspace.id,
      name: savedWorkspace.name,
      description: savedWorkspace.description,
      icon: savedWorkspace.icon,
      color: savedWorkspace.color,
      backgroundImage: savedWorkspace.backgroundImage,
      currency: savedWorkspace.currency,
      isFavorite: savedWorkspace.isFavorite,
      settings: savedWorkspace.settings,
      ownerId: savedWorkspace.ownerId,
      createdAt: savedWorkspace.createdAt,
      updatedAt: savedWorkspace.updatedAt,
      memberRole: WorkspaceRole.OWNER,
      memberPermissions: null,
      stats,
    };
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }

    if (![WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(membership.role)) {
      throw new ForbiddenException(appError('WORKSPACE_ADMIN_REQUIRED_TO_EDIT_SETTINGS'));
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    const before = { ...workspace };
    const changedFields = Object.keys(dto).filter(
      key => (dto as Record<string, unknown>)[key] !== undefined,
    );
    Object.assign(workspace, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.icon !== undefined && { icon: dto.icon }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.backgroundImage !== undefined && { backgroundImage: dto.backgroundImage }),
      ...(dto.currency !== undefined && {
        currency: currencyCodeOrDefault(dto.currency, workspace.currency),
      }),
      ...(dto.isFavorite !== undefined && { isFavorite: dto.isFavorite }),
      // Merged, not replaced: `settings` is a shared blob.
      ...(dto.processing !== undefined && {
        settings: mergeProcessingSettings(workspace.settings, dto.processing),
      }),
    });
    if (dto.profile !== undefined) {
      workspace.settings = mergeWorkspaceProfile(workspace.settings, dto.profile);
    }

    const updated = await this.workspaceRepository.save(workspace);
    const stats = await this.getWorkspaceStats(updated.id);

    // Audit: record workspace updates for traceability and rollback.
    await this.auditService.createEvent({
      workspaceId: updated.id,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: updated.id,
      action: AuditAction.UPDATE,
      diff: { before, after: updated },
      isUndoable: true,
    });

    this.eventEmitter?.emit('workspace.updated', {
      workspaceId: updated.id,
      actorId: userId,
      actorName: await this.resolveActorName(userId),
      changedFields,
    } satisfies WorkspaceUpdatedEvent);

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      icon: updated.icon,
      color: updated.color,
      backgroundImage: updated.backgroundImage,
      currency: updated.currency,
      isFavorite: updated.isFavorite,
      settings: updated.settings,
      ownerId: updated.ownerId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      memberRole: membership.role,
      memberPermissions: membership.permissions,
      stats,
    };
  }

  async switchWorkspace(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }

    await this.userRepository.update(userId, { lastWorkspaceId: workspaceId });

    await this.workspaceMemberRepository.update(membership.id, {
      lastAccessedAt: new Date(),
      accessCount: membership.accessCount + 1,
    });
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    if (workspace.ownerId !== userId) {
      throw new ForbiddenException(appError('WORKSPACE_ONLY_OWNER_CAN_DELETE'));
    }

    // Аудит пишем ДО удаления: после remove воркспейса уже нет, и createEvent
    // отверг бы событие. FK SET NULL обнулит workspace_id, само событие останется.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.WORKSPACE,
      entityId: workspaceId,
      action: AuditAction.DELETE,
      diff: { before: workspace, after: null },
      isUndoable: true,
    });

    await this.workspaceRepository.remove(workspace);
  }

  async toggleFavorite(workspaceId: string, userId: string): Promise<{ isFavorite: boolean }> {
    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
    });

    if (!membership) {
      throw new ForbiddenException(appError('WORKSPACE_NOT_A_MEMBER'));
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(appError('WORKSPACE_NOT_FOUND'));
    }

    workspace.isFavorite = !workspace.isFavorite;
    const updated = await this.workspaceRepository.save(workspace);

    return { isFavorite: updated.isFavorite };
  }

  async getWorkspaceStats(workspaceId: string): Promise<WorkspaceStatsDto> {
    const integrationCount = await this.integrationRepository.count({
      where: { workspaceId: workspaceId },
    });

    const memberCount = await this.workspaceMemberRepository.count({
      where: { workspaceId },
    });

    const recentMembership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId },
      order: { lastAccessedAt: 'DESC' },
    });

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentActivity =
      recentMembership?.lastAccessedAt && recentMembership.lastAccessedAt > twentyFourHoursAgo;

    return {
      integrationCount,
      memberCount,
      recentActivity: !!recentActivity,
      lastAccessedAt: recentMembership?.lastAccessedAt || null,
    };
  }

  private async sendInvitationEmail(params: {
    email: string;
    workspaceName: string;
    invitationLink: string;
    invitedBy?: string | null;
    role?: WorkspaceRole | null;
    user?: User;
  }) {
    const smtp = await this.applicationSettingsService?.getSmtpSettings(params.user);
    // The invitee usually has no account yet, so the inviter's locale is the
    // only signal we have for which language to write in.
    const locale = params.user?.locale ?? 'en';
    const smtpHost = smtp?.host || process.env.SMTP_HOST;
    const smtpPort = smtp?.port || Number.parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpFrom = smtp?.from || process.env.SMTP_FROM;

    if (!(smtpHost && smtpFrom)) {
      console.warn(
        `[Workspaces] SMTP is not configured (SMTP_HOST and SMTP_FROM are required); invitation link for ${params.email}: ${params.invitationLink}`,
      );
      return;
    }

    const { WorkspaceInvitationEmail, workspaceInvitationEmailText } = await import(
      '../../emails/workspace-invitation.email'
    );

    const emailReact = React.createElement(WorkspaceInvitationEmail, {
      workspaceName: params.workspaceName,
      invitationLink: params.invitationLink,
      invitedBy: params.invitedBy,
      roleLabel: params.role ? renderInvitation(locale, invitationRoleKey(params.role)) : null,
      locale,
    });

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number.isFinite(smtpPort) ? smtpPort : 587,
      secure: smtp?.secure ?? process.env.SMTP_SECURE === 'true',
      auth:
        (smtp?.user && smtp?.pass) || (process.env.SMTP_USER && process.env.SMTP_PASS)
          ? {
              user: smtp?.user || process.env.SMTP_USER,
              pass: smtp?.pass || process.env.SMTP_PASS,
            }
          : undefined,
    });

    try {
      const html = await render(emailReact);
      const timeoutMs =
        smtp?.timeoutMs || Number.parseInt(process.env.SMTP_TIMEOUT_MS || '10000', 10);

      await retry(
        () =>
          withTimeout(
            transporter.sendMail({
              from: smtpFrom,
              to: params.email,
              subject: renderInvitation(locale, 'subject', { workspace: params.workspaceName }),
              html,
              text: workspaceInvitationEmailText({
                workspaceName: params.workspaceName,
                invitationLink: params.invitationLink,
                invitedBy: params.invitedBy,
                roleLabel: params.role
                  ? renderInvitation(locale, invitationRoleKey(params.role))
                  : null,
                locale,
              }),
              replyTo: smtp?.replyTo || process.env.SMTP_REPLY_TO || undefined,
            }),
            Number.isFinite(timeoutMs) ? timeoutMs : 10000,
            'SMTP request timed out',
          ),
        {
          retries: 1,
          baseDelayMs: 300,
          maxDelayMs: 2000,
          isRetryable: err => err instanceof TimeoutError,
        },
      );
    } catch (error) {
      console.warn(
        '[Workspaces] Failed to send the invitation email over SMTP:',
        (error as Error)?.message,
      );
    }
  }
}
