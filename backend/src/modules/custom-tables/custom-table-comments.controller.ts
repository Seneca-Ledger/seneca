import { Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { CreateRowCommentBody, SetCommentResolvedBody } from '../../contracts';
import {
  CustomTableCommentParams,
  CustomTableParams,
  CustomTableRowParams,
} from '../../contracts/requests/custom-table-queries';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CustomTableCommentsService } from './custom-table-comments.service';

@Controller('custom-tables')
@UseGuards(JwtAuthGuard)
export class CustomTableCommentsController {
  constructor(private readonly commentsService: CustomTableCommentsService) {}

  @Get(':id/rows/:rowId/comments')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async listComments(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableRowParams) { id: tableId, rowId }: CustomTableRowParams,
  ) {
    const items = await this.commentsService.listComments(workspaceId, tableId, rowId);
    return { items };
  }

  @Post(':id/rows/:rowId/comments')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async addComment(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableRowParams) { id: tableId, rowId }: CustomTableRowParams,
    @SchemaBody(CreateRowCommentBody) dto: CreateRowCommentBody,
  ) {
    return this.commentsService.addComment(user.id, workspaceId, tableId, rowId, dto.body);
  }

  @Get(':id/comment-counts')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async countComments(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableParams) { id: tableId }: CustomTableParams,
  ) {
    const counts = await this.commentsService.countOpenByRow(workspaceId, tableId);
    return { counts };
  }

  @Patch(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async setResolved(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableCommentParams) { commentId }: CustomTableCommentParams,
    @SchemaBody(SetCommentResolvedBody) dto: SetCommentResolvedBody,
  ) {
    return this.commentsService.setResolved(user.id, workspaceId, commentId, dto.resolved);
  }

  @Delete(':id/comments/:commentId')
  @UseGuards(JwtAuthGuard, WorkspaceContextGuard)
  async deleteComment(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableCommentParams) { commentId }: CustomTableCommentParams,
  ) {
    await this.commentsService.deleteComment(user.id, workspaceId, commentId);
    return { message: 'Comment deleted' };
  }
}
