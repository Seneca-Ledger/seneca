import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    if (!member?.user) throw new NotFoundException('Workspace owner not found');
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
    };
    return mimeMap[ext] ?? 'application/octet-stream';
  }

  private async base64ToFile(base64: string, fileName: string): Promise<Express.Multer.File> {
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_BASE64_BYTES) {
      throw new BadRequestException('File exceeds maximum allowed size of 50MB');
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

  async uploadStatement(
    endpoint: WebhookEndpoint,
    file: Express.Multer.File | null,
    dto: WebhookStatementUploadBody,
  ) {
    const user = await this.resolveWorkspaceOwner(endpoint.workspaceId);
    const resolvedFile =
      file ??
      (dto.fileBase64
        ? await this.base64ToFile(dto.fileBase64, dto.fileName ?? 'statement.pdf')
        : null);
    if (!resolvedFile) throw new BadRequestException('No file provided');
    const isTemp = !file && !!dto.fileBase64;
    try {
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
    } finally {
      if (isTemp) {
        await import('node:fs/promises').then(fs =>
          fs.unlink(resolvedFile.path).catch(() => undefined),
        );
      }
    }
  }

  async uploadReceipt(
    endpoint: WebhookEndpoint,
    file: Express.Multer.File | null,
    dto: WebhookReceiptUploadBody,
  ) {
    const user = await this.resolveWorkspaceOwner(endpoint.workspaceId);
    const resolvedFile =
      file ??
      (dto.fileBase64
        ? await this.base64ToFile(dto.fileBase64, dto.fileName ?? 'receipt.jpg')
        : null);
    if (!resolvedFile) throw new BadRequestException('No file provided');
    const isTemp = !file && !!dto.fileBase64;
    try {
      return await this.receiptsService.createFromUpload({
        userId: user.id,
        workspaceId: endpoint.workspaceId,
        files: [resolvedFile],
        language: dto.language ?? undefined,
      });
    } finally {
      if (isTemp) {
        await import('node:fs/promises').then(fs =>
          fs.unlink(resolvedFile.path).catch(() => undefined),
        );
      }
    }
  }
}
