import * as fs from 'node:fs';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { deletedResponse } from '../../common/utils/responses.util';
import { parseOwnerFilter } from '../../common/utils/transaction-owner.util';
import { redactPrivate, redactPrivateRows } from '../../common/utils/transaction-privacy.util';
import type { BulkUpdateItemInput } from '../../contracts';
import {
  BulkUpdateRequestBody,
  DuplicateDetectQuery,
  DuplicateGroups,
  DuplicatesMarked,
  MarkDuplicatesBody,
  MergeDuplicatesBody,
  MessageResult,
  SetTransactionTagsBody,
  SplitTransactionBody,
  StorageTagList,
  TransactionAttachment,
  TransactionAttachmentList,
  TransactionAttachmentParams,
  TransactionListPage,
  TransactionListQuery,
  TransactionParams,
  TransactionsOverview,
  TransactionsOverviewQuery,
  UpdateTransactionBody,
} from '../../contracts';
import {
  DuplicatesMerged,
  DuplicateUnmarked,
  TransactionRecord,
  TransactionRecordList,
} from '../../contracts/transactions/transaction-record';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CrossStatementDeduplicationService } from './services/cross-statement-deduplication.service';
import { TransactionAttachmentsService } from './services/transaction-attachments.service';
import { TransactionTagsService } from './services/transaction-tags.service';
import { TransactionsOverviewService } from './services/transactions-overview.service';
import { listFiltersFromQuery } from './transaction-list-filters';
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
    private readonly overviewService: TransactionsOverviewService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionListPage)
  async findAll(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(TransactionListQuery) query: TransactionListQuery,
  ) {
    const result = await this.transactionsService.findAll(
      workspaceId,
      listFiltersFromQuery(query, selfMemberId),
      selfMemberId,
    );

    const data =
      query.running_balance === '1'
        ? await this.overviewService.withLedger(workspaceId, result.data)
        : result.data;

    // Include 'items' field for backward compatibility
    return { ...result, data, items: data };
  }

  @Get('overview')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionsOverview)
  async overview(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(TransactionsOverviewQuery) query: TransactionsOverviewQuery,
  ) {
    return this.overviewService.getOverview(
      workspaceId,
      {
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        convertTo: query.convertTo,
        owner: parseOwnerFilter(query.owner, selfMemberId),
      },
      selfMemberId,
    );
  }

  @Get(':id')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionRecord)
  async findOne(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.transactionsService.findOneFor(id, workspaceId, selfMemberId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionRecord)
  async update(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @SchemaBody(UpdateTransactionBody) updateDto: UpdateTransactionBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    await this.transactionsService.update(id, workspaceId, user.id, updateDto, null, selfMemberId);
    // Read back as stored, and as redacted as the list shows someone else's private row.
    return this.transactionsService.findOneFor(id, workspaceId, selfMemberId);
  }

  @Get(':id/split')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionRecordList)
  async getSplitParts(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return redactPrivateRows(
      await this.transactionsService.getSplitParts(id, workspaceId),
      selfMemberId,
    );
  }

  // No @Audit here: TransactionsService.split writes its own richer audit event
  // (operation/splitGroupId/counts in meta). Stacking the decorator would double-log.
  @Post(':id/split')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionRecordList)
  async split(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @SchemaBody(SplitTransactionBody) splitDto: SplitTransactionBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    await this.transactionsService.split(id, workspaceId, user.id, splitDto);
    // The parts as stored, with their relations: the same answer as GET :id/split.
    return this.getSplitParts({ id }, workspaceId, selfMemberId);
  }

  // No @Audit here: see the note on split() above — unsplit audits itself too.
  @Post(':id/unsplit')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @SchemaResponse(TransactionRecord)
  async unsplit(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const merged = await this.transactionsService.unsplit(id, workspaceId, user.id);
    return this.transactionsService.findOneFor(merged.id, workspaceId, selfMemberId);
  }

  @Post('bulk-update')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.TRANSACTION_BULK_UPDATE)
  @SchemaResponse(TransactionRecordList)
  async bulkUpdate(
    @SchemaBody(BulkUpdateRequestBody) body: BulkUpdateRequestBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    // Support both {items} and {ids, updates} formats for backward compatibility
    let items: BulkUpdateItemInput[];

    if (body.items) {
      items = body.items;
    } else if (body.ids && body.updates) {
      const updates = body.updates;
      items = body.ids.map(id => ({ id, updates }));
    } else {
      // BadRequestException, not Error: a plain Error leaves the exception
      // filter with nothing to map and the client gets a 500 for bad input.
      throw new BadRequestException(appError('TRANSACTION_BULK_UPDATE_FORMAT'));
    }

    const updated = await this.transactionsService.bulkUpdate(
      workspaceId,
      user.id,
      items,
      selfMemberId,
    );
    // Each row read back as stored, redacted for whoever does not own it.
    return Promise.all(
      updated.map(row => this.transactionsService.findOneFor(row.id, workspaceId, selfMemberId)),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.TRANSACTION_DELETE)
  async remove(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transactionsService.remove(id, workspaceId, user.id);
  }

  @Get('duplicates/detect')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(DuplicateGroups)
  async detectDuplicates(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(DuplicateDetectQuery) query: DuplicateDetectQuery,
  ) {
    const duplicateGroups = await this.deduplicationService.findDuplicates(
      workspaceId,
      query.statement_id,
      query.threshold ?? 0.85,
      selfMemberId,
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
  @SchemaResponse(DuplicatesMarked)
  async markDuplicates(
    @SchemaBody(MarkDuplicatesBody) body: MarkDuplicatesBody,
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
  @SchemaResponse(DuplicatesMerged)
  async mergeDuplicates(
    @SchemaBody(MergeDuplicatesBody) body: MergeDuplicatesBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const master = redactPrivate(
      await this.deduplicationService.mergeDuplicates(body.transactionIds, workspaceId),
      selfMemberId,
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
  @SchemaResponse(DuplicateUnmarked)
  async unmarkDuplicate(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
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

  @Get(':id/tags')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(StorageTagList)
  async getTags(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionTagsService.getTags(id, workspaceId);
  }

  @Put(':id/tags')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @Audit({ entityType: EntityType.TRANSACTION, includeDiff: true })
  @SchemaResponse(StorageTagList)
  async setTags(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @SchemaBody(SetTransactionTagsBody) dto: SetTransactionTagsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionTagsService.setTags(id, workspaceId, dto.tagIds);
  }

  @Get(':id/attachments')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  @SchemaResponse(TransactionAttachmentList)
  async listAttachments(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionAttachmentsService.list(id, workspaceId);
  }

  @Post(':id/attachments')
  @WorkspaceAuth(Permission.TRANSACTION_EDIT)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }))
  @Audit({ entityType: EntityType.TRANSACTION })
  @SchemaResponse(TransactionAttachment)
  async uploadAttachment(
    @SchemaParams(TransactionParams) { id }: TransactionParams,
    @UploadedFile() file: MulterFile,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.transactionAttachmentsService.create(id, workspaceId, user.id, file);
  }

  @Get('attachments/:attachmentId/download')
  @WorkspaceAuth(Permission.TRANSACTION_VIEW)
  async downloadAttachment(
    @SchemaParams(TransactionAttachmentParams) { attachmentId }: TransactionAttachmentParams,
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
  @SchemaResponse(MessageResult)
  async removeAttachment(
    @SchemaParams(TransactionAttachmentParams) { attachmentId }: TransactionAttachmentParams,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.transactionAttachmentsService.remove(attachmentId, workspaceId);
    return deletedResponse('Attachment');
  }
}
