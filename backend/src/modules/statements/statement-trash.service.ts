import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import { WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { Statement } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import type { DataDeletedEvent } from '../notifications/events/notification-events';
import { ensureCanModifyStatement } from './statement-access';
import { removeStatementFile } from './statement-file-removal.util';

/**
 * A document's way out and back: into the trash (its rows drop out of every
 * total), out of it again, or deleted for good with its rows and file. A row
 * on a filed tax return keeps its document where it is.
 */
@Injectable()
export class StatementTrashService {
  private readonly logger = new Logger(StatementTrashService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly fileStorageService: FileStorageService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  async trash(statement: Statement, userId: string, workspaceId: string): Promise<Statement> {
    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);
    // A trashed statement's rows drop out of every total, including the
    // filed return they were reported on.
    await assertNoTaxLockedTransactions(this.transactionRepository, {
      statementId: statement.id,
      workspaceId,
    });

    // Mark as deleted (soft delete)
    const beforeState = { ...statement };
    statement.deletedAt = new Date();
    await this.statementRepository.save(statement);

    // Audit: record statement deletion with before snapshot.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.STATEMENT,
      entityId: statement.id,
      action: AuditAction.DELETE,
      diff: { before: beforeState, after: null },
      meta: {
        fileName: statement.fileName,
        source: 'trash',
      },
      isUndoable: true,
    });

    this.eventEmitter?.emit('data.deleted', {
      workspaceId,
      actorId: userId,
      actorName: statement.user?.name || statement.user?.email || 'User',
      entityType: 'statement',
      entityLabel: statement.fileName,
      count: 1,
    } satisfies DataDeletedEvent);

    return statement;
  }

  async permanentDelete(id: string, userId: string, workspaceId: string): Promise<void> {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
      relations: {
        user: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }
    await assertNoTaxLockedTransactions(this.transactionRepository, {
      statementId: statement.id,
      workspaceId,
    });

    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);

    // Audit: record statement rollback for restore operations.
    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.STATEMENT,
      entityId: statement.id,
      action: AuditAction.DELETE,
      diff: { before: { ...statement }, after: null },
      meta: {
        fileName: statement.fileName,
        source: 'permanent',
      },
      isUndoable: true,
    });

    this.eventEmitter?.emit('data.deleted', {
      workspaceId,
      actorId: userId,
      actorName: statement.user?.name || statement.user?.email || 'User',
      entityType: 'statement',
      entityLabel: statement.fileName,
      count: 1,
    } satisfies DataDeletedEvent);

    // Delete all related transactions first
    await this.transactionRepository.delete({ statementId: id });

    await removeStatementFile(this.statementRepository, statement, this.logger);

    // Finally delete the statement
    await this.statementRepository.remove(statement);

    // Invalidate thumbnail cache
    await this.cacheManager.del(`statements:thumbnail:${id}`);
  }

  async restore(id: string, userId: string, workspaceId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
      relations: {
        user: true,
      },
    });

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }

    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);

    // If the file is in trash, restore it from trash
    if (statement.deletedAt) {
      statement.deletedAt = null;
      await this.statementRepository.save(statement);

      // Audit: record permanent removal (used for hard delete flow).
      await this.auditService.createEvent({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.STATEMENT,
        entityId: statement.id,
        action: AuditAction.ROLLBACK,
        diff: { before: null, after: statement },
        meta: {
          source: 'trash_restore',
        },
        severity: Severity.INFO,
        isUndoable: false,
      });

      return { status: 'restored', source: 'trash' };
    }

    // Otherwise, restore file from database if it's missing from disk
    const restored = await this.fileStorageService.restoreFile(statement);
    if (!restored) {
      throw new NotFoundException(appError('STATEMENT_FILE_RESTORE_UNAVAILABLE'));
    }
    return { status: 'restored', source: restored.source };
  }
}
