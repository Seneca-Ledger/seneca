import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { deletedResponse } from '../../common/utils/responses.util';
import type { User } from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberPermissionsDto } from './dto/update-member-permissions.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  private getRequestAppOrigin(req: Request): string | undefined {
    const originHeader = req.headers.origin;
    if (typeof originHeader === 'string' && originHeader.trim().length > 0) {
      return originHeader;
    }

    const refererHeader = req.headers.referer;
    if (typeof refererHeader === 'string' && refererHeader.trim().length > 0) {
      try {
        return new URL(refererHeader).origin;
      } catch {
        // ignore
      }
    }

    const forwardedHost = req.headers['x-forwarded-host'];
    const host =
      (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
    if (typeof host === 'string' && host.trim().length > 0) {
      const forwardedProto = req.headers['x-forwarded-proto'];
      const protoRaw = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
      const proto = typeof protoRaw === 'string' && protoRaw.length > 0 ? protoRaw : 'https';
      return `${proto}://${host}`;
    }

    return undefined;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserWorkspaces(@CurrentUser() user: User) {
    return this.workspacesService.getUserWorkspaces(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyWorkspace(@CurrentUser() user: User, @Req() req: Request) {
    return this.workspacesService.getWorkspaceOverview(user, this.getRequestAppOrigin(req));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getWorkspaceById(@CurrentUser() user: User, @Param('id') id: string) {
    const workspace = await this.workspacesService.getWorkspaceById(id, user.id);
    const members = await this.workspacesService.getWorkspaceMembers(id, user.id);
    return {
      ...workspace,
      members,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createWorkspace(@CurrentUser() user: User, @Body() dto: CreateWorkspaceDto) {
    return this.workspacesService.createWorkspace(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateWorkspace(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.updateWorkspace(id, user.id, dto);
  }

  @Post(':id/switch')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async switchWorkspace(@CurrentUser() user: User, @Param('id') id: string) {
    await this.workspacesService.switchWorkspace(id, user.id);
    return { message: 'Workspace switched successfully' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteWorkspace(@CurrentUser() user: User, @Param('id') id: string) {
    await this.workspacesService.deleteWorkspace(id, user.id);
    return deletedResponse('Workspace');
  }

  @Patch(':id/favorite')
  @UseGuards(JwtAuthGuard)
  async toggleFavorite(@CurrentUser() user: User, @Param('id') id: string) {
    return this.workspacesService.toggleFavorite(id, user.id);
  }

  @Get(':id/invitations')
  @UseGuards(JwtAuthGuard)
  async getWorkspaceInvitations(@CurrentUser() user: User, @Param('id') workspaceId: string) {
    return this.workspacesService.getWorkspaceInvitations(workspaceId, user.id);
  }

  @Post(':id/invitations')
  @UseGuards(JwtAuthGuard)
  async inviteMemberToWorkspace(
    @CurrentUser() user: User,
    @Param('id') workspaceId: string,
    @Body() dto: InviteMemberDto,
    @Req() req: Request,
  ) {
    return this.workspacesService.inviteMember(
      workspaceId,
      user,
      dto,
      this.getRequestAppOrigin(req),
    );
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeWorkspaceMember(
    @CurrentUser() user: User,
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return this.workspacesService.removeMember(workspaceId, user.id, userId);
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(JwtAuthGuard)
  async updateWorkspaceMemberRole(
    @CurrentUser() user: User,
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspacesService.updateMemberRole(workspaceId, user.id, userId, dto.role);
  }

  @Patch(':id/members/:userId/permissions')
  @UseGuards(JwtAuthGuard)
  async updateWorkspaceMemberPermissions(
    @CurrentUser() user: User,
    @Param('id') workspaceId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberPermissionsDto,
  ) {
    return this.workspacesService.updateMemberPermissions(
      workspaceId,
      user.id,
      userId,
      dto.permissions,
    );
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(JwtAuthGuard)
  async revokeWorkspaceInvitation(
    @CurrentUser() user: User,
    @Param('id') workspaceId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.workspacesService.cancelInvitation(workspaceId, user.id, invitationId);
  }

  @Post('invitations')
  @UseGuards(JwtAuthGuard)
  async inviteMember(@CurrentUser() user: User, @Body() dto: InviteMemberDto, @Req() req: Request) {
    return this.workspacesService.inviteMemberLegacy(user, dto, this.getRequestAppOrigin(req));
  }

  @Delete('members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeMember(@CurrentUser() user: User, @Param('userId') userId: string) {
    return this.workspacesService.removeMemberLegacy(user, userId);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @Get('invitations/:token')
  async getInvitation(@Param('token') token: string) {
    return this.workspacesService.getInvitationInfo(token);
  }

  @Post('invitations/:token/accept')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(@CurrentUser() user: User, @Param('token') token: string) {
    return this.workspacesService.acceptInvitation(user, token);
  }

  @Post('invitations/accept')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async acceptInvitationLegacy(@CurrentUser() user: User, @Body() dto: AcceptInvitationDto) {
    return this.workspacesService.acceptInvitation(user, dto.token);
  }
}
