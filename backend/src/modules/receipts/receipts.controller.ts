import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { withoutNulls } from '../../common/effect/without-nulls';
import { Permission } from '../../common/enums/permissions.enum';
import { toCaptureLocation } from '../../common/utils/capture-location.util';
import { isEInvoiceXml, validateFile } from '../../common/utils/file-validator.util';
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
  ReceiptTransactionMatches,
  ReceiptUploadResult,
  UpdateReceiptBody,
  UpdateReceiptLocationBody,
  UpdateReceiptStageBody,
  UploadReceiptBody,
} from '../../contracts';
import type { User } from '../../entities';
import { ReceiptStatus } from '../../entities/receipt.entity';
import { StatementStage } from '../../entities/statement.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateReceiptStageResultDto } from './dto/update-receipt-stage.dto';
import { ReceiptsService } from './receipts.service';
import { ReceiptLocationService } from './services/receipt-location.service';
import { ReceiptMatchService } from './services/receipt-match.service';
import { ReceiptPlaceSuggestionService } from './services/receipt-place-suggestion.service';
import { ReceiptSplitService } from './services/receipt-split.service';
import { ReceiptStageService } from './services/receipt-stage.service';

type MulterFile = Express.Multer.File;

const SUPPORTED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
  // A structured e-invoice (XRechnung) sent as the XML itself.
  'application/xml',
  'text/xml',
]);

@Controller('receipts')
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
    private readonly locationService: ReceiptLocationService,
    private readonly receiptStageService: ReceiptStageService,
    private readonly receiptMatchService: ReceiptMatchService,
    private readonly receiptSplitService: ReceiptSplitService,
    private readonly placeSuggestionService: ReceiptPlaceSuggestionService,
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
      this.assertReceiptFileSupported(file);
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
    this.assertReceiptFileSupported(file);

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
  async transactionMatches(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    const receipt = await this.receiptMatchService.refresh(id, workspaceId);
    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }
    const candidates = await this.receiptMatchService.candidates(receipt);
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

  private assertReceiptFileSupported(file: MulterFile): void {
    const isXml = file.mimetype === 'application/xml' || file.mimetype === 'text/xml';
    if (!SUPPORTED_RECEIPT_MIME_TYPES.has(file.mimetype) || (isXml && !isEInvoiceXml(file))) {
      throw new BadRequestException(
        'Only image, PDF and e-invoice XML receipt files are supported',
      );
    }
  }
}
