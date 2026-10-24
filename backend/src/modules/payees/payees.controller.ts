import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  MergePayeesBody,
  Payee,
  PayeeChangeResult,
  PayeeDuplicateGroups,
  PayeePeers,
  PayeePendingReview,
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
import { PayeesService } from './payees.service';
import { PayeesOverviewService } from './payees-overview.service';

@Controller()
export class PayeesController {
  constructor(
    private readonly payeesService: PayeesService,
    private readonly overviewService: PayeesOverviewService,
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.overviewService.summary(workspaceId, id, selfMemberId);
  }

  @Get('payees/:id/peers')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(PayeePeers)
  async peers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.overviewService.peers(workspaceId, id, selfMemberId);
  }

  @Post('payees/:id/apply-category')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeChangeResult)
  async applyCategory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.applyCategory(workspaceId, user.id, id);
  }

  @Delete('payees/:id/aliases/:key')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PayeeChangeResult)
  async splitAlias(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('key') key: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.payeesService.splitAlias(workspaceId, user.id, id, key);
  }

  @Get('payees/:id')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(Payee)
  async get(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.payeesService.get(workspaceId, id, selfMemberId);
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
