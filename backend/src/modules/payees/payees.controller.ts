import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  MergePayeesBody,
  PayeePendingReview,
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
  async list(@WorkspaceId() workspaceId: string, @SchemaQuery(PayeesQuery) query: PayeesQuery) {
    return this.payeesService.list(workspaceId, query);
  }

  @Patch('payees/:id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeRecord)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(UpdatePayeeBody) body: UpdatePayeeBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.update(workspaceId, user.id, id, body);
  }

  /** Asks the EU's VIES again whether the payee's VAT number is valid. */
  @Post('payees/:id/vat-check')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async recheckVatId(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.recheckVatId(workspaceId, id);
  }

  /** Folds `sourceIds` into this payee. */
  @Post('payees/:id/merge')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async merge(
    @Param('id', new ParseUUIDPipe()) id: string,
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('excludeTransactionId', new ParseUUIDPipe({ optional: true }))
    excludeTransactionId: string | undefined,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.pendingReview(workspaceId, id, excludeTransactionId);
  }

  @Put('transactions/:id/payee')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionPayeeResult)
  async setTransactionPayee(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(SetTransactionPayeeBody) body: SetTransactionPayeeBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.setTransactionPayee(workspaceId, user.id, id, body);
  }
}
