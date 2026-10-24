import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { withoutNulls } from '../../common/effect/without-nulls';
import { Permission } from '../../common/enums/permissions.enum';
import { toCaptureLocation } from '../../common/utils/capture-location.util';
import { assertReceiptFileSupported, validateFile } from '../../common/utils/file-validator.util';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { multerConfig } from '../../config/multer.config';
import {
  ApplyReceiptSplitBody,
  ApproveReceiptBody,
  BulkApproveBody,
  PlaceSuggestions,
  PlaceSuggestionsBody,
  ReceiptListPage,
  ReceiptRecord,
  ReceiptRecordUpdate,
  ReceiptSplitSuggestion,
  ReceiptsQuery,
  ReceiptTax,
  ReceiptTransactionMatches,
  ReceiptUploadResult,
  SetReceiptTagsBody,
  SetReceiptTaxBody,
  StorageTagList,
  UpdateReceiptBody,
  UpdateReceiptLocationBody,
  UpdateReceiptStageBody,
  UploadReceiptBody,
} from '../../contracts';
import type { User } from '../../entities';
import { EntityType } from '../../entities/audit-event.entity';
import { ReceiptStatus } from '../../entities/receipt.entity';
import { StatementStage } from '../../entities/statement.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateReceiptStageResultDto } from './dto/update-receipt-stage.dto';
import { ReceiptsService } from './receipts.service';
import { ReceiptDocumentsService } from './services/receipt-documents.service';
import { ReceiptLocationService } from './services/receipt-location.service';
import { ReceiptMatchService } from './services/receipt-match.service';
import { ReceiptPlaceSuggestionService } from './services/receipt-place-suggestion.service';
import { ReceiptSplitService } from './services/receipt-split.service';
import { ReceiptStageService } from './services/receipt-stage.service';
import { ReceiptTagsService } from './services/receipt-tags.service';

type MulterFile = Express.Multer.File;

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly locationService: ReceiptLocationService,
    private readonly receiptStageService: ReceiptStageService,
    private readonly receiptMatchService: ReceiptMatchService,
    private readonly receiptSplitService: ReceiptSplitService,
    private readonly placeSuggestionService: ReceiptPlaceSuggestionService,
    private readonly documentsService: ReceiptDocumentsService,
    private readonly receiptTagsService: ReceiptTagsService,
  ) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', 5, multerConfig))
  @SchemaResponse(ReceiptUploadResult)
  async upload(
    @UploadedFiles() files: MulterFile[],
    @SchemaBody(UploadReceiptBody) dto: UploadReceiptBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('No files provided');
    }

    files.forEach(file => {
      validateFile(file, { allowEInvoiceXml: true });
      assertReceiptFileSupported(file);
    });

    const receipts = await Promise.all(
      files.map(file =>
        this.receiptsService.createFromUpload({
          userId: user.id,
          workspaceId,
          files: [file],
          language: dto.language ?? undefined,
          captureLocation: toCaptureLocation(withoutNulls(dto)),
        }),
      ),
    );

    return { receipts };
  }

  @Post('scan')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async scan(
    @UploadedFile() file: MulterFile,
    @SchemaBody(UploadReceiptBody) dto: UploadReceiptBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    validateFile(file, { allowEInvoiceXml: true });
    assertReceiptFileSupported(file);

    return this.receiptsService.createFromScan({
      userId: user.id,
      workspaceId,
      file,
      language: dto.language ?? undefined,
      captureLocation: toCaptureLocation(withoutNulls(dto)),
    });
  }

  // POST although it only reads: the body carries where the user is, and a
  // query string would put that in access logs.
  @Post('place-suggestions')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Shops near a GPS fix taken after a scan that had none' })
  @ApiResponse({
    status: 200,
    description: '{ needed: false } when the store is already known, else the candidates',
  })
  @ApiResponse({ status: 400, description: 'No receipt for this statement in the workspace' })
  @SchemaResponse(PlaceSuggestions)
  async placeSuggestions(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(PlaceSuggestionsBody) dto: PlaceSuggestionsBody,
  ) {
    const suggestions = await this.placeSuggestionService.suggest(
      dto.statementId,
      workspaceId,
      withoutNulls(dto),
    );
    if (!suggestions) {
      throw new BadRequestException('Receipt not found');
    }
    return suggestions;
  }

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ReceiptListPage)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ReceiptsQuery) query: ReceiptsQuery,
  ) {
    return this.receiptsService.findAll(workspaceId, query);
  }

  /** Receipts of every source as the Documents list and analytics read them. Before `:id`. */
  @Get('documents')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'List receipts for the documents list' })
  async listDocuments(
    @WorkspaceId() workspaceId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('includeInvalid') includeInvalid?: string,
    @Query('hasAmount') hasAmount?: string,
    @Query('categoryId') categoryId?: string,
    @Query('includeLinkedScans') includeLinkedScans?: string,
    @Query('stage') stage?: string,
  ) {
    return this.documentsService.list(workspaceId, {
      status,
      limit,
      offset,
      includeInvalid,
      hasAmount,
      categoryId,
      includeLinkedScans,
      stage,
    });
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ReceiptRecord)
  async findOne(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    const receipt = await this.receiptsService.findOne(id, workspaceId);
    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }
    return receipt;
  }

  @Patch(':id/location')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Pin the receipt to a point chosen by the user' })
  @ApiResponse({
    status: 200,
    description: 'Receipt with location source "manual", or "place" when a shop was picked',
  })
  @ApiResponse({ status: 400, description: 'Receipt not found or coordinates out of range' })
  @SchemaResponse(ReceiptRecordUpdate)
  async setLocation(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateReceiptLocationBody) dto: UpdateReceiptLocationBody,
    @CurrentUser() user: User,
  ) {
    const receipt = await this.locationService.setManual(
      id,
      workspaceId,
      withoutNulls(dto),
      user.id,
    );
    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }
    return receipt;
  }

  @Delete(':id/location')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({
    summary: 'Drop the manual point and recompute it from the merchant address or photo',
  })
  @ApiResponse({ status: 200, description: 'Receipt with the automatically resolved location' })
  @ApiResponse({ status: 400, description: 'Receipt not found' })
  @SchemaResponse(ReceiptRecordUpdate)
  async resetLocation(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    const receipt = await this.locationService.resetToAuto(id, workspaceId, user.id);
    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }
    return receipt;
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(ReceiptRecordUpdate)
  async update(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateReceiptBody) dto: UpdateReceiptBody,
    @CurrentUser() user: User,
  ) {
    const receipt = await this.receiptsService.update(
      id,
      workspaceId,
      { ...withoutNulls(dto), status: toEnum(ReceiptStatus, dto.status) ?? undefined },
      user.id,
    );
    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }
    return receipt;
  }

  @Get(':id/tax')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: "The tax rate and amount on the receipt's transaction" })
  @SchemaResponse(ReceiptTax)
  async getTax(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    const tax = await this.receiptsService.getTax(id, workspaceId);
    if (!tax) {
      throw new BadRequestException('Receipt not found');
    }
    return tax;
  }

  @Put(':id/tax')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({
    summary: "Pick the tax rate of the receipt's transaction, or null to follow the rules",
  })
  @ApiResponse({ status: 404, description: 'Tax rate not found in this workspace' })
  @ApiResponse({ status: 409, description: 'No transaction yet, or it is on a filed return' })
  @SchemaResponse(ReceiptTax)
  async setTax(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SetReceiptTaxBody) dto: SetReceiptTaxBody,
    @CurrentUser() user: User,
  ) {
    const tax = await this.receiptsService.setTax(id, workspaceId, dto.taxRateId, user.id);
    if (!tax) {
      throw new BadRequestException('Receipt not found');
    }
    return tax;
  }

  @Get(':id/tags')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: "The receipt's tags" })
  @SchemaResponse(StorageTagList)
  async getTags(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    return this.receiptTagsService.getTags(id, workspaceId);
  }

  @Put(':id/tags')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @Audit({ entityType: EntityType.RECEIPT, includeDiff: true })
  @ApiOperation({ summary: "Replace the receipt's tags; an empty list clears them" })
  @ApiResponse({ status: 400, description: 'A tag is not in this workspace' })
  @SchemaResponse(StorageTagList)
  async setTags(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(SetReceiptTagsBody) dto: SetReceiptTagsBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.receiptTagsService.setTags(id, workspaceId, dto.tagIds);
  }

  @Post('stage')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Move one or more receipts between Submit and Approve' })
  @ApiResponse({ status: 200, type: UpdateReceiptStageResultDto })
  async updateStage(
    @SchemaBody(UpdateReceiptStageBody) dto: UpdateReceiptStageBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ): Promise<UpdateReceiptStageResultDto> {
    return this.receiptStageService.updateStage(
      dto.receiptIds,
      toEnum(StatementStage, dto.stage),
      user.id,
      workspaceId,
    );
  }

  @Post(':id/approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async approve(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
    @SchemaBody(ApproveReceiptBody) dto: ApproveReceiptBody,
  ) {
    const result = await this.receiptsService.approve(id, workspaceId, user.id, {
      attachTo: dto?.transactionId,
    });
    if (!result) {
      throw new BadRequestException('Receipt not found');
    }
    return result;
  }

  /** Bank rows this receipt may document, best first; recomputes the stored suggestion too. */
  @Get(':id/transaction-matches')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ReceiptTransactionMatches)
  async transactionMatches(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const receipt = await this.receiptMatchService.refresh(id, workspaceId);
    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }
    const candidates = await this.receiptMatchService.candidates(receipt, selfMemberId);
    return {
      suggestion: receipt.metadata?.transactionMatch ?? null,
      data: candidates.map(entry => ({
        id: entry.candidate.id,
        transactionDate: entry.candidate.transactionDate,
        counterpartyName: entry.candidate.counterpartyName,
        amount: entry.candidate.amount,
        currency: entry.candidate.currency,
        score: Number(entry.score.toFixed(2)),
        daysApart: Number(entry.daysApart.toFixed(1)),
      })),
    };
  }

  @Get(':id/split-suggestion')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ReceiptSplitSuggestion)
  async splitSuggestion(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.receiptSplitService.suggest(id, workspaceId);
  }

  @Post(':id/split')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async split(
    @Param('id') id: string,
    @SchemaBody(ApplyReceiptSplitBody) dto: ApplyReceiptSplitBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.receiptSplitService.apply(id, workspaceId, user.id, dto.items ?? undefined);
  }

  @Post('bulk-approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async delete(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    await this.receiptsService.delete(id, workspaceId, user.id);
  }

  @Get(':id/thumbnail')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'Get receipt thumbnail' })
  async getThumbnail(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Query('width') width: string,
    @Res() res: Response,
  ) {
    const thumbnail = await this.documentsService.thumbnail(id, workspaceId, width);
    if (thumbnail.kind === 'image') {
      res.setHeader('Content-Type', thumbnail.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(thumbnail.data);
    }
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (thumbnail.kind === 'missing') {
      return res.status(HttpStatus.NOT_FOUND).json({ error: thumbnail.error });
    }
    res.setHeader('Retry-After', '60');
    return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      error: { code: 'THUMBNAIL_GENERATION_FAILED', message: 'Failed to generate thumbnail' },
    });
  }

  @Get(':id/file')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async getFile(@Param('id') id: string, @WorkspaceId() workspaceId: string, @Res() res: Response) {
    const filePayload = await this.receiptsService.getFilePayload(id, workspaceId);

    if (!filePayload) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Receipt file not found' });
    }

    res.setHeader('Content-Type', filePayload.mimeType);
    res.setHeader('Content-Disposition', buildContentDisposition('inline', filePayload.fileName));
    res.setHeader('Cache-Control', 'private, max-age=600');
    return res.send(filePayload.buffer);
  }
}
