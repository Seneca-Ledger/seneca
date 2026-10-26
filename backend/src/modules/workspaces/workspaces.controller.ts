import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { withoutNulls } from '../../common/effect/without-nulls';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  AcceptInvitationBody,
  CreateDemoWorkspaceBody,
  CreateWorkspaceBody,
  CurrentWorkspaceMemberParams,
  InvitationAccepted,
  InvitationPreview,
  InvitationSent,
  InvitationTokenParams,
  InviteMemberBody,
  MemberPermissionsUpdated,
  MemberRoleUpdated,
  MessageResult,
  UpdateMemberPermissionsBody,
  UpdateMemberRoleBody,
  UpdateWorkspaceBody,
  WorkspaceDetail,
  WorkspaceFavorite,
  WorkspaceIdParams,
  WorkspaceInvitationList,
  WorkspaceInvitationParams,
  WorkspaceList,
  WorkspaceMemberParams,
  WorkspaceOverview,
  WorkspaceSummary,
} from '../../contracts';
import type { User } from '../../entities';
import { WorkspaceRole } from '../../entities/workspace-member.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { DemoWorkspaceService } from './demo-workspace/demo-workspace.service';
import { requestAppOrigin } from './request-app-origin.util';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly demoWorkspaceService: DemoWorkspaceService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceList)
  async getUserWorkspaces(@CurrentUser() user: User) {
    return this.workspacesService.getUserWorkspaces(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceOverview)
  async getMyWorkspace(@CurrentUser() user: User, @Req() req: Request) {
    return this.workspacesService.getWorkspaceOverview(user, requestAppOrigin(req));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceDetail)
  async getWorkspaceById(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id }: WorkspaceIdParams,
  ) {
    const workspace = await this.workspacesService.getWorkspaceById(id, user.id);
    const members = await this.workspacesService.getWorkspaceMembers(id, user.id);
    return {
      ...workspace,
      members,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceSummary)
  async createWorkspace(
    @CurrentUser() user: User,
    @SchemaBody(CreateWorkspaceBody) dto: CreateWorkspaceBody,
  ) {
    return this.workspacesService.createWorkspace(user.id, dto);
  }

  /** The caller's demo workspace with sample data: 201 when made now, 200 when it already was. */
  @Post('demo')
  @UseGuards(JwtAuthGuard)
  // Each first call writes a year of data; deleting and asking again is the only way to repeat it.
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 per minute
  @SchemaResponse(WorkspaceSummary)
  async createDemoWorkspace(
    @CurrentUser() user: User,
    @SchemaBody(CreateDemoWorkspaceBody) dto: CreateDemoWorkspaceBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { workspace, created } = await this.demoWorkspaceService.getOrCreate(user.id, dto.name);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return workspace;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceSummary)
  async updateWorkspace(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id }: WorkspaceIdParams,
    @SchemaBody(UpdateWorkspaceBody) dto: UpdateWorkspaceBody,
  ) {
    return this.workspacesService.updateWorkspace(id, user.id, dto);
  }

  @Post(':id/switch')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MessageResult)
  @HttpCode(HttpStatus.OK)
  async switchWorkspace(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id }: WorkspaceIdParams,
  ) {
    await this.workspacesService.switchWorkspace(id, user.id);
    return { message: 'Workspace switched successfully' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MessageResult)
  async deleteWorkspace(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id }: WorkspaceIdParams,
  ) {
    await this.workspacesService.deleteWorkspace(id, user.id);
    return deletedResponse('Workspace');
  }

  @Patch(':id/favorite')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceFavorite)
  async toggleFavorite(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id }: WorkspaceIdParams,
  ) {
    return this.workspacesService.toggleFavorite(id, user.id);
  }

  @Get(':id/invitations')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(WorkspaceInvitationList)
  async getWorkspaceInvitations(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id: workspaceId }: WorkspaceIdParams,
  ) {
    return this.workspacesService.getWorkspaceInvitations(workspaceId, user.id);
  }

  @Post(':id/invitations')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(InvitationSent)
  async inviteMemberToWorkspace(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceIdParams) { id: workspaceId }: WorkspaceIdParams,
    @SchemaBody(InviteMemberBody) dto: InviteMemberBody,
    @Req() req: Request,
  ) {
    return this.workspacesService.inviteMember(workspaceId, user, dto, requestAppOrigin(req));
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MessageResult)
  async removeWorkspaceMember(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceMemberParams) { id: workspaceId, userId }: WorkspaceMemberParams,
  ) {
    return this.workspacesService.removeMember(workspaceId, user.id, userId);
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MemberRoleUpdated)
  async updateWorkspaceMemberRole(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceMemberParams) { id: workspaceId, userId }: WorkspaceMemberParams,
    @SchemaBody(UpdateMemberRoleBody) dto: UpdateMemberRoleBody,
  ) {
    return this.workspacesService.updateMemberRole(
      workspaceId,
      user.id,
      userId,
      toEnum(WorkspaceRole, dto.role),
    );
  }

  @Patch(':id/members/:userId/permissions')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MemberPermissionsUpdated)
  async updateWorkspaceMemberPermissions(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceMemberParams) { id: workspaceId, userId }: WorkspaceMemberParams,
    @SchemaBody(UpdateMemberPermissionsBody) dto: UpdateMemberPermissionsBody,
  ) {
    return this.workspacesService.updateMemberPermissions(
      workspaceId,
      user.id,
      userId,
      withoutNulls(dto.permissions),
    );
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MessageResult)
  async revokeWorkspaceInvitation(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceInvitationParams)
    { id: workspaceId, invitationId }: WorkspaceInvitationParams,
  ) {
    return this.workspacesService.cancelInvitation(workspaceId, user.id, invitationId);
  }

  @Post('invitations')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(InvitationSent)
  async inviteMember(
    @CurrentUser() user: User,
    @SchemaBody(InviteMemberBody) dto: InviteMemberBody,
    @Req() req: Request,
  ) {
    return this.workspacesService.inviteMemberLegacy(user, dto, requestAppOrigin(req));
  }

  @Delete('members/:userId')
  @UseGuards(JwtAuthGuard)
  @SchemaResponse(MessageResult)
  async removeMember(
    @CurrentUser() user: User,
    @SchemaParams(CurrentWorkspaceMemberParams) { userId }: CurrentWorkspaceMemberParams,
  ) {
    return this.workspacesService.removeMemberLegacy(user, userId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @Get('invitations/:token')
  @SchemaResponse(InvitationPreview)
  async getInvitation(@SchemaParams(InvitationTokenParams) { token }: InvitationTokenParams) {
    return this.workspacesService.getInvitationInfo(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(InvitationAccepted)
  async acceptInvitation(
    @CurrentUser() user: User,
    @SchemaParams(InvitationTokenParams) { token }: InvitationTokenParams,
  ) {
    return this.workspacesService.acceptInvitation(user, token);
  }

  @Post('invitations/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @SchemaResponse(InvitationAccepted)
  async acceptInvitationLegacy(
    @CurrentUser() user: User,
    @SchemaBody(AcceptInvitationBody) dto: AcceptInvitationBody,
  ) {
    return this.workspacesService.acceptInvitation(user, dto.token);
  }
}
