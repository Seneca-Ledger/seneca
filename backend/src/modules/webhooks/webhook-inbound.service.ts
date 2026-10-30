import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { removeUploadedFile, validateFiles } from '../../common/utils/file-validator.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import type { WebhookReceiptUploadBody, WebhookStatementUploadBody } from '../../contracts';
import { User } from '../../entities/user.entity';
import type { WebhookEndpoint } from '../../entities/webhook-endpoint.entity';
import { WorkspaceMember, WorkspaceRole } from '../../entities/workspace-member.entity';
import { ReceiptsService } from '../receipts/receipts.service';
import { StatementsService } from '../statements/statements.service';

const MAX_BASE64_BYTES = 50 * 1024 * 1024; // 50MB

@Injectable()
export class WebhookInboundService {
  constructor(
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    private readonly statementsService: StatementsService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  private async resolveWorkspaceOwner(workspaceId: string): Promise<User> {
    const member = await this.memberRepo.findOne({
      where: { workspaceId, role: WorkspaceRole.OWNER },
      relations: {
        user: true,
      },
    });
    if (!member?.user) throw new NotFoundException(appError('WORKSPACE_OWNER_NOT_FOUND'));
    return member.user;
  }

  private getMimeType(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.csv': 'text/csv',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      // Interchange formats; validateFile admits them only when the content agrees.
      '.ofx': 'application/x-ofx',
      '.qfx': 'application/x-ofx',
      '.qif': 'application/qif',
      '.xml': 'application/xml',
      '.sta': 'text/plain',
      '.mt940': 'text/plain',
    };
    return mimeMap[ext] ?? 'application/octet-stream';
  }

  private async base64ToFile(base64: string, fileName: string): Promise<Express.Multer.File> {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_BASE64_BYTES) {
      throw new BadRequestException(appError('WEBHOOK_FILE_TOO_LARGE'));
    }
    const uniqueName = `${randomUUID()}${extname(fileName || '.bin')}`;
    const uploadsDir = resolveUploadsDir();
    const filePath = join(uploadsDir, uniqueName);
    await writeFile(filePath, buffer);
    return {
      fieldname: 'file',
      originalname: fileName || uniqueName,
      encoding: '7bit',
      mimetype: this.getMimeType(fileName),
      destination: uploadsDir,
      filename: uniqueName,
      path: filePath,
      size: buffer.length,
      stream: null as any,
      buffer: null as any,
    };
  }

  /** The multipart file, or the base64 body written into the uploads directory. */
  private async resolveFile(
    file: Express.Multer.File | null,
    dto: { fileBase64?: string | null; fileName?: string | null },
    defaultName: string,
  ): Promise<Express.Multer.File> {
    if (file) {
      return file;
    }
    if (!dto.fileBase64) {
      throw new BadRequestException(appError('WEBHOOK_FILE_MISSING'));
    }
    return this.base64ToFile(dto.fileBase64, dto.fileName ?? defaultName);
  }

  async uploadStatement(
    endpoint: WebhookEndpoint,
    file: Express.Multer.File | null,
    dto: WebhookStatementUploadBody,
  ) {
    const user = await this.resolveWorkspaceOwner(endpoint.workspaceId);
    const resolvedFile = await this.resolveFile(file, dto, 'statement.pdf');
    try {
      await validateFiles([resolvedFile]);
      const walletId = dto.walletId ?? endpoint.defaultWalletId ?? undefined;
      const branchId = dto.branchId ?? endpoint.defaultBranchId ?? undefined;
      return await this.statementsService.create(
        user,
        endpoint.workspaceId,
        resolvedFile,
        walletId,
        branchId,
        true,
      );
    } catch (error) {
      // On success the statement keeps the file (its filePath points at it);
      // only a rejected upload is removed.
      await removeUploadedFile(resolvedFile);
      throw error;
    }
  }

  async uploadReceipt(
    endpoint: WebhookEndpoint,
    file: Express.Multer.File | null,
    dto: WebhookReceiptUploadBody,
  ) {
    const user = await this.resolveWorkspaceOwner(endpoint.workspaceId);
    const resolvedFile = await this.resolveFile(file, dto, 'receipt.jpg');
    try {
      return await this.receiptsService.createFromUpload({
        userId: user.id,
        workspaceId: endpoint.workspaceId,
        files: [resolvedFile],
        language: dto.language ?? undefined,
      });
    } catch (error) {
      // The receipt keeps the file on success, as the statement does.
      await removeUploadedFile(resolvedFile);
      throw error;
    }
  }
}
