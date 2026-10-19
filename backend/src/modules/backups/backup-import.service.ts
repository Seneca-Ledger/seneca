import * as crypto from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { recordSecurityEvent } from '../auth/security-audit.util';
import { BackupRestoreService } from './backup-restore.service';

type PendingImport = {
  userId: string;
  archiveSha256: string;
  expiresAt: number;
};

@Injectable()
export class BackupImportService {
  private readonly imports = new Map<string, PendingImport>();

  private readonly logger = new Logger(BackupImportService.name);

  constructor(
    private readonly restoreService: BackupRestoreService,
    private readonly auditService: AuditService,
  ) {}

  async preview(user: User, archive: Buffer, password: string) {
    const preview = await this.restoreService.preview(archive, password);
    this.removeExpired();
    const importId = crypto.randomUUID();
    this.imports.set(importId, {
      userId: user.id,
      archiveSha256: this.hash(archive),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return { importId, ...preview };
  }

  async restore(
    importId: string,
    user: User,
    archive: Buffer,
    password: string,
    workspaceName?: string,
  ) {
    this.removeExpired();
    const pending = this.imports.get(importId);
    if (!pending || pending.userId !== user.id || pending.archiveSha256 !== this.hash(archive)) {
      throw new BadRequestException(
        'Import preview has expired. Preview this backup again before restoring.',
      );
    }
    this.imports.delete(importId);
    const workspace = await this.restoreService.restore(archive, password, user, workspaceName);

    // Logged into the workspace the restore created — the one it concerns.
    await recordSecurityEvent(this.auditService, this.logger, {
      workspaceId: workspace.id,
      actorId: user.id,
      entityType: EntityType.BACKUP,
      entityId: importId,
      action: AuditAction.IMPORT,
      severity: Severity.CRITICAL,
      meta: { source: 'backup archive', workspaceName: workspace.name },
    });

    return workspace;
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [id, pending] of this.imports) {
      if (pending.expiresAt <= now) this.imports.delete(id);
    }
  }

  private hash(archive: Buffer): string {
    return crypto.createHash('sha256').update(archive).digest('hex');
  }
}
