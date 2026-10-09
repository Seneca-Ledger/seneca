import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { runExecutable } from '../../common/utils/thumbnail-command.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import {
  Category,
  GmailSettings,
  IntegrationStatus,
  Receipt,
  ReceiptSource,
  ReceiptStatus,
  StatementStage,
  Transaction,
  TransactionType,
  User,
} from '../../entities';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { attachReceiptCategories } from '../receipts/helpers/attach-receipt-categories';
import { ReceiptsService } from '../receipts/receipts.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { BulkApproveDto } from './dto/bulk-approve.dto';
import { ExportXlsxDto } from './dto/export-xlsx.dto';
import { MarkDuplicateDto } from './dto/mark-duplicate.dto';
import { ReparseMerchantsDto } from './dto/reparse-merchants.dto';
import { UpdateGmailSettingsDto } from './dto/update-gmail-settings.dto';
import { UpdateParsedDataDto } from './dto/update-parsed-data.dto';
import { ApproveReceiptDto, UpdateReceiptDto } from './dto/update-receipt.dto';
import type { GmailApi } from './gmail-api.types';
import { GmailService } from './services/gmail.service';
import { GmailMerchantReparseService } from './services/gmail-merchant-reparse.service';
import { GmailOAuthService } from './services/gmail-oauth.service';
import { GmailReceiptCategoryService } from './services/gmail-receipt-category.service';
import { GmailReceiptDuplicateService } from './services/gmail-receipt-duplicate.service';
import { GmailReceiptExportService } from './services/gmail-receipt-export.service';
import { GmailSyncService } from './services/gmail-sync.service';
import { GmailWatchService } from './services/gmail-watch.service';

const AMOUNT_PRESENT_SQL = "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL";
const AMOUNT_MISSING_SQL = "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NULL";

type ReceiptAttachment = NonNullable<NonNullable<Receipt['metadata']>['attachments']>[number];

interface ReceiptPreviewAttachmentData {
  filename: string;
  mimeType: string;
  size: number;
  data: string;
}

interface BulkApproveError {
  receiptId: string;
  error: string;
}

const inferMimeTypeFromPath = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
};

@ApiTags('Gmail Integration')
@Controller('integrations/gmail')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GmailController {
  private readonly logger = new Logger(GmailController.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(GmailSettings)
    private readonly gmailSettingsRepository: Repository<GmailSettings>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly gmailOAuthService: GmailOAuthService,
    private readonly gmailService: GmailService,
    private readonly gmailWatchService: GmailWatchService,
    private readonly gmailSyncService: GmailSyncService,
    private readonly duplicateService: GmailReceiptDuplicateService,
    private readonly categoryService: GmailReceiptCategoryService,
    private readonly exportService: GmailReceiptExportService,
    private readonly merchantReparseService: GmailMerchantReparseService,
    private readonly receiptsService: ReceiptsService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
  ) {}

  private resolveAttachmentPath(storedPath: string): string {
    if (path.isAbsolute(storedPath)) {
      return storedPath;
    }
    return path.join(resolveUploadsDir(), storedPath);
  }

  private async ensureAttachmentOnDisk(receipt: Receipt): Promise<string | null> {
    const storedPath = (receipt.attachmentPaths || []).find(Boolean);
    if (!storedPath) {
      return null;
    }

    const resolvedPath = this.resolveAttachmentPath(storedPath);

    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
      return resolvedPath;
    } catch {
      // File missing from disk — try to re-download from Gmail API
    }

    const attachmentMeta = receipt.metadata?.attachments?.[0];
    if (!attachmentMeta?.id) {
      this.logger.warn(`No attachment metadata to re-download for receipt ${receipt.id}`);
      return null;
    }

    try {
      const newPath = await this.gmailService.downloadAttachment(
        receipt.workspaceId,
        receipt.gmailMessageId,
        attachmentMeta.id,
        attachmentMeta.filename,
      );
      // Update stored path so future requests don't need re-download
      receipt.attachmentPaths = [newPath];
      await this.receiptRepository.update(receipt.id, { attachmentPaths: [newPath] });
      this.logger.log(`Re-downloaded attachment for receipt ${receipt.id} to ${newPath}`);
      return newPath;
    } catch (error) {
      this.logger.error(`Failed to re-download attachment for receipt ${receipt.id}:`, error);
      return null;
    }
  }

  private getValidationIssues(parsedData: Receipt['parsedData'] | null | undefined): string[] {
    return Array.isArray(parsedData?.validationIssues) ? parsedData.validationIssues : [];
  }

  private findMessageBody(part?: GmailApi.MessagePart): string {
    if (!part) {
      return '';
    }

    if (part.mimeType === 'text/html' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }

    if (Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        const body = this.findMessageBody(subPart);
        if (body) {
          return body;
        }
      }
    }

    return '';
  }

  @Get('status')
  @UseGuards(WorkspaceContextGuard)
  @ApiOperation({ summary: 'Get Gmail integration status' })
  async getStatus(@WorkspaceId() workspaceId: string) {
    const integration = await this.gmailOAuthService.findWorkspaceIntegration(workspaceId);

    if (!integration) {
      return {
        connected: false,
        status: 'disconnected',
      };
    }

    const connected = integration.status === IntegrationStatus.CONNECTED;

    return {
      connected,
      status: integration.status,
      settings: integration.gmailSettings,
      scopes: integration.scopes,
    };
  }

  @Get('connect')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Get Gmail OAuth URL' })
  getConnectUrl(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    const authUrl = this.gmailOAuthService.getAuthUrl(user, workspaceId);
    return { url: authUrl };
  }

  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Handle Gmail OAuth callback' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const result = await this.gmailOAuthService.handleCallback({
      code,
      state,
      error,
    });

    // If integration was created successfully, set up Gmail environment
    if (result.integration?.connectedByUserId) {
      try {
        await this.gmailService.setupGmailEnvironment(result.integration);

        // Start watch
        await this.gmailWatchService.setupWatch(result.integration);
      } catch (setupError) {
        console.error('Failed to setup Gmail environment or watch:', setupError);
      }
    }

    return res.redirect(result.redirectUrl);
  }

  @Post('disconnect')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Disconnect Gmail integration' })
  async disconnect(@WorkspaceId() workspaceId: string) {
    const integration = await this.gmailOAuthService.ensureWorkspaceIntegration(workspaceId);

    if (integration.connectedByUserId) {
      // Stop watch
      try {
        await this.gmailWatchService.stopWatch(integration);
      } catch (error) {
        console.error('Failed to stop watch:', error);
      }
    }

    await this.gmailOAuthService.disconnect(workspaceId);

    return { success: true, message: 'Gmail integration disconnected' };
  }

  @Post('sync')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Trigger manual Gmail sync' })
  async triggerSync(@WorkspaceId() workspaceId: string) {
    try {
      const result = await this.gmailSyncService.syncForWorkspace(workspaceId);

      return {
        success: true,
        messagesFound: result.messagesFound,
        jobsCreated: result.jobsCreated,
        skipped: result.skipped,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error) {
      this.logger.error('Manual sync failed', error);
      throw new BadRequestException(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Post('settings')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Update Gmail settings' })
  async updateSettings(@WorkspaceId() workspaceId: string, @Body() dto: UpdateGmailSettingsDto) {
    const integration = await this.gmailOAuthService.ensureWorkspaceIntegration(workspaceId);

    if (!integration.gmailSettings) {
      throw new BadRequestException('Gmail settings not found');
    }

    const settings = integration.gmailSettings;

    if (dto.labelName !== undefined) {
      settings.labelName = dto.labelName;
    }
    if (dto.filterEnabled !== undefined) {
      settings.filterEnabled = dto.filterEnabled;
    }
    if (dto.subjects || dto.senders || dto.hasAttachment !== undefined || dto.keywords) {
      settings.filterConfig = {
        subjects: dto.subjects || settings.filterConfig?.subjects,
        senders: dto.senders || settings.filterConfig?.senders,
        hasAttachment: dto.hasAttachment ?? settings.filterConfig?.hasAttachment,
        keywords: dto.keywords || settings.filterConfig?.keywords,
      };
    }

    await this.gmailSettingsRepository.save(settings);

    return { success: true, settings };
  }

  @Get('receipts')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'List receipts' })
  async listReceipts(
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
    const includeInvalidReceipts = this.parseBooleanQuery(includeInvalid, false);
    const hasAmountFilter = this.parseOptionalBooleanQuery(hasAmount);
    const includeLinkedScanReceipts = this.parseBooleanQuery(includeLinkedScans, false);

    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .where('receipt.workspaceId = :workspaceId', { workspaceId })
      .orderBy('receipt.receivedAt', 'DESC');

    if (!includeInvalidReceipts) {
      queryBuilder.andWhere('receipt.status != :failedStatus', {
        failedStatus: ReceiptStatus.FAILED,
      });
    }

    if (hasAmountFilter === true) {
      queryBuilder.andWhere(AMOUNT_PRESENT_SQL);
    } else if (hasAmountFilter === false) {
      queryBuilder.andWhere(AMOUNT_MISSING_SQL);
    } else if (!(includeInvalidReceipts || status)) {
      // When browsing without an explicit status filter, hide receipts with no parsed amount
      // to reduce noise. When a status is explicitly requested (e.g. needs_review), show all.
      // A scan the user uploaded already has its statement, so the statements list keeps it
      // on request even without an amount; it shows there as needing review.
      if (includeLinkedScanReceipts) {
        queryBuilder.andWhere(
          `(${AMOUNT_PRESENT_SQL} OR (receipt.source = :scanSource AND receipt.statement_id IS NOT NULL))`,
          { scanSource: ReceiptSource.SCAN },
        );
      } else {
        queryBuilder.andWhere(AMOUNT_PRESENT_SQL);
      }
    }

    if (status) {
      queryBuilder.andWhere('receipt.status = :status', { status });
    }

    // The Submit and Approve pages list only receipts in their own stage.
    if (stage && (Object.values(StatementStage) as string[]).includes(stage)) {
      queryBuilder.andWhere('receipt.stage = :stage', { stage });
    }

    if (categoryId) {
      queryBuilder.leftJoin('receipt.transaction', 'transaction');

      if (categoryId === 'uncategorized') {
        queryBuilder.andWhere(
          "COALESCE(NULLIF(receipt.parsed_data ->> 'categoryId', ''), transaction.category_id::text) IS NULL",
        );
      } else {
        queryBuilder.andWhere(
          "(transaction.category_id = :categoryId OR receipt.parsed_data ->> 'categoryId' = :categoryId)",
          { categoryId },
        );
      }
    }

    const take = Math.min(Number.parseInt(limit || '50'), 100);
    const skip = Number.parseInt(offset || '0');

    const [receipts, total] = await queryBuilder.take(take).skip(skip).getManyAndCount();

    return {
      // The picked category lives in `parsedData.categoryId`; the list renders
      // its name, so it is resolved here rather than by every caller.
      receipts: await attachReceiptCategories(receipts, this.categoryRepository, workspaceId),
      total,
      limit: take,
      offset: skip,
    };
  }

  @Patch('receipts/:id')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Update receipt' })
  async updateReceipt(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    if (dto.status) {
      receipt.status = dto.status;
    }
    if (dto.parsedData) {
      receipt.parsedData = { ...receipt.parsedData, ...dto.parsedData };
    }

    await this.receiptRepository.save(receipt);
    if (dto.parsedData) {
      await this.syncLinkedTransaction(receipt);
    }

    return receipt;
  }

  @Post('receipts/:id/approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Approve receipt and create transaction' })
  async approveReceipt(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: ApproveReceiptDto,
  ) {
    // A repeated approve returns the transaction the first one created.
    const currency = await this.workspaceCurrency.resolveFor(workspaceId, dto.currency);
    const result = await this.receiptsService.approveOnce(id, workspaceId, receipt => ({
      statementId: null,
      workspaceId,
      transactionDate: new Date(dto.date),
      counterpartyName: dto.description || receipt.parsedData?.vendor || 'Unknown',
      paymentPurpose: dto.description || receipt.parsedData?.vendor || '',
      amount: dto.amount,
      currency,
      categoryId: dto.categoryId || receipt.parsedData?.categoryId || null,
      transactionType: TransactionType.EXPENSE,
    }));

    if (!result) {
      throw new BadRequestException('Receipt not found');
    }

    return {
      receipt: result.receipt,
      transaction: result.transaction,
    };
  }

  @Get('receipts/:id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'Get single receipt with details' })
  async getReceipt(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
      relations: ['transaction', 'duplicateOf'],
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    // Find potential duplicates
    const potentialDuplicates = await this.duplicateService.findPotentialDuplicates(receipt);

    // Suggest category
    const suggestedCategory = await this.categoryService.suggestCategory(receipt);

    // Ensure categoryId is in parsedData if suggested
    if (suggestedCategory && receipt.parsedData && !receipt.parsedData.categoryId) {
      receipt.parsedData.categoryId = suggestedCategory.id;
    }

    return {
      receipt,
      potentialDuplicates,
      suggestedCategory,
    };
  }

  @Patch('receipts/:id/parsed-data')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Update parsed receipt data' })
  async updateParsedData(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateParsedDataDto,
  ) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    const hadAmountBeforeUpdate = this.hasReceiptAmount(receipt.parsedData?.amount);

    // Update parsed data
    receipt.parsedData = {
      ...receipt.parsedData,
      ...dto,
    };

    const validationIssues = this.getValidationIssues(receipt.parsedData);
    const hasAmount = this.hasReceiptAmount(receipt.parsedData?.amount);

    if (hasAmount && !hadAmountBeforeUpdate && receipt.status === ReceiptStatus.NEEDS_REVIEW) {
      const nextIssues = validationIssues.filter(issue => issue !== 'missing_amount');
      receipt.parsedData = {
        ...receipt.parsedData,
        validationIssues: nextIssues.length > 0 ? nextIssues : undefined,
      };

      const hasPotentialDuplicates =
        Array.isArray(receipt.metadata?.potentialDuplicates) &&
        receipt.metadata.potentialDuplicates.length > 0;

      if (!hasPotentialDuplicates) {
        receipt.status = ReceiptStatus.DRAFT;
      }
    }

    // Update tax amount if provided
    if (dto.tax !== undefined) {
      receipt.taxAmount = dto.tax;
    }

    await this.receiptRepository.save(receipt);
    await this.syncLinkedTransaction(receipt);

    return receipt;
  }

  @Post('receipts/:id/mark-duplicate')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Mark receipt as duplicate' })
  async markDuplicate(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Body() dto: MarkDuplicateDto,
  ) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    await this.duplicateService.markAsDuplicate(id, dto.originalReceiptId, workspaceId);

    return await this.receiptRepository.findOne({
      where: { id, workspaceId },
      relations: ['duplicateOf'],
    });
  }

  @Post('receipts/:id/unmark-duplicate')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Unmark receipt as duplicate' })
  async unmarkDuplicate(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    await this.duplicateService.unmarkDuplicate(id, workspaceId);

    return await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });
  }

  @Post('receipts/bulk-approve')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Approve multiple receipts at once' })
  async bulkApprove(@WorkspaceId() workspaceId: string, @Body() dto: BulkApproveDto) {
    // Resolved once for the whole batch: receipts whose parse found no currency
    // are booked in the workspace's own.
    const workspaceDefaultCurrency = await this.workspaceCurrency.resolve(workspaceId);
    const results: {
      approved: number;
      failed: number;
      errors: BulkApproveError[];
    } = {
      approved: 0,
      failed: 0,
      errors: [],
    };

    for (const receiptId of dto.receiptIds) {
      try {
        const receipt = await this.receiptRepository.findOne({
          where: { id: receiptId, workspaceId },
        });

        if (!receipt) {
          results.failed++;
          results.errors.push({ receiptId, error: 'Receipt not found' });
          continue;
        }

        if (!(receipt.parsedData?.amount && receipt.parsedData?.date)) {
          results.failed++;
          results.errors.push({ receiptId, error: 'Missing required data' });
          continue;
        }

        const approved = await this.receiptsService.approveOnce(receiptId, workspaceId, locked => ({
          statementId: null,
          workspaceId,
          transactionDate: new Date(locked.parsedData?.date ?? receipt.parsedData.date),
          counterpartyName: locked.parsedData?.vendor || locked.subject || 'Unknown',
          paymentPurpose: locked.parsedData?.vendor || locked.subject || '',
          amount: locked.parsedData?.amount ?? receipt.parsedData.amount,
          currency: locked.parsedData?.currency || workspaceDefaultCurrency,
          categoryId: dto.categoryId || locked.parsedData?.categoryId || null,
          transactionType: TransactionType.EXPENSE,
        }));
        if (!approved) {
          results.failed++;
          results.errors.push({ receiptId, error: 'Receipt not found' });
          continue;
        }

        results.approved++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          receiptId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  @Post('receipts/export-xlsx')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'Export receipts to an Excel (.xlsx) file' })
  async exportToXlsx(@WorkspaceId() workspaceId: string, @Body() dto: ExportXlsxDto) {
    try {
      const result = await this.exportService.exportToXlsx(workspaceId, dto.receiptIds);
      return result;
    } catch (error) {
      throw new BadRequestException(
        `Failed to export to xlsx: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Post('receipts/:id/export-draft')
  @WorkspaceAuth(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Export receipt as Gmail draft' })
  async exportToDraft(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    try {
      const result = await this.exportService.createGmailDraft(workspaceId, id);
      return { success: true, data: result };
    } catch (error) {
      throw new BadRequestException(
        `Failed to create Gmail draft: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @Post('receipts/reparse-merchants')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'Reparse merchant names for existing receipts' })
  async reparseMerchants(@WorkspaceId() workspaceId: string, @Body() dto: ReparseMerchantsDto) {
    return this.merchantReparseService.reparseAll(workspaceId, {
      dryRun: dto.dryRun,
      limit: dto.limit,
    });
  }

  @Get('receipts/:id/thumbnail')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'Get receipt PDF thumbnail' })
  async getReceiptThumbnail(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Query('width') width: string | undefined,
    @Res() res: Response,
  ) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Receipt not found' });
    }

    const normalizedWidth = Number.isFinite(Number(width)) ? Math.round(Number(width)) : 200;
    const thumbnailWidth = Math.min(1600, Math.max(80, normalizedWidth));
    const cacheVersion = receipt.updatedAt?.getTime?.() ?? 0;
    const cacheKey = `receipts:thumbnail:${id}:${cacheVersion}:${thumbnailWidth}`;
    const cached = await this.cacheManager.get<string>(cacheKey);

    if (cached) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(Buffer.from(cached, 'base64'));
    }

    const attachmentPath = await this.ensureAttachmentOnDisk(receipt);

    if (!attachmentPath) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'No attachment found' });
    }

    const attachmentFileName = path.basename(attachmentPath);
    const attachmentMeta = receipt.metadata?.attachments?.find(
      attachment => attachment.filename === attachmentFileName,
    );
    const mimeType = attachmentMeta?.mimeType || inferMimeTypeFromPath(attachmentPath);

    if (mimeType.startsWith('image/')) {
      try {
        const imageData = await fs.promises.readFile(attachmentPath);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=604800');
        return res.send(imageData);
      } catch (error) {
        this.logger.error(`Failed to read receipt image thumbnail for ${id}:`, error);
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          error: {
            code: 'THUMBNAIL_GENERATION_FAILED',
            message: 'Failed to generate thumbnail',
          },
        });
      }
    }

    const pdfPath = attachmentPath.toLowerCase().endsWith('.pdf') ? attachmentPath : null;

    if (!pdfPath) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'No PDF attachment found' });
    }

    let thumbnailPath: string | null = null;

    try {
      thumbnailPath = path.join('/tmp', `receipt-thumbnail-${id}-${Date.now()}.png`);
      const scriptPath = path.join(__dirname, '../../../scripts/generate-thumbnail.py');
      await runExecutable('python3', [scriptPath, pdfPath, thumbnailPath, String(thumbnailWidth)]);

      const thumbnailData = await fs.promises.readFile(thumbnailPath);
      await this.cacheManager.set(cacheKey, thumbnailData.toString('base64'), 604800);

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(thumbnailData);
    } catch (error) {
      this.logger.error(`Thumbnail generation error for receipt ${id}:`, error);
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.setHeader('Retry-After', '60');
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'THUMBNAIL_GENERATION_FAILED',
          message: 'Failed to generate thumbnail',
        },
      });
    } finally {
      if (thumbnailPath) {
        try {
          await fs.promises.unlink(thumbnailPath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  @Get('receipts/:id/file')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'Get receipt PDF file' })
  async getReceiptFile(
    @WorkspaceId() workspaceId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'Receipt not found' });
    }

    const attachmentPath = await this.ensureAttachmentOnDisk(receipt);

    if (!attachmentPath) {
      return res.status(HttpStatus.NOT_FOUND).json({ error: 'No attachment found' });
    }

    try {
      const fileBuffer = await fs.promises.readFile(attachmentPath);
      const fileName = path.basename(attachmentPath);
      const attachmentMeta = receipt.metadata?.attachments?.find(
        attachment => attachment.filename === fileName,
      );
      const mimeType = attachmentMeta?.mimeType || inferMimeTypeFromPath(attachmentPath);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('Cache-Control', 'private, max-age=600');
      return res.send(fileBuffer);
    } catch (error) {
      this.logger.error(`Failed to read receipt PDF for ${id}:`, error);
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        error: {
          code: 'RECEIPT_FILE_UNAVAILABLE',
          message: 'Failed to load receipt file',
        },
      });
    }
  }

  @Get('receipts/:id/preview')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @ApiOperation({ summary: 'Get receipt preview (email body or attachment)' })
  async getReceiptPreview(@WorkspaceId() workspaceId: string, @Param('id') id: string) {
    const receipt = await this.receiptRepository.findOne({
      where: { id, workspaceId },
    });

    if (!receipt) {
      throw new BadRequestException('Receipt not found');
    }

    // Get Gmail message
    const message = await this.gmailService.getMessage(receipt.workspaceId, receipt.gmailMessageId);

    // Extract email body
    const emailBody = this.findMessageBody(message.payload || undefined);

    // Fetch attachment data if available
    const attachments: ReceiptAttachment[] = receipt.metadata?.attachments || [];
    const attachmentData: ReceiptPreviewAttachmentData[] = [];

    if (attachments.length > 0) {
      for (const attachment of attachments) {
        try {
          const data = await this.gmailService.getAttachmentData(
            receipt.workspaceId,
            receipt.gmailMessageId,
            attachment.id,
          );

          if (data) {
            // Return base64 data for client-side rendering
            attachmentData.push({
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              size: attachment.size,
              data, // base64url encoded
            });
          }
        } catch (error) {
          this.logger.error(`Failed to fetch attachment ${attachment.filename}`, error);
        }
      }
    }

    return {
      emailBody,
      attachments: receipt.metadata?.attachments || [],
      attachmentData, // Include actual attachment data
      snippet: receipt.metadata?.snippet,
    };
  }

  private parseBooleanQuery(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const normalized = value.toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }

    return fallback;
  }

  private parseOptionalBooleanQuery(value: string | undefined): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return this.parseBooleanQuery(value, false);
  }

  /** Keeps the transaction created on approve in sync with later receipt edits. */
  private async syncLinkedTransaction(receipt: Receipt): Promise<void> {
    if (!receipt.transactionId) {
      return;
    }
    const transaction = await this.transactionRepository.findOne({
      where: { id: receipt.transactionId, workspaceId: receipt.workspaceId },
    });
    if (!transaction) {
      return;
    }
    const { amount, currency, vendor, date, categoryId } = receipt.parsedData ?? {};
    if (amount !== undefined) {
      transaction.amount = amount;
    }
    if (currency) {
      transaction.currency = currency;
    }
    if (vendor) {
      transaction.counterpartyName = vendor;
      transaction.paymentPurpose = vendor;
    }
    if (date) {
      transaction.transactionDate = new Date(date);
    }
    if (categoryId) {
      transaction.categoryId = categoryId;
    }
    await this.transactionRepository.save(transaction);
  }

  private hasReceiptAmount(value: unknown): boolean {
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return false;
      }
      return Number.isFinite(Number(normalized));
    }

    return false;
  }
}
