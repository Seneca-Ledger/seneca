import { Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  MergePayeesBody,
  Payee,
  PayeeMerge,
  PayeeParams,
  PayeePendingReview,
  PayeePendingReviewQuery,
  PayeeRecord,
  PayeesPage,
  PayeesQuery,
  SetTransactionPayeeBody,
  TransactionPayeeResult,
  UpdatePayeeBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PayeesService } from './payees.service';

@Controller()
export class PayeesController {
  constructor(private readonly payeesService: PayeesService) {}

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
