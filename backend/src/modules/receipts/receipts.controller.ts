import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
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
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { withoutNulls } from '../../common/effect/without-nulls';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { toCaptureLocation } from '../../common/utils/capture-location.util';
import { assertReceiptFileSupported, validateFile } from '../../common/utils/file-validator.util';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { multerConfig } from '../../config/multer.config';
import {
  ApplyReceiptSplitBody,
  PlaceSuggestions,
  PlaceSuggestionsBody,
  ReceiptDocumentsQuery,
  ReceiptListPage,
  ReceiptParams,
  ReceiptRecord,
  ReceiptRecordUpdate,
  ReceiptSplitResult,
  ReceiptSplitSuggestion,
  ReceiptsQuery,
  ReceiptTax,
  ReceiptThumbnailQuery,
  ReceiptTransactionMatches,
  ReceiptUploadResult,
  SetReceiptTaxBody,
  UpdateReceiptBody,
  UpdateReceiptLocationBody,
  UploadReceiptBody,
} from '../../contracts';
import { ReceiptDocumentsPage } from '../../contracts/receipts/receipt-documents';
import type { User } from '../../entities';
import { ReceiptStatus } from '../../entities/receipt.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReceiptsService } from './receipts.service';
import { ReceiptDocumentsService } from './services/receipt-documents.service';
import { ReceiptLocationService } from './services/receipt-location.service';
import { ReceiptMatchService } from './services/receipt-match.service';
import { ReceiptPlaceSuggestionService } from './services/receipt-place-suggestion.service';
import { ReceiptSplitService } from './services/receipt-split.service';

type MulterFile = Express.Multer.File;

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly locationService: ReceiptLocationService,
    private readonly receiptMatchService: ReceiptMatchService,
    private readonly receiptSplitService: ReceiptSplitService,
    private readonly placeSuggestionService: ReceiptPlaceSuggestionService,
    private readonly documentsService: ReceiptDocumentsService,
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
      throw new BadRequestException(appError('UPLOAD_NO_FILES'));
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
  @SchemaResponse(ReceiptRecordUpdate)
  async scan(
    @UploadedFile() file: MulterFile,
    @SchemaBody(UploadReceiptBody) dto: UploadReceiptBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!file) {
      throw new BadRequestException(appError('UPLOAD_NO_FILE'));
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
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
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
  @SchemaResponse(ReceiptDocumentsPage)
  async listDocuments(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(ReceiptDocumentsQuery) query: ReceiptDocumentsQuery,
  ) {
    return this.documentsService.list(workspaceId, query);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ReceiptRecord)
  async findOne(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const receipt = await this.receiptsService.findOne(id, workspaceId);
    if (!receipt) {
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
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
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
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
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
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
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    const receipt = await this.locationService.resetToAuto(id, workspaceId, user.id);
    if (!receipt) {
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
    }
    return receipt;
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(ReceiptRecordUpdate)
  async update(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
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
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
    }
    return receipt;
  }

  @Get(':id/tax')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: "The tax rate and amount on the receipt's transaction" })
  @SchemaResponse(ReceiptTax)
  async getTax(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
  ) {
    const tax = await this.receiptsService.getTax(id, workspaceId);
    if (!tax) {
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
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
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SetReceiptTaxBody) dto: SetReceiptTaxBody,
    @CurrentUser() user: User,
  ) {
    const tax = await this.receiptsService.setTax(id, workspaceId, dto.taxRateId, user.id);
    if (!tax) {
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
    }
    return tax;
  }

  /** Bank rows this receipt may document, best first; recomputes the stored suggestion too. */
  @Get(':id/transaction-matches')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(ReceiptTransactionMatches)
  async transactionMatches(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    const receipt = await this.receiptMatchService.refresh(id, workspaceId);
    if (!receipt) {
      throw new BadRequestException(appError('RECEIPT_NOT_FOUND'));
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
  async splitSuggestion(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.receiptSplitService.suggest(id, workspaceId);
  }

  @Post(':id/split')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @SchemaResponse(ReceiptSplitResult)
  async split(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @SchemaBody(ApplyReceiptSplitBody) dto: ApplyReceiptSplitBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.receiptSplitService.apply(id, workspaceId, user.id, dto.items ?? undefined);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async delete(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
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
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @SchemaQuery(ReceiptThumbnailQuery) { width }: ReceiptThumbnailQuery,
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
  async getFile(
    @SchemaParams(ReceiptParams) { id }: ReceiptParams,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
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
