import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { withoutNulls } from '../../common/effect/without-nulls';
import { Permission } from '../../common/enums/permissions.enum';
import { appError } from '../../common/errors/app-error';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { toCaptureLocation } from '../../common/utils/capture-location.util';
import {
  assertReceiptFileSupported,
  unlinkAll,
  validateFile,
  validateFiles,
} from '../../common/utils/file-validator.util';
import { multerConfig } from '../../config/multer.config';
import {
  CreateManualExpenseBody,
  StatementParams,
  UploadReceiptScanBody,
  UploadStatementBody,
} from '../../contracts';
import {
  ManualExpenseCreated,
  ReceiptScanStatements,
  StatementLegacyUploadResult,
  StatementUploadResult,
  StatementWritten,
} from '../../contracts/statements/statement-writes';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReceiptStatementService } from './services/receipt-statement.service';
import { StatementsService } from './statements.service';

/** Files coming in: statements, manual expenses, receipt scans, a file attached to a statement. */
@Controller('statements')
@UseInterceptors(HideInternalColumnsInterceptor)
export class StatementUploadsController {
  constructor(
    private readonly statementsService: StatementsService,
    private readonly receiptStatementService: ReceiptStatementService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private toObjectRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
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
  @SchemaResponse(StatementLegacyUploadResult)
  async uploadLegacy(
    @UploadedFiles() files: Express.Multer.File[],
    @SchemaBody(UploadStatementBody) uploadDto: UploadStatementBody,
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
  @SchemaResponse(StatementUploadResult)
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @SchemaBody(UploadStatementBody) uploadDto: UploadStatementBody,
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
  @SchemaResponse(ManualExpenseCreated)
  async createManualExpense(
    @UploadedFiles() files: Express.Multer.File[],
    @SchemaBody(CreateManualExpenseBody) payload: CreateManualExpenseBody,
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
  @SchemaResponse(ReceiptScanStatements)
  async uploadReceipt(
    @UploadedFiles() files: Express.Multer.File[],
    @SchemaBody(UploadReceiptScanBody) body: UploadReceiptScanBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException(appError('UPLOAD_NO_FILES'));
    }

    try {
      for (const file of files) {
        validateFile(file, { allowEInvoiceXml: true });
        assertReceiptFileSupported(file);
      }
    } catch (error) {
      await unlinkAll(files);
      throw error;
    }

    const data = await this.receiptStatementService.createFromReceiptScan({
      user,
      workspaceId,
      files,
      language: body?.language ?? undefined,
      captureLocation: toCaptureLocation(body && withoutNulls(body)),
    });

    return { data };
  }

  @Post(':id/attach-file')
  @HttpCode(HttpStatus.OK)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @Audit({ entityType: EntityType.STATEMENT, includeDiff: true, isUndoable: true })
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @SchemaResponse(StatementWritten)
  async attachFile(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @UploadedFile() file: unknown,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    if (!this.isUploadedFile(file)) {
      throw new BadRequestException(appError('UPLOAD_NO_FILE'));
    }

    await validateFiles([file]);
    return this.statementsService.attachFile(id, user.id, workspaceId, file);
  }

  private async handleUpload(
    files: Express.Multer.File[],
    uploadDto: UploadStatementBody,
    user: User,
    workspaceId: string,
    idempotencyKey: string | undefined,
    returnUnwrappedSingle: boolean,
  ) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException(appError('UPLOAD_NO_FILES'));
    }

    if (files.length > 2) {
      throw new BadRequestException(appError('STATEMENT_UPLOAD_TOO_MANY_FILES'));
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
}
