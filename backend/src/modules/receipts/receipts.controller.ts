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
  Query,
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
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { toCaptureLocation } from '../../common/utils/capture-location.util';
import { validateFile } from '../../common/utils/file-validator.util';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { multerConfig } from '../../config/multer.config';
import {
  ApproveReceiptBody,
  BulkApproveBody,
  PlaceSuggestionsBody,
  UpdateReceiptBody,
  UpdateReceiptLocationBody,
  UpdateReceiptStageBody,
  UploadReceiptBody,
} from '../../contracts';
import type { User } from '../../entities';
import { ReceiptStatus } from '../../entities/receipt.entity';
import { StatementStage } from '../../entities/statement.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReceiptQueryDto } from './dto/receipt-query.dto';
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
      validateFile(file);
      this.assertReceiptFileSupported(file);
    });

    const receipts = await Promise.all(
      files.map(file =>
        this.receiptsService.createFromUpload({
          userId: user.id,
          workspaceId,
          files: [file],
          language: dto.language,
          captureLocation: toCaptureLocation(dto),
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

    validateFile(file);
    this.assertReceiptFileSupported(file);

    return this.receiptsService.createFromScan({
      userId: user.id,
      workspaceId,
      file,
      language: dto.language,
      captureLocation: toCaptureLocation(dto),
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
  async placeSuggestions(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(PlaceSuggestionsBody) dto: PlaceSuggestionsBody,
  ) {
    const suggestions = await this.placeSuggestionService.suggest(
      dto.statementId,
      workspaceId,
      dto,
    );
    if (!suggestions) {
      throw new BadRequestException('Receipt not found');
    }
    return suggestions;
  }

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async findAll(@WorkspaceId() workspaceId: string, @Query() query: ReceiptQueryDto) {
    return this.receiptsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
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
  async setLocation(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateReceiptLocationBody) dto: UpdateReceiptLocationBody,
    @CurrentUser() user: User,
  ) {
    const receipt = await this.locationService.setManual(id, workspaceId, dto, user.id);
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
  async update(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(UpdateReceiptBody) dto: UpdateReceiptBody,
    @CurrentUser() user: User,
  ) {
    const receipt = await this.receiptsService.update(
      id,
      workspaceId,
      { ...dto, status: toEnum(ReceiptStatus, dto.status) },
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
  async splitSuggestion(@Param('id') id: string, @WorkspaceId() workspaceId: string) {
    return this.receiptSplitService.suggest(id, workspaceId);
  }

  @Post(':id/split')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async split(
    @Param('id') id: string,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.receiptSplitService.apply(id, workspaceId, user.id);
  }

  @Post('bulk-approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async bulkApprove(
    @SchemaBody(BulkApproveBody) dto: BulkApproveBody,
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: User,
  ) {
    return this.receiptsService.bulkApprove(dto.receiptIds, workspaceId, user.id, dto.categoryId);
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
    if (!SUPPORTED_RECEIPT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only image and PDF receipt files are supported');
    }
  }
}
