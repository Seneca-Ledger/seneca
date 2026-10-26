import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import {
  DetectTransfersBody,
  LinkReimbursementBody,
  LinkTransferBody,
  TransactionCandidates,
  TransactionParams,
  TransferToAccountBody,
} from '../../contracts';
import {
  PairUnlinked,
  ReimbursementLinked,
  TransferLinked,
  TransfersDetected,
  TransferToAccountResult,
} from '../../contracts/transactions/transaction-record';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransferPairingService } from './services/transfer-pairing.service';
import { TransferToAccountService } from './services/transfer-to-account.service';

/** Transfers between the user's own accounts and reimbursements: the rows paired with each other. */
@Controller('transactions')
export class TransactionPairingController {
  constructor(
    private readonly transferPairingService: TransferPairingService,
    private readonly transferToAccountService: TransferToAccountService,
  ) {}

  /** Pairs the legs of transfers between the user's own accounts and writes them. */
  @Post('transfers/detect')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransfersDetected)
  async detectTransfers(
    @SchemaBody(DetectTransfersBody) body: DetectTransfersBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transferPairingService.detectAndApply(workspaceId, body.statementId ?? undefined);
  }

  @Get(':id/transfer-candidates')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionCandidates)
  async transferCandidates(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const data = await this.transferPairingService.candidates(workspaceId, id);
    return { data: redactPrivateRows(data, selfMemberId) };
  }

  @Post(':id/link-transfer')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransferLinked)
  async linkTransfer(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @SchemaBody(LinkTransferBody) body: LinkTransferBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const transferPairId = await this.transferPairingService.link(workspaceId, id, body.otherId);
    return { transferPairId };
  }

  @Post(':id/transfer-to-account')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransferToAccountResult)
  async transferToAccount(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @SchemaBody(TransferToAccountBody) body: TransferToAccountBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transferToAccountService.transferToAccount(workspaceId, id, body.walletId);
  }

  @Post(':id/unlink-transfer')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PairUnlinked)
  async unlinkTransfer(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transferPairingService.unlink(workspaceId, id);
    return { unlinked: true };
  }

  @Get(':id/reimbursement-candidates')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionCandidates)
  async reimbursementCandidates(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const data = await this.transferPairingService.reimbursementCandidates(workspaceId, id);
    return { data: redactPrivateRows(data, selfMemberId) };
  }

  @Post(':id/link-reimbursement')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(ReimbursementLinked)
  async linkReimbursement(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @SchemaBody(LinkReimbursementBody) body: LinkReimbursementBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transferPairingService.linkReimbursement(workspaceId, id, body.expenseId);
  }

  @Post(':id/unlink-reimbursement')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(PairUnlinked)
  async unlinkReimbursement(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transferPairingService.unlinkReimbursement(workspaceId, id);
    return { unlinked: true };
  }
}
