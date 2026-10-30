import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { sanitizeArchiveEntryName } from '../../common/utils/filename.util';
import { runExecutable } from '../../common/utils/thumbnail-command.util';
import { FileType, type Statement } from '../../entities/statement.entity';

/**
 * A document's stored file: streamed back, drawn as a thumbnail, or packed
 * with the others into a ZIP. Callers load the statement (and check it is the
 * workspace's) first.
 */
@Injectable()
export class StatementFilesService {
  private readonly logger = new Logger(StatementFilesService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async fileStream(statement: Statement): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    const { stream, fileName, mimeType } =
      await this.fileStorageService.getStatementFileStream(statement);
    return { stream, fileName, mimeType };
  }

  private async generateThumbnailWithPython(
    pdfPath: string,
    thumbnailPath: string,
    thumbnailWidth: number,
  ): Promise<void> {
    const scriptPath = path.join(__dirname, '../../../scripts/generate-thumbnail.py');
    await runExecutable('python3', [scriptPath, pdfPath, thumbnailPath, String(thumbnailWidth)]);
  }

  private async generateThumbnailWithQuickLook(
    pdfPath: string,
    outputDir: string,
    thumbnailWidth: number,
  ): Promise<string> {
    await runExecutable('qlmanage', ['-t', '-s', String(thumbnailWidth), '-o', outputDir, pdfPath]);
    const generatedPath = path.join(outputDir, `${path.basename(pdfPath)}.png`);
    if (!fs.existsSync(generatedPath)) {
      throw new Error('Quick Look thumbnail output not found');
    }
    return generatedPath;
  }

  async thumbnail(statement: Statement, requestedWidth?: number): Promise<Buffer> {
    const id = statement.id;

    const normalizedWidth = Number.isFinite(requestedWidth ?? Number.NaN)
      ? Math.round(requestedWidth ?? 200)
      : 200;
    const thumbnailWidth = Math.min(1600, Math.max(80, normalizedWidth));

    const cacheVersion = statement.updatedAt?.getTime?.() ?? 0;
    const cacheKey = `statements:thumbnail:${id}:${cacheVersion}:${thumbnailWidth}`;
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      return Buffer.from(cached, 'base64');
    }

    // Check if file is PDF
    if (statement.fileType !== 'pdf' && !statement.fileName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException(appError('STATEMENT_THUMBNAIL_PDF_ONLY'));
    }

    // Determine source file path
    let pdfPath: string | null = null;
    let tempPdfPath: string | null = null;

    if (statement.filePath && fs.existsSync(statement.filePath)) {
      // Use existing file on disk
      pdfPath = statement.filePath;
    } else if (statement.fileData) {
      // Write data to temporary file
      tempPdfPath = path.join('/tmp', `temp-${statement.id}-${Date.now()}.pdf`);
      await fs.promises.writeFile(tempPdfPath, statement.fileData);
      pdfPath = tempPdfPath;
    }

    if (!pdfPath) {
      throw new NotFoundException(appError('STATEMENT_FILE_DATA_UNAVAILABLE'));
    }

    try {
      // Generate thumbnail using Python script
      const thumbnailPath = path.join('/tmp', `thumbnail-${statement.id}-${Date.now()}.png`);
      let generatedThumbnailPath = thumbnailPath;

      try {
        await this.generateThumbnailWithPython(pdfPath, thumbnailPath, thumbnailWidth);
      } catch (pythonError) {
        if (process.platform !== 'darwin') {
          throw pythonError;
        }
        generatedThumbnailPath = await this.generateThumbnailWithQuickLook(
          pdfPath,
          '/tmp',
          thumbnailWidth,
        );
      }

      // Read generated thumbnail
      const thumbnailData = await fs.promises.readFile(generatedThumbnailPath);

      // Cache the thumbnail (1 week)
      await this.cacheManager.set(cacheKey, thumbnailData.toString('base64'), 604800);

      // Clean up temporary files
      try {
        await fs.promises.unlink(generatedThumbnailPath);
        if (tempPdfPath) {
          await fs.promises.unlink(tempPdfPath);
        }
      } catch (cleanupError) {
        this.logger.warn('Error cleaning up temporary files:', cleanupError);
      }

      return thumbnailData;
    } catch (error) {
      // Clean up temp PDF if it was created
      if (tempPdfPath) {
        try {
          await fs.promises.unlink(tempPdfPath);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      this.logger.error('Error generating thumbnail:', error);
      throw new BadRequestException(appError('STATEMENT_THUMBNAIL_FAILED'));
    }
  }

  async exportZip(statements: Statement[], outputStream: NodeJS.WritableStream): Promise<void> {
    const archive = new ZipArchive({ zlib: { level: 5 } });
    archive.pipe(outputStream);

    for (const statement of statements) {
      try {
        const { stream, fileName } =
          await this.fileStorageService.getStatementFileStream(statement);
        const isReceipt = statement.fileType === FileType.IMAGE || !statement.bankName;
        const folder = isReceipt ? 'receipts' : (statement.bankName ?? 'other');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const safeFolder = sanitizeArchiveEntryName(folder);
        const safeFileName = sanitizeArchiveEntryName(fileName);
        archive.append(stream as any, { name: `${safeFolder}/${safeFileName}` });
      } catch {
        // Skip files that cannot be retrieved
      }
    }

    await archive.finalize();
  }
}
