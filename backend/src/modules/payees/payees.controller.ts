import { Controller, Delete, Get, Patch, Post, Put } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  MergePayeesBody,
  Payee,
  PayeeAliasParams,
  PayeeChangeResult,
  PayeeDuplicateGroups,
  PayeeMerge,
  PayeeParams,
  PayeePeers,
  PayeePendingReview,
  PayeePendingReviewQuery,
  PayeeRecord,
  PayeeSummary,
  PayeesOverview,
  PayeesOverviewQuery,
  PayeesPage,
  PayeesQuery,
  SetTransactionPayeeBody,
  TransactionPayeeResult,
  UpdatePayeeBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PayeeEditsService } from './payee-edits.service';
import { PayeePeersService } from './payee-peers.service';
import { PayeesService } from './payees.service';
import { PayeesOverviewService } from './payees-overview.service';

@Controller()
export class PayeesController {
  constructor(
    private readonly payeesService: PayeesService,
    private readonly overviewService: PayeesOverviewService,
    private readonly editsService: PayeeEditsService,
    private readonly peersService: PayeePeersService,
  ) {}

  @Get('payees')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeesPage)
  async list(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(PayeesQuery) query: PayeesQuery,
  ) {
    return this.payeesService.list(workspaceId, query, selfMemberId);
  }

  @Get('payees/overview')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeesOverview)
  async overview(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(PayeesOverviewQuery) query: PayeesOverviewQuery,
  ) {
    return this.overviewService.overview(workspaceId, query, selfMemberId);
  }

  @Get('payees/duplicates')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeeDuplicateGroups)
  async duplicates(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.overviewService.duplicates(workspaceId, selfMemberId);
  }

  @Get('payees/:id/summary')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeeSummary)
  async summary(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.overviewService.summary(workspaceId, id, selfMemberId);
  }

  @Get('payees/:id/peers')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeePeers)
  async peers(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.peersService.peers(workspaceId, id, selfMemberId);
  }

  @Post('payees/:id/apply-category')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeChangeResult)
  async applyCategory(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.editsService.applyCategory(workspaceId, user.id, id);
  }

  @Delete('payees/:id/aliases/:key')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeChangeResult)
  async splitAlias(
    @SchemaParams(PayeeAliasParams) { id, key }: PayeeAliasParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.editsService.splitAlias(workspaceId, user.id, id, key);
  }

  @Get('payees/:id')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(Payee)
  async get(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.payeesService.get(workspaceId, id, selfMemberId);
  }

  @Patch('payees/:id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeRecord)
  async update(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @SchemaBody(UpdatePayeeBody) body: UpdatePayeeBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.update(workspaceId, user.id, id, body);
  }

  /** Asks the EU's VIES again whether the payee's VAT number is valid. */
  @Post('payees/:id/vat-check')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeRecord)
  async recheckVatId(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.recheckVatId(workspaceId, id);
  }

  /** Folds `sourceIds` into this payee. */
  @Post('payees/:id/merge')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeMerge)
  async merge(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @SchemaBody(MergePayeesBody) body: MergePayeesBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.merge(workspaceId, user.id, id, body);
  }

  /** Rows of this payee in Review whose category nobody chose yet. */
  @Get('payees/:id/pending-review')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeePendingReview)
  async pendingReview(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @SchemaQuery(PayeePendingReviewQuery) query: PayeePendingReviewQuery,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.pendingReview(workspaceId, id, query.excludeTransactionId);
  }

  @Put('transactions/:id/payee')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionPayeeResult)
  async setTransactionPayee(
    @SchemaParams(PayeeParams) { id }: PayeeParams,
    @SchemaBody(SetTransactionPayeeBody) body: SetTransactionPayeeBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.setTransactionPayee(workspaceId, user.id, id, body);
  }
}
