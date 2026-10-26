import { Controller, Delete, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { CreateRowCommentBody, MessageResult, SetCommentResolvedBody } from '../../contracts';
import {
  RowCommentCounts,
  RowCommentItem,
  RowCommentList,
} from '../../contracts/custom-tables/custom-table-collab';
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
  @SchemaResponse(RowCommentList)
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
  @SchemaResponse(RowCommentItem)
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
  @SchemaResponse(RowCommentCounts)
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
  @SchemaResponse(RowCommentItem)
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
  @SchemaResponse(MessageResult)
  async deleteComment(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(CustomTableCommentParams) { commentId }: CustomTableCommentParams,
  ) {
    await this.commentsService.deleteComment(user.id, workspaceId, commentId);
    return { message: 'Comment deleted' };
  }
}
