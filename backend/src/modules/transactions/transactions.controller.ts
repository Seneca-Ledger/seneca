import * as fs from 'node:fs';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import { parseOwnerFilter } from '../../common/utils/transaction-owner.util';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { BulkUpdateItemDto } from './dto/bulk-update-transaction.dto';
import { BulkUpdateRequestDto } from './dto/bulk-update-transaction.dto';
import { MarkDuplicatesDto, MergeDuplicatesDto } from './dto/duplicate-actions.dto';
import { SetTransactionTagsDto } from './dto/set-transaction-tags.dto';
import { SplitTransactionDto } from './dto/split-transaction.dto';
import {
  DetectTransfersDto,
  LinkReimbursementDto,
  LinkTransferDto,
} from './dto/transfer-actions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { CrossStatementDeduplicationService } from './services/cross-statement-deduplication.service';
import { TransactionAttachmentsService } from './services/transaction-attachments.service';
import { TransactionTagsService } from './services/transaction-tags.service';
import { TransferPairingService } from './services/transfer-pairing.service';
import { TransactionsService } from './transactions.service';

/**
 * Aliased on purpose: writing `Express.Multer.File` straight into a decorated
 * parameter makes emitDecoratorMetadata emit a runtime reference to `Express`,
 * which does not exist and throws at import time.
 */
type MulterFile = Express.Multer.File;

/** Mirrors the 10 MB ceiling in validateFile, but rejects before the body is buffered. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly deduplicationService: CrossStatementDeduplicationService,
    private readonly transactionTagsService: TransactionTagsService,
    private readonly transactionAttachmentsService: TransactionAttachmentsService,
    private readonly transferPairingService: TransferPairingService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async findAll(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    // Accept both snake_case and camelCase for backward compatibility
    @Query('statement_id') statementIdSnake?: string,
    @Query('statementId') statementIdCamel?: string,
    @Query('date_from') dateFromSnake?: string,
    @Query('startDate') startDateCamel?: string,
    @Query('date_to') dateToSnake?: string,
    @Query('endDate') endDateCamel?: string,
    @Query('type') type?: string,
    @Query('category_id') categoryIdSnake?: string,
    @Query('categoryId') categoryIdCamel?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('currency') currency?: string,
    @Query('convert_to') convertTo?: string,
    @Query('owner') owner?: string,
  ) {
    // Prefer snake_case for backward compatibility, fall back to camelCase
    const statementId = statementIdSnake || statementIdCamel;
    const dateFrom = dateFromSnake || startDateCamel;
    const dateTo = dateToSnake || endDateCamel;
    const categoryId = categoryIdSnake || categoryIdCamel;

    const result = await this.transactionsService.findAll(
      workspaceId,
      {
        statementId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        type,
        categoryId,
        currency,
        convertTo,
        owner: parseOwnerFilter(owner, selfMemberId),
        page: page ? Number.parseInt(page) : 1,
        limit: limit ? Number.parseInt(limit) : 50,
      },
      selfMemberId,
    );

    // Include 'items' field for backward compatibility
    return {
      ...result,
      items: result.data,
    };
  }

  @Get(':id')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionsService.findOneFor(id, workspaceId, selfMemberId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTransactionDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionsService.update(id, workspaceId, user.id, updateDto, null, selfMemberId);
  }

  @Get(':id/split')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async getSplitParts(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.transactionsService.getSplitParts(id, workspaceId);
  }

  // No @Audit here: TransactionsService.split writes its own richer audit event
  // (operation/splitGroupId/counts in meta). Stacking the decorator would double-log.
  @Post(':id/split')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async split(
    @Param('id') id: string,
    @Body() splitDto: SplitTransactionDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionsService.split(id, workspaceId, user.id, splitDto);
  }

  // No @Audit here: see the note on split() above — unsplit audits itself too.
  @Post(':id/unsplit')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async unsplit(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionsService.unsplit(id, workspaceId, user.id);
  }

  @Post('bulk-update')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_BULK_UPDATE)
  async bulkUpdate(
    @Body() body: BulkUpdateRequestDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    // Support both {items} and {ids, updates} formats for backward compatibility
    let items: BulkUpdateItemDto[];

    if (body.items) {
      items = body.items;
    } else if (body.ids && body.updates) {
      const updates = body.updates;
      items = body.ids.map(id => ({ id, updates }));
    } else {
      // BadRequestException, not Error: a plain Error leaves the exception
      // filter with nothing to map and the client gets a 500 for bad input.
      throw new BadRequestException(
        'Invalid bulk update format. Expected {items} or {ids, updates}',
      );
    }

    return this.transactionsService.bulkUpdate(workspaceId, user.id, items, selfMemberId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.TRANSACTION_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transactionsService.remove(id, workspaceId, user.id);
  }

  @Get('duplicates/detect')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async detectDuplicates(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('statement_id') statementId?: string,
    @Query('threshold') threshold?: string,
  ) {
    const duplicateGroups = await this.deduplicationService.findDuplicates(
      workspaceId,
      statementId,
      threshold ? Number.parseFloat(threshold) : 0.85,
    );

    return {
      totalGroups: duplicateGroups.length,
      groups: duplicateGroups.map(group => ({
        master: {
          id: group.master.id,
          date: group.master.transactionDate,
          amount: group.master.debit || group.master.credit || group.master.amount,
          counterparty: group.master.counterpartyName,
          purpose: group.master.paymentPurpose,
          statementId: group.master.statementId,
        },
        duplicates: group.duplicates.map(d => ({
          id: d.transaction.id,
          date: d.transaction.transactionDate,
          amount: d.transaction.debit || d.transaction.credit || d.transaction.amount,
          counterparty: d.transaction.counterpartyName,
          purpose: d.transaction.paymentPurpose,
          statementId: d.transaction.statementId,
          similarity: d.similarity,
          matchType: d.matchType,
          matchedFields: d.matchedFields,
        })),
        confidence: group.confidence,
      })),
    };
  }

  @Post('duplicates/mark')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async markDuplicates(
    @Body() body: MarkDuplicatesDto,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const duplicateGroups = await this.deduplicationService.findDuplicates(workspaceId);

    // Filter to only the groups specified by the client
    const groupsToMark = duplicateGroups.filter(group =>
      body.groups.some(g => g.masterId === group.master.id),
    );

    const markedCount = await this.deduplicationService.markDuplicates(groupsToMark);

    return {
      success: true,
      markedCount,
    };
  }

  @Post('duplicates/merge')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async mergeDuplicates(
    @Body() body: MergeDuplicatesDto,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const master = await this.deduplicationService.mergeDuplicates(
      body.transactionIds,
      workspaceId,
    );

    return {
      success: true,
      master: {
        id: master.id,
        date: master.transactionDate,
        amount: master.debit || master.credit || master.amount,
        counterparty: master.counterpartyName,
      },
    };
  }

  @Post(':id/unmark-duplicate')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async unmarkDuplicate(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const transaction = await this.deduplicationService.unmarkDuplicate(id, workspaceId);

    return {
      success: true,
      transaction: {
        id: transaction.id,
        isDuplicate: transaction.isDuplicate,
      },
    };
  }

  /** Pairs the legs of transfers between the user's own accounts and writes them. */
  @Post('transfers/detect')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async detectTransfers(
    @Body() body: DetectTransfersDto,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transferPairingService.detectAndApply(workspaceId, body.statementId);
  }

  @Get(':id/transfer-candidates')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async transferCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const data = await this.transferPairingService.candidates(workspaceId, id);
    return { data };
  }

  @Post(':id/link-transfer')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async linkTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinkTransferDto,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const transferPairId = await this.transferPairingService.link(workspaceId, id, body.otherId);
    return { transferPairId };
  }

  @Post(':id/unlink-transfer')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async unlinkTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transferPairingService.unlink(workspaceId, id);
    return { unlinked: true };
  }

  @Get(':id/reimbursement-candidates')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async reimbursementCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const data = await this.transferPairingService.reimbursementCandidates(workspaceId, id);
    return { data };
  }

  @Post(':id/link-reimbursement')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async linkReimbursement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinkReimbursementDto,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transferPairingService.linkReimbursement(workspaceId, id, body.expenseId);
  }

  @Post(':id/unlink-reimbursement')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  async unlinkReimbursement(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transferPairingService.unlinkReimbursement(workspaceId, id);
    return { unlinked: true };
  }

  @Get(':id/tags')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async getTags(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    return this.transactionTagsService.getTags(id, workspaceId);
  }

  @Put(':id/tags')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @Audit({ entityType: EntityType.TRANSACTION, includeDiff: true })
  async setTags(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetTransactionTagsDto,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionTagsService.setTags(id, workspaceId, dto.tagIds);
  }

  @Get(':id/attachments')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async listAttachments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionAttachmentsService.list(id, workspaceId);
  }

  @Post(':id/attachments')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  @Audit({ entityType: EntityType.TRANSACTION })
  async uploadAttachment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionAttachmentsService.create(id, workspaceId, user.id, file);
  }

  @Get('attachments/:attachmentId/download')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async downloadAttachment(
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { absolutePath, fileName, mimeType } =
      await this.transactionAttachmentsService.getForDownload(attachmentId, workspaceId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    fs.createReadStream(absolutePath).pipe(res);
  }

  @Delete('attachments/:attachmentId')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @Audit({ entityType: EntityType.TRANSACTION })
  async removeAttachment(
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transactionAttachmentsService.remove(attachmentId, workspaceId);
    return deletedResponse('Attachment');
  }
}
