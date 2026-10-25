import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { validateFile } from '../../../common/utils/file-validator.util';
import { resolveUploadsDir } from '../../../common/utils/uploads.util';
import { Transaction } from '../../../entities/transaction.entity';
import { TransactionAttachment } from '../../../entities/transaction-attachment.entity';

/** Subdirectory of the uploads dir that holds every transaction attachment. */
const ATTACHMENTS_SUBDIR = 'transaction-attachments';

export interface AttachmentDownload {
  absolutePath: string;
  fileName: string;
  mimeType: string;
}

/**
 * ponytail: files go to local disk, like avatars and custom-field icons already do.
 * That means a multi-instance deploy needs a shared volume — swap the two fs calls
 * for the S3/WebDAV services if the app ever runs without one.
 */
@Injectable()
export class TransactionAttachmentsService {
  private readonly logger = new Logger(TransactionAttachmentsService.name);

  constructor(
    @InjectRepository(TransactionAttachment)
    private readonly attachmentRepository: Repository<TransactionAttachment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async list(transactionId: string, workspaceId: string): Promise<TransactionAttachment[]> {
    await this.assertTransactionInWorkspace(transactionId, workspaceId);
    return this.attachmentRepository.find({
      where: { transactionId, workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    transactionId: string,
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<TransactionAttachment> {
    validateFile(file);
    await this.assertTransactionInWorkspace(transactionId, workspaceId);

    // The name on disk is generated, never derived from user input, so a crafted
    // original name cannot escape the attachments directory or collide.
    const storedFileName = `${randomUUID()}${path.extname(file.originalname).slice(0, 16)}`;
    const targetDir = this.resolveAttachmentsDir();
    fs.writeFileSync(path.join(targetDir, storedFileName), file.buffer);

    const attachment = this.attachmentRepository.create({
      workspaceId,
      transactionId,
      uploadedById: userId,
      fileName: path.basename(file.originalname).slice(0, 255),
      storedFileName,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    const saved = await this.attachmentRepository.save(attachment);
    // bigint: a read answers it as a string, so the upload answers the same.
    saved.fileSize = String(saved.fileSize) as unknown as number;
    return saved;
  }

  async getForDownload(attachmentId: string, workspaceId: string): Promise<AttachmentDownload> {
    const attachment = await this.findOne(attachmentId, workspaceId);
    const absolutePath = this.resolveStoredPath(attachment.storedFileName);

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Attachment file is missing from storage');
    }

    return { absolutePath, fileName: attachment.fileName, mimeType: attachment.mimeType };
  }

  async remove(attachmentId: string, workspaceId: string): Promise<void> {
    const attachment = await this.findOne(attachmentId, workspaceId);
    await this.attachmentRepository.remove(attachment);

    try {
      fs.unlinkSync(this.resolveStoredPath(attachment.storedFileName));
    } catch (error) {
      // The row is already gone, which is what the user asked for. A leftover blob
      // is a cleanup problem, not a failed request.
      this.logger.warn(
        `Deleted attachment ${attachmentId} but could not remove its file: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async findOne(attachmentId: string, workspaceId: string): Promise<TransactionAttachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, workspaceId },
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  private async assertTransactionInWorkspace(
    transactionId: string,
    workspaceId: string,
  ): Promise<void> {
    const exists = await this.transactionRepository.exists({
      where: { id: transactionId, workspaceId },
    });

    if (!exists) {
      throw new NotFoundException('Transaction not found');
    }
  }

  private resolveAttachmentsDir(): string {
    const targetDir = path.join(resolveUploadsDir(), ATTACHMENTS_SUBDIR);
    fs.mkdirSync(targetDir, { recursive: true });
    return targetDir;
  }

  /** basename() is belt-and-braces: stored names are generated, but paths are never trusted. */
  private resolveStoredPath(storedFileName: string): string {
    return path.join(this.resolveAttachmentsDir(), path.basename(storedFileName));
  }
}
