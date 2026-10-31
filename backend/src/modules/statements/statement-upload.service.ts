import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { calculateFileHash } from '../../common/utils/file-hash.util';
import { resolveFileType } from '../../common/utils/file-validator.util';
import { normalizeFilename } from '../../common/utils/filename.util';
import { readUploadedFile } from '../../common/utils/uploads.util';
import { Wallet, WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../entities/statement.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { type StatementUploadedEvent } from '../notifications/events/notification-events';
import { StatementParsingQueue } from '../parsing/queue/statement-parsing.queue';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';

import { ensureCanEditStatements, ensureCanModifyStatement } from './statement-access';
import { accountOfUpload } from './statement-accounts';

/**
 * A statement file coming in: checked against the ones already filed (the
 * same file, or the same name and size within minutes), filed under the
 * account it was sent to, and queued for parsing. Also a new file for a
 * statement already filed.
 */
@Injectable()
export class StatementUploadService {
  private readonly logger = new Logger(StatementUploadService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly statementParsingQueue: StatementParsingQueue,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  async create(
    user: User,
    workspaceId: string,
    file: Express.Multer.File,
    walletId?: string,
    branchId?: string,
    allowDuplicates = false,
    requireManualCategorySelection = false,
  ): Promise<Statement> {
    await ensureCanEditStatements(this.workspaceMemberRepository, user.id, workspaceId);
    const normalizedName = normalizeFilename(file.originalname);
    const fileHash = await calculateFileHash(file.path);

    let fileData: Buffer | null = null;
    try {
      fileData = await readUploadedFile(file.path);
    } catch (error) {
      this.logger.warn(
        `[Statements] Failed to read uploaded file for DB storage: ${(error as Error)?.message}`,
      );
    }

    // Проверка дубликата и вставка — в одной транзакции под advisory-lock:
    // без него два одновременных аплоада одного файла (double-submit, retry)
    // оба проходили check-then-act и создавали дубль выписки с транзакциями.
    // Уникальный индекс тут не подходит — allowDuplicates легально обходит проверку.
    // Parsing replaces it with the currency the file states; until then the
    // statement carries the workspace's own (the column has no default).
    const currency = await this.workspaceCurrency.resolve(workspaceId);
    const accountId = await accountOfUpload(this.walletRepository, walletId, workspaceId);

    const savedStatement = await this.statementRepository.manager.transaction(async manager => {
      const statements = manager.getRepository(Statement);
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `statement-upload:${workspaceId}:${fileHash}`,
      ]);

      // Check for exact file hash duplicate
      const hashDuplicate = await statements.findOne({ where: { workspaceId, fileHash } });

      if (hashDuplicate && !allowDuplicates) {
        throw new ConflictException({
          ...appError('STATEMENT_DUPLICATE_FILE'),
          duplicateStatementId: hashDuplicate.id,
        });
      }

      // Check for near-duplicate (same name, size, within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentStatements = await statements
        .createQueryBuilder('statement')
        .where('statement.workspaceId = :workspaceId', { workspaceId })
        .andWhere('statement.fileName = :fileName', { fileName: normalizedName })
        .andWhere('statement.fileSize = :fileSize', { fileSize: file.size })
        .andWhere('statement.createdAt >= :fiveMinutesAgo', { fiveMinutesAgo })
        .getMany();

      if (recentStatements.length > 0 && !allowDuplicates) {
        throw new ConflictException({
          ...appError('STATEMENT_DUPLICATE_RECENT'),
          duplicateStatementId: recentStatements[0].id,
        });
      }

      // Create new statement
      const statement = statements.create({
        userId: user.id,
        workspaceId,
        fileName: normalizedName,
        filePath: file.path,
        fileType: resolveFileType(file) as FileType,
        fileSize: file.size,
        fileHash,
        bankName: BankName.OTHER, // Will be determined during parsing
        currency,
        walletId: accountId,
        status: StatementStatus.UPLOADED,
        parsingDetails: requireManualCategorySelection
          ? {
              manualCategorySelectionRequired: true,
            }
          : null,
      });

      return (await statements.save(statement)) as unknown as Statement;
    });
    let storedInDb = false;
    if (fileData) {
      try {
        await this.statementRepository.update(savedStatement.id, { fileData });
        storedInDb = true;
      } catch (error) {
        this.logger.warn(
          `[Statements] Failed to persist uploaded file in DB: ${(error as Error)?.message}`,
        );
      }
    }

    // Keep disk copy even if stored in DB to allow previews without DB select issues

    // Audit: record statement import for traceability.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: user.id,
      actorLabel: user.email || user.name || 'User',
      entityType: EntityType.STATEMENT,
      entityId: savedStatement.id,
      action: AuditAction.IMPORT,
      diff: { before: null, after: savedStatement },
      meta: {
        fileName: normalizeFilename(file.originalname),
        fileSize: file.size,
      },
      severity: Severity.INFO,
      isUndoable: false,
    });

    this.eventEmitter?.emit('statement.uploaded', {
      workspaceId,
      actorId: user.id,
      actorName: user.name || user.email || 'User',
      statementId: savedStatement.id,
      statementName: savedStatement.fileName,
      bankName: savedStatement.bankName,
    } satisfies StatementUploadedEvent);

    await this.statementParsingQueue.enqueue(savedStatement.id);

    return savedStatement;
  }

  async attachFile(
    statement: Statement,
    userId: string,
    workspaceId: string,
    file: Express.Multer.File,
  ): Promise<Statement> {
    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);

    const previousFilePath = statement.filePath;
    statement.fileName = normalizeFilename(file.originalname);
    statement.filePath = file.path;
    statement.fileType = resolveFileType(file) as FileType;
    statement.fileSize = file.size;
    statement.fileHash = await calculateFileHash(file.path);

    if (statement.parsingDetails?.importPreview?.source === 'manual-expense') {
      const previousAttachmentCount = Number(
        statement.parsingDetails.importPreview.attachments || 0,
      );
      statement.parsingDetails = {
        ...statement.parsingDetails,
        importPreview: {
          ...(statement.parsingDetails.importPreview || {}),
          attachments: Math.max(previousAttachmentCount, 1),
        },
      };
    }

    const updatedStatement = await this.statementRepository.save(statement);

    try {
      const fileData = await readUploadedFile(file.path);
      await this.statementRepository.update(updatedStatement.id, { fileData });
    } catch (error) {
      this.logger.warn(
        `[Statements] Failed to persist attached file in DB: ${(error as Error).message}`,
      );
    }

    if (previousFilePath && previousFilePath !== file.path && fs.existsSync(previousFilePath)) {
      try {
        const sharedReferenceCount = await this.statementRepository
          .createQueryBuilder('statement')
          .where('statement.filePath = :filePath', { filePath: previousFilePath })
          .andWhere('statement.id != :id', { id: updatedStatement.id })
          .getCount();

        if (sharedReferenceCount === 0) {
          await fs.promises.unlink(previousFilePath);
        }
      } catch (error) {
        this.logger.warn(
          `[Statements] Failed to clean up previous file ${previousFilePath}: ${(error as Error).message}`,
        );
      }
    }

    await this.cacheManager.del(`statements:thumbnail:${statement.id}`);
    return updatedStatement;
  }
}
