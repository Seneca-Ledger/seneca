import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { parseReviewerFilter } from '../../common/utils/transaction-owner.util';
import {
  ApproveTransactionsBody,
  ResolveDuplicateBody,
  ReviewApproved,
  ReviewDuplicateParams,
  ReviewInboxByStatement,
  ReviewInboxCounts,
  ReviewInboxCountsQuery,
  ReviewInboxPage,
  ReviewInboxQuery,
  StatementApproved,
  StatementParams,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DuplicateDecision } from './dto/review-inbox.dto';
import { ReviewInboxService } from './review-inbox.service';

@Controller('review-inbox')
export class ReviewInboxController {
  constructor(private readonly reviewInboxService: ReviewInboxService) {}

  @Get()
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(ReviewInboxPage)
  async list(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ReviewInboxQuery) query: ReviewInboxQuery,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reviewInboxService.list(workspaceId, query, selfMemberId);
  }

  @Get('counts')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(ReviewInboxCounts)
  async counts(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ReviewInboxCountsQuery) { reviewer }: ReviewInboxCountsQuery,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reviewInboxService.counts(workspaceId, parseReviewerFilter(reviewer, selfMemberId));
  }

  /** Rows each statement still has in the inbox, keyed by statement id; finished ones are absent. */
  @Get('statements')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(ReviewInboxByStatement)
  async pendingByStatement(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reviewInboxService.pendingByStatement(workspaceId);
  }

  /** Confirms every categorised row of one statement; answers how many still lack a category. */
  @Post('statements/:id/approve')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(StatementApproved)
  async approveStatement(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.reviewInboxService.approveStatement(workspaceId, user.id, id);
  }

  @Post('transactions/approve')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(ReviewApproved)
  async approveTransactions(
    @SchemaBody(ApproveTransactionsBody) body: ApproveTransactionsBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.reviewInboxService.approveTransactions(
      workspaceId,
      user.id,
      body.ids,
      body.categoryId ?? undefined,
    );
  }

  @Post('duplicates/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async resolveDuplicate(
    @SchemaParams(ReviewDuplicateParams) { id }: ReviewDuplicateParams,
    @SchemaBody(ResolveDuplicateBody) body: ResolveDuplicateBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.reviewInboxService.resolveDuplicate(
      workspaceId,
      id,
      toEnum(DuplicateDecision, body.decision),
    );
  }
}
