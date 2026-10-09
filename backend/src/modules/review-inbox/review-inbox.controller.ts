import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { parseReviewerFilter } from '../../common/utils/transaction-owner.util';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ApproveTransactionsDto,
  ResolveDuplicateDto,
  ReviewInboxQueryDto,
} from './dto/review-inbox.dto';
import { ReviewInboxService } from './review-inbox.service';

@Controller('review-inbox')
export class ReviewInboxController {
  constructor(private readonly reviewInboxService: ReviewInboxService) {}

  @Get()
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async list(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query() query: ReviewInboxQueryDto,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reviewInboxService.list(workspaceId, query, selfMemberId);
  }

  @Get('counts')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async counts(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('reviewer') reviewer: string | undefined,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reviewInboxService.counts(workspaceId, parseReviewerFilter(reviewer, selfMemberId));
  }

  /** Rows each statement still has in the inbox, keyed by statement id; finished ones are absent. */
  @Get('statements')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async pendingByStatement(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reviewInboxService.pendingByStatement(workspaceId);
  }

  /** Confirms every categorised row of one statement; answers how many still lack a category. */
  @Post('statements/:id/approve')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async approveStatement(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.reviewInboxService.approveStatement(workspaceId, user.id, id);
  }

  @Post('transactions/approve')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async approveTransactions(
    @Body() body: ApproveTransactionsDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.reviewInboxService.approveTransactions(
      workspaceId,
      user.id,
      body.ids,
      body.categoryId,
    );
  }

  @Post('duplicates/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async resolveDuplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResolveDuplicateDto,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.reviewInboxService.resolveDuplicate(workspaceId, id, body.decision);
  }
}
