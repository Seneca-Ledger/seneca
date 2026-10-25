import { BadRequestException, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import {
  ApproveReceiptBody,
  BulkApproveBody,
  ReceiptApproval,
  ReceiptParams,
  UpdateReceiptStageBody,
} from '../../contracts';
import {
  ReceiptBulkApproveResult,
  ReceiptStageResult,
} from '../../contracts/receipts/receipt-documents';
import type { User } from '../../entities';
import { StatementStage } from '../../entities/statement.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReceiptsService } from './receipts.service';
import { ReceiptStageService } from './services/receipt-stage.service';

/** Moving receipts through the review stages and booking them as transactions. */
@Controller('receipts')
export class ReceiptApprovalsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly receiptStageService: ReceiptStageService,
  ) {}

  @Post('stage')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Move one or more receipts between Submit and Approve' })
  @SchemaResponse(ReceiptStageResult)
  async updateStage(
    @SchemaBody(UpdateReceiptStageBody) dto: UpdateReceiptStageBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.receiptStageService.updateStage(
      dto.receiptIds,
      toEnum(StatementStage, dto.stage),
      user.id,
      workspaceId,
    );
  }

  @Post(':id/approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(ReceiptApproval)
  async approve(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @SchemaBody(ApproveReceiptBody) dto: ApproveReceiptBody,
  ) {
    const result = await this.receiptsService.approve(id, workspaceId, user.id, {
      attachTo: dto?.transactionId,
    });
    if (!result) {
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
    }
    return result;
  }

  @Post('bulk-approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(ReceiptBulkApproveResult)
  async bulkApprove(
    @SchemaBody(BulkApproveBody) dto: BulkApproveBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.receiptsService.bulkApprove(
      dto.receiptIds,
      workspaceId,
      user.id,
      dto.categoryId ?? undefined,
    );
  }
}
