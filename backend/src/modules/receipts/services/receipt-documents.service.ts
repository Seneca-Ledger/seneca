import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { runExecutable } from '../../../common/utils/thumbnail-command.util';
import { resolveInUploadsDir, resolveUploadsDir } from '../../../common/utils/uploads.util';
import { Category, Receipt, ReceiptSource, ReceiptStatus, StatementStage } from '../../../entities';
import { attachReceiptCategories } from '../helpers/attach-receipt-categories';

const AMOUNT_PRESENT_SQL = "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL";
const AMOUNT_MISSING_SQL = "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NULL";

export interface ReceiptDocumentsFilter {
  status?: string;
  limit?: string;
  offset?: string;
  includeInvalid?: string;
  hasAmount?: string;
  categoryId?: string;
  includeLinkedScans?: string;
  stage?: string;
}

export type ReceiptThumbnail =
  | { kind: 'image'; mimeType: string; data: Buffer }
  | { kind: 'missing'; error: string }
  | { kind: 'failed' };

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

const parseBooleanQuery = (value: string | undefined, fallback: boolean): boolean => {
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
};

const parseOptionalBooleanQuery = (value: string | undefined): boolean | undefined =>
  value === undefined || value === null || value === ''
    ? undefined
    : parseBooleanQuery(value, false);

/** The receipts the Documents list, analytics and the receipt previews read. */
@Injectable()
export class ReceiptDocumentsService {
  private readonly logger = new Logger(ReceiptDocumentsService.name);

  constructor(
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async list(workspaceId: string, filter: ReceiptDocumentsFilter) {
    const includeInvalidReceipts = parseBooleanQuery(filter.includeInvalid, false);
    const hasAmountFilter = parseOptionalBooleanQuery(filter.hasAmount);
    const includeLinkedScanReceipts = parseBooleanQuery(filter.includeLinkedScans, false);
    const { status, stage, categoryId } = filter;

    const queryBuilder = this.receiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.tags', 'tags')
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

    const take = Math.min(Number.parseInt(filter.limit || '50', 10), 100);
    const skip = Number.parseInt(filter.offset || '0', 10);

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

  async thumbnail(id: string, workspaceId: string, width: string): Promise<ReceiptThumbnail> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return { kind: 'missing', error: 'Receipt not found' };
    }

    const normalizedWidth = Number.isFinite(Number(width)) ? Math.round(Number(width)) : 200;
    const thumbnailWidth = Math.min(1600, Math.max(80, normalizedWidth));
    const cacheVersion = receipt.updatedAt?.getTime?.() ?? 0;
    const cacheKey = `receipts:thumbnail:${id}:${cacheVersion}:${thumbnailWidth}`;
    const cached = await this.cacheManager.get<string>(cacheKey);

    if (cached) {
      return { kind: 'image', mimeType: 'image/png', data: Buffer.from(cached, 'base64') };
    }

    const attachmentPath = await this.attachmentOnDisk(receipt);
    if (!attachmentPath) {
      return { kind: 'missing', error: 'No attachment found' };
    }

    const attachmentFileName = path.basename(attachmentPath);
    const attachmentMeta = receipt.metadata?.attachments?.find(
      attachment => attachment.filename === attachmentFileName,
    );
    const mimeType = attachmentMeta?.mimeType || inferMimeTypeFromPath(attachmentPath);

    if (mimeType.startsWith('image/')) {
      try {
        return { kind: 'image', mimeType, data: await fs.promises.readFile(attachmentPath) };
      } catch (error) {
        this.logger.error(`Failed to read receipt image thumbnail for ${id}:`, error);
        return { kind: 'failed' };
      }
    }

    if (!attachmentPath.toLowerCase().endsWith('.pdf')) {
      return { kind: 'missing', error: 'No PDF attachment found' };
    }

    // Named by the server, not the request: nothing from the URL reaches the file system.
    const thumbnailPath = path.join(os.tmpdir(), `receipt-thumbnail-${randomUUID()}.png`);
    try {
      const scriptPath = path.join(__dirname, '../../../../scripts/generate-thumbnail.py');
      await runExecutable('python3', [
        scriptPath,
        attachmentPath,
        thumbnailPath,
        String(thumbnailWidth),
      ]);

      const thumbnailData = await fs.promises.readFile(thumbnailPath);
      await this.cacheManager.set(cacheKey, thumbnailData.toString('base64'), 604800);
      return { kind: 'image', mimeType: 'image/png', data: thumbnailData };
    } catch (error) {
      this.logger.error(`Thumbnail generation error for receipt ${id}:`, error);
      return { kind: 'failed' };
    } finally {
      try {
        await fs.promises.unlink(thumbnailPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private async attachmentOnDisk(receipt: Receipt): Promise<string | null> {
    const storedPath = (receipt.attachmentPaths || []).find(Boolean);
    if (!storedPath) {
      return null;
    }
    // NULL when the stored path points outside the uploads directory.
    const uploadsDir = resolveUploadsDir();
    const resolvedPath = resolveInUploadsDir(
      path.isAbsolute(storedPath) ? storedPath : path.join(uploadsDir, storedPath),
      path.resolve(uploadsDir),
    );
    if (!resolvedPath) {
      return null;
    }
    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
      return resolvedPath;
    } catch {
      return null;
    }
  }
}
