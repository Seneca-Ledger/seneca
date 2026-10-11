import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
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
import { Permission } from '../../common/enums/permissions.enum';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { toCaptureLocation } from '../../common/utils/capture-location.util';
import { unlinkAll, validateFile, validateFiles } from '../../common/utils/file-validator.util';
import { pipeFileStreamResponse } from '../../common/utils/stream-response.util';
import { multerConfig } from '../../config/multer.config';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ConvertDroppedSampleDto } from './dto/convert-dropped-sample.dto';
import { CreateManualExpenseDto } from './dto/create-manual-expense.dto';
import { FilterStatementsDto } from './dto/filter-statements.dto';
import { UpdateStatementDto } from './dto/update-statement.dto';
import {
  UpdateStatementStageDto,
  UpdateStatementStageResultDto,
} from './dto/update-statement-stage.dto';
import { UploadReceiptScanDto } from './dto/upload-receipt-scan.dto';
import { UploadStatementDto } from './dto/upload-statement.dto';
import { ReceiptStatementService } from './services/receipt-statement.service';
import { StatementStageService } from './services/statement-stage.service';
import { StatementsService } from './statements.service';

const SUPPORTED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'application/pdf',
]);

interface ThumbnailErrorLike {
  getStatus?: () => number;
  response?: { message?: string };
  message?: string;
}

@Controller('statements')
export class StatementsController {
  private readonly logger = new Logger(StatementsController.name);

  constructor(
    private readonly statementsService: StatementsService,
    private readonly receiptStatementService: ReceiptStatementService,
    private readonly idempotencyService: IdempotencyService,
    private readonly statementStageService: StatementStageService,
  ) {}

  private toObjectRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private getThumbnailError(error: unknown): ThumbnailErrorLike {
    return typeof error === 'object' && error !== null ? (error as ThumbnailErrorLike) : {};
  }

  private isUploadedFile(file: unknown): file is Express.Multer.File {
    return (
      typeof file === 'object' &&
      file !== null &&
      'originalname' in file &&
      'mimetype' in file &&
      'size' in file
    );
  }

  // Legacy POST /statements endpoint (backward compatibility for single 'file' field)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
  @UseInterceptors(FilesInterceptor('file', 1, multerConfig))
  async uploadLegacy(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: UploadStatementDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.handleUpload(files, uploadDto, user, workspaceId, idempotencyKey, true);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', 2, multerConfig))
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() uploadDto: UploadStatementDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.handleUpload(files, uploadDto, user, workspaceId, idempotencyKey, false);
  }

  @Post('manual-expense')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', 5, multerConfig))
  async createManualExpense(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() payload: CreateManualExpenseDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const cached = await this.idempotencyService.checkKey(idempotencyKey, user.id, workspaceId);
      if (cached) {
        return {
          ...this.toObjectRecord(cached.data),
          cached: true,
        };
      }
    }

    const result = await this.statementsService.createManualExpense({
      user,
      workspaceId,
      files: files || [],
      payload,
    });

    if (idempotencyKey) {
      await this.idempotencyService.storeKey(idempotencyKey, user.id, workspaceId, result);
    }

    return result;
  }

  @Post('upload-receipt')
  @HttpCode(HttpStatus.CREATED)
  @WorkspaceAuth(Permission.STATEMENT_UPLOAD)
  @UseInterceptors(FilesInterceptor('files', 5, multerConfig))
  async uploadReceipt(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadReceiptScanDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('No files provided');
    }

    try {
      for (const file of files) {
        validateFile(file);
        this.assertReceiptFileSupported(file);
      }
    } catch (error) {
      await unlinkAll(files);
      throw error;
    }

    const data = await this.receiptStatementService.createFromReceiptScan({
      user,
      workspaceId,
      files,
      language: body?.language,
      captureLocation: toCaptureLocation(body),
    });

    return { data };
  }

  @Post(':id/attach-file')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @Audit({ entityType: EntityType.STATEMENT, includeDiff: true, isUndoable: true })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async attachFile(
    @Param('id') id: string,
    @UploadedFile() file: unknown,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!this.isUploadedFile(file)) {
      throw new BadRequestException('No file provided');
    }

    await validateFiles([file]);
    return this.statementsService.attachFile(id, user.id, workspaceId, file);
  }

  private async handleUpload(
    files: Express.Multer.File[],
    uploadDto: UploadStatementDto,
    user: User,
    workspaceId: string,
    idempotencyKey: string | undefined,
    returnUnwrappedSingle: boolean,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    if (files.length > 2) {
      throw new BadRequestException('Maximum 2 files allowed');
    }

    // Check idempotency key if provided
    if (idempotencyKey) {
      const cached = await this.idempotencyService.checkKey(idempotencyKey, user.id, workspaceId);
      if (cached) {
        return {
          ...this.toObjectRecord(cached.data),
          cached: true,
        };
      }
    }

    // Validate each file
    await validateFiles(files);

    // Process each file
    const results = await Promise.all(
      files.map(file =>
        this.statementsService.create(
          user,
          workspaceId,
          file,
          uploadDto.walletId || undefined,
          uploadDto.branchId || undefined,
          uploadDto.allowDuplicates ?? false,
          uploadDto.requireManualCategorySelection ?? false,
        ),
      ),
    );

    const responseData = results.map(statement => ({
      ...statement,
      importPreview: statement.parsingDetails?.importPreview ?? null,
    }));

    // Return unwrapped statement for single file (backward compatibility)
    if (returnUnwrappedSingle && responseData.length === 1) {
      const response = {
        ...responseData[0],
        idempotencyKey,
        cached: false,
      };
      if (idempotencyKey) {
        await this.idempotencyService.storeKey(idempotencyKey, user.id, workspaceId, response);
      }
      return response;
    }

    const response = {
      data: responseData,
      idempotencyKey,
      cached: false,
    };

    // Store idempotency key if provided
    if (idempotencyKey) {
      await this.idempotencyService.storeKey(idempotencyKey, user.id, workspaceId, response);
    }

    return response;
  }

  @Get('export-zip')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async exportZip(@WorkspaceId() workspaceId: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="lumio-export.zip"');
    await this.statementsService.exportZip(workspaceId, res);
  }

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async findAll(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query() filters: FilterStatementsDto,
  ) {
    const result = await this.statementsService.findAll(workspaceId, filters);

    // Include 'items' field for backward compatibility
    return {
      ...result,
      items: result.data,
    };
  }

  // File routes must be defined before :id route to avoid conflicts
  @Get(':id/file')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async getFile(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.statementsService.getFileStream(
      id,
      workspaceId,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'attachment',
      fileName,
      mimeType,
      errorMessage: 'Failed to download file',
    });
  }

  private assertReceiptFileSupported(file: Express.Multer.File): void {
    if (!SUPPORTED_RECEIPT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Only image and PDF receipt files are supported');
    }
  }

  @Get(':id/view')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async viewFile(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ) {
    const { stream, fileName, mimeType } = await this.statementsService.getFileStream(
      id,
      workspaceId,
    );

    pipeFileStreamResponse(res, stream, {
      disposition: 'inline',
      fileName,
      mimeType,
      errorMessage: 'Failed to read file',
    });
  }

  @Get(':id/thumbnail')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async getThumbnail(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('width') width: string,
    @Res() res: Response,
  ) {
    try {
      const parsedWidth = width ? Number(width) : undefined;
      const thumbnail = await this.statementsService.getThumbnail(id, workspaceId, parsedWidth);
      res.setHeader('Content-Type', 'image/png');
      // Cache successful thumbnails for one week
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.send(thumbnail);
    } catch (error) {
      // Log full error details for diagnostics (includes stack when available)
      this.logger.error(`Thumbnail generation error for statement ${id}:`, error);
      const thumbnailError = this.getThumbnailError(error);

      // Try to infer HTTP status from Nest HttpException if present
      const statusCode =
        typeof thumbnailError.getStatus === 'function' ? thumbnailError.getStatus() : null;
      // Prefer structured response message when available, otherwise fallback to generic message
      const message =
        thumbnailError.response?.message || thumbnailError.message || 'Thumbnail not available';

      // If generation failed on the server side (transient), tell client to retry later and cache briefly
      if (
        (statusCode === HttpStatus.BAD_REQUEST &&
          String(message).toLowerCase().includes('failed to generate')) ||
        String(message).toLowerCase().includes('failed to generate')
      ) {
        // Suggest client to retry after 60 seconds and cache the negative result briefly to avoid hammering
        res.setHeader('Retry-After', '60');
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: {
            code: 'THUMBNAIL_GENERATION_FAILED',
            message: String(message),
          },
        });
        return;
      }

      // If the service indicated a bad request (e.g. not a PDF), forward a 400 with message
      if (statusCode === HttpStatus.BAD_REQUEST) {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: {
            code: 'BAD_REQUEST',
            message: String(message),
          },
        });
        return;
      }

      // Default fallback: not found (thumbnail not available). Cache briefly to reduce repeated attempts.
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Retry-After', '60');
      res.status(HttpStatus.NOT_FOUND).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Thumbnail not available',
        },
      });
    }
  }

  // Audited per statement inside the service (one batch), since the body can hold many ids.
  @Post('stage')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Move one or more statements to a review-workflow stage' })
  @ApiResponse({ status: 200, type: UpdateStatementStageResultDto })
  async updateStage(
    @Body() dto: UpdateStatementStageDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ): Promise<UpdateStatementStageResultDto> {
    return this.statementStageService.updateStage(
      dto.statementIds,
      dto.stage,
      user.id,
      workspaceId,
    );
  }

  @Post(':id/trash')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_DELETE)
  async moveToTrash(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.moveToTrash(id, user.id, workspaceId);
  }

  @Post(':id/restore')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async restoreFile(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.restoreFile(id, user.id, workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @Audit({ entityType: EntityType.STATEMENT, includeDiff: true, isUndoable: true })
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStatementDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.updateMetadata(id, user.id, workspaceId, updateDto);
  }

  @Post(':id/convert-dropped-sample')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async convertDroppedSample(
    @Param('id') id: string,
    @Body() payload: ConvertDroppedSampleDto,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.convertDroppedSampleToTransaction(
      id,
      user.id,
      workspaceId,
      payload,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceAuth(Permission.STATEMENT_DELETE)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('permanent') permanent?: string,
  ) {
    const isPermanent = permanent === 'true';
    if (isPermanent) {
      await this.statementsService.permanentDelete(id, user.id, workspaceId);
    } else {
      await this.statementsService.moveToTrash(id, user.id, workspaceId);
    }
  }

  @Post(':id/reprocess')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async reprocess(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query('mode') mode?: 'merge' | 'replace',
  ) {
    // Default to 'merge' mode to preserve user edits
    const reprocessMode = mode || 'merge';
    return this.statementsService.reprocess(id, user.id, workspaceId, reprocessMode);
  }

  @Post(':id/commit-import')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async commitImport(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.commitImport(id, user.id, workspaceId);
  }

  @Post(':id/confirm-balance')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  async confirmBalance(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.statementsService.confirmBalance(id, user.id, workspaceId);
  }
}
