import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { validateFile } from '../../common/utils/file-validator.util';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import type {
  ConvertDroppedSampleBody,
  CreateManualExpenseBody,
  StatementsQuery,
  UpdateStatementBody,
} from '../../contracts';
import { Category, Wallet, WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { Statement, StatementStatus } from '../../entities/statement.entity';
import { Transaction } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { StatementParsingQueue } from '../parsing/queue/statement-parsing.queue';
import { StatementProcessingService } from '../parsing/services/statement-processing.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { DroppedSampleService } from './dropped-sample.service';
import { ManualExpenseService } from './manual-expense.service';
import { ReceiptStatementService } from './services/receipt-statement.service';
import { ensureCanEditStatements, ensureCanModifyStatement } from './statement-access';
import { StatementFilesService } from './statement-files.service';
import {
  applyStatementFilters,
  applyStatementRowFilters,
  orderStatementList,
} from './statement-list-query';
import {
  EMPTY_TRANSACTION_SUMMARY,
  loadTransactionSummaries,
  type StatementTransactionSummary,
} from './statement-transaction-summary';
import { StatementTrashService } from './statement-trash.service';
import { StatementUploadService } from './statement-upload.service';

type StatementFileAvailability = Awaited<ReturnType<FileStorageService['getFileAvailability']>>;
type StatementWithFileAvailability = Statement & {
  hasFileOnDisk?: boolean;
  hasFileInDb?: boolean;
  fileAvailability?: StatementFileAvailability;
  transactionSummary?: StatementTransactionSummary;
};
type StatementRepositoryWithOptionalQueryBuilder = Repository<Statement> & {
  createQueryBuilder?: Repository<Statement>['createQueryBuilder'];
};

/**
 * YYYY-MM-DD for a `date` column. Postgres returns loaded `date` values as
 * strings although the entity types them as Date; only dates set in this
 * request are Date objects.
 */
function dateOnly(value: Date | string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return (value instanceof Date ? value.toISOString() : String(value)).split('T')[0];
}

@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    @InjectRepository(Statement)
    private statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly fileStorageService: FileStorageService,
    private statementProcessingService: StatementProcessingService,
    private readonly statementParsingQueue: StatementParsingQueue,
    private readonly receiptStatementService: ReceiptStatementService,
    private readonly auditService: AuditService,
    private readonly statementFiles: StatementFilesService,
    private readonly statementTrash: StatementTrashService,
    private readonly manualExpenses: ManualExpenseService,
    private readonly uploads: StatementUploadService,
    private readonly droppedSamples: DroppedSampleService,
  ) {}

  private attachFileAvailability<T extends Statement>(
    statement: T,
    availability: StatementFileAvailability,
  ): T & StatementWithFileAvailability {
    const statementWithAvailability = statement as T & StatementWithFileAvailability;
    statementWithAvailability.hasFileOnDisk = availability.onDisk;
    statementWithAvailability.hasFileInDb = availability.inDb;
    statementWithAvailability.fileAvailability = availability;
    return statementWithAvailability;
  }

  private async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEditStatements(this.workspaceMemberRepository, userId, workspaceId);
  }

  private async ensureCanModify(
    statement: Statement,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await ensureCanModifyStatement(this.workspaceMemberRepository, statement, userId, workspaceId);
  }

  async createManualExpense(params: {
    user: User;
    workspaceId: string;
    payload: CreateManualExpenseBody;
    files: Express.Multer.File[];
  }): Promise<Statement> {
    return this.manualExpenses.create(params);
  }

  async createFromReceiptScan(params: {
    user: User;
    workspaceId: string;
    files: Express.Multer.File[];
    language?: string;
  }): Promise<Statement[]> {
    return this.receiptStatementService.createFromReceiptScan(params);
  }

  async convertDroppedSampleToTransaction(
    id: string,
    userId: string,
    workspaceId: string,
    payload: ConvertDroppedSampleBody,
  ): Promise<{ statement: Statement; transaction: Transaction }> {
    const statement = await this.findOne(id, workspaceId);
    return this.droppedSamples.convert(statement, userId, workspaceId, payload);
  }

  async create(
    user: User,
    workspaceId: string,
    file: Express.Multer.File,
    walletId?: string,
    branchId?: string,
    allowDuplicates = false,
    requireManualCategorySelection = false,
  ): Promise<Statement> {
    return this.uploads.create(
      user,
      workspaceId,
      file,
      walletId,
      branchId,
      allowDuplicates,
      requireManualCategorySelection,
    );
  }

  async findAll(
    workspaceId: string,
    filters: StatementsQuery = {},
    viewerMemberId: string | null = null,
  ): Promise<{
    data: Statement[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page;
    const limit = filters.limit ?? (page ? 20 : undefined);
    const qb = this.statementRepository
      .createQueryBuilder('statement')
      .leftJoinAndSelect('statement.user', 'user')
      .leftJoinAndSelect('statement.category', 'category')
      .leftJoinAndSelect('statement.tags', 'tags')
      .where('statement.deletedAt IS NULL')
      .andWhere('statement.workspaceId = :workspaceId', { workspaceId })
      .orderBy('statement.createdAt', 'DESC');

    if (page && limit) {
      qb.skip((page - 1) * limit).take(limit);
    } else if (!page && limit) {
      qb.take(limit);
    }

    applyStatementFilters(qb, filters);
    const categoryIds =
      filters.categoryId && filters.categoryId !== 'uncategorized'
        ? await this.categoryWithDescendants(workspaceId, filters.categoryId)
        : null;
    applyStatementRowFilters(qb, filters, this.transactionRepository, workspaceId, categoryIds);
    orderStatementList(qb, filters.groupBy);

    const [dataRaw, totalCount] = await qb.getManyAndCount();
    const transactionSummaries = await loadTransactionSummaries(
      this.transactionRepository,
      workspaceId,
      dataRaw.map(statement => statement.id),
      viewerMemberId,
    );
    const data = await Promise.all(
      dataRaw.map(async st => {
        const availability = await this.fileStorageService.getFileAvailability(st);
        const statement = this.attachFileAvailability(st, availability);
        statement.transactionSummary = transactionSummaries.get(st.id) ?? EMPTY_TRANSACTION_SUMMARY;
        return statement;
      }),
    );

    const total = page ? totalCount : data.length;

    return {
      data,
      total,
      page: page ?? 1,
      limit: limit ?? total,
    };
  }

  /** The category and every category below it, within the workspace. */
  private async categoryWithDescendants(
    workspaceId: string,
    categoryId: string,
  ): Promise<string[]> {
    const categories = await this.categoryRepository.find({
      where: { workspaceId },
      select: { id: true, parentId: true },
    });
    const ids = [categoryId];
    for (let index = 0; index < ids.length; index++) {
      for (const category of categories) {
        if (category.parentId === ids[index] && !ids.includes(category.id)) ids.push(category.id);
      }
    }
    return ids;
  }

  async findOne(id: string, workspaceId: string): Promise<Statement> {
    const statementRepository = this
      .statementRepository as StatementRepositoryWithOptionalQueryBuilder;

    if (typeof statementRepository.createQueryBuilder !== 'function') {
      const statement = await this.statementRepository.findOne({
        where: { id, workspaceId },
        relations: {
          transactions: true,
          user: true,
        },
      });

      if (!statement) {
        throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
      }

      const availability = await this.fileStorageService.getFileAvailability(statement);
      this.attachFileAvailability(statement, availability);

      return statement;
    }

    const qb = statementRepository
      .createQueryBuilder('statement')
      .leftJoinAndSelect('statement.transactions', 'transactions')
      .leftJoinAndSelect('statement.user', 'owner')
      .where('statement.id = :id', { id })
      .andWhere('statement.workspaceId = :workspaceId', { workspaceId });

    const statement = await qb.getOne();

    if (!statement) {
      throw new NotFoundException(appError('STATEMENT_NOT_FOUND'));
    }

    const availability = await this.fileStorageService.getFileAvailability(statement);
    this.attachFileAvailability(statement, availability);

    return statement;
  }

  async updateMetadata(
    id: string,
    userId: string,
    workspaceId: string,
    updateDto: UpdateStatementBody,
  ): Promise<Statement> {
    const statement = await this.findOne(id, workspaceId);
    await this.ensureCanModify(statement, userId, workspaceId);

    if (updateDto.balanceStart !== undefined) {
      statement.balanceStart =
        updateDto.balanceStart === null ? null : Number(updateDto.balanceStart);
    }

    if (updateDto.balanceEnd !== undefined) {
      statement.balanceEnd = updateDto.balanceEnd === null ? null : Number(updateDto.balanceEnd);
    }

    if (updateDto.statementDateFrom !== undefined) {
      statement.statementDateFrom = updateDto.statementDateFrom
        ? new Date(updateDto.statementDateFrom)
        : null;
    }

    if (updateDto.statementDateTo !== undefined) {
      statement.statementDateTo = updateDto.statementDateTo
        ? new Date(updateDto.statementDateTo)
        : null;
    }

    if (statement.parsingDetails) {
      statement.parsingDetails = {
        ...statement.parsingDetails,
        metadataExtracted: {
          ...(statement.parsingDetails.metadataExtracted || {}),
          balanceStart: statement.balanceStart ?? undefined,
          balanceEnd: statement.balanceEnd ?? undefined,
          dateFrom: dateOnly(statement.statementDateFrom),
          dateTo: dateOnly(statement.statementDateTo),
        },
      };
    }

    return this.statementRepository.save(statement);
  }

  async attachFile(
    id: string,
    userId: string,
    workspaceId: string,
    file: Express.Multer.File,
  ): Promise<Statement> {
    validateFile(file);
    return this.uploads.attachFile(await this.findOne(id, workspaceId), userId, workspaceId, file);
  }

  async moveToTrash(id: string, userId: string, workspaceId: string): Promise<Statement> {
    return this.statementTrash.trash(await this.findOne(id, workspaceId), userId, workspaceId);
  }

  async permanentDelete(id: string, userId: string, workspaceId: string): Promise<void> {
    await this.statementTrash.permanentDelete(id, userId, workspaceId);
  }

  async remove(id: string, userId: string, workspaceId: string): Promise<void> {
    // For backward compatibility, remove now does soft delete
    await this.moveToTrash(id, userId, workspaceId);
  }

  async reprocess(
    id: string,
    userId: string,
    workspaceId: string,
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<Statement> {
    const statement = await this.findOne(id, workspaceId);
    await this.ensureCanModify(statement, userId, workspaceId);

    if (statement.status === StatementStatus.PROCESSING) {
      return statement;
    }

    if (mode === 'replace') {
      // Full delete mode - clear all transactions
      await assertNoTaxLockedTransactions(this.transactionRepository, {
        statementId: statement.id,
        workspaceId,
      });
      await this.transactionRepository.delete({ statementId: statement.id });
    } else {
      // Merge mode - keep user-modified transactions, soft-delete others
      const existingTransactions = await this.transactionRepository.find({
        where: { statementId: statement.id },
      });

      // Identify user-modified transactions (where updatedAt > createdAt + 1 second)
      const userModified: string[] = [];
      const toDelete: string[] = [];

      for (const tx of existingTransactions) {
        const timeDiff = tx.updatedAt.getTime() - tx.createdAt.getTime();
        // A row on a filed tax return stays whatever its timestamps say.
        if (timeDiff > 1000 || tx.taxLocked) {
          // Modified more than 1 second after creation
          userModified.push(tx.id);
        } else {
          toDelete.push(tx.id);
        }
      }

      // Soft-delete non-modified transactions
      if (toDelete.length > 0) {
        await this.transactionRepository.delete(toDelete);
      }

      this.logger.log(
        `[Reprocess Merge] Keeping ${userModified.length} user-modified transactions, deleting ${toDelete.length}`,
      );
    }

    statement.status = StatementStatus.UPLOADED;
    statement.errorMessage = null;
    statement.processedAt = null;
    statement.totalTransactions = 0;
    statement.totalDebit = 0;
    statement.totalCredit = 0;
    statement.categoryId = null;
    statement.parsingDetails = null;
    await this.statementRepository.save(statement);

    await this.statementParsingQueue.enqueue(statement.id);

    return statement;
  }

  async commitImport(id: string, userId: string, workspaceId: string): Promise<Statement> {
    const statement = await this.findOne(id, workspaceId);
    await this.ensureCanModify(statement, userId, workspaceId);
    return this.statementProcessingService.commitImport(statement.id, workspaceId);
  }

  /**
   * Accepts a statement whose balance did not reconcile, releasing it into
   * analytics. The unreconciled figures are kept in `parsingDetails.validation`
   * and the acknowledgement is audited, so the discrepancy stays traceable.
   */
  async confirmBalance(id: string, userId: string, workspaceId: string): Promise<Statement> {
    const statement = await this.findOne(id, workspaceId);
    await this.ensureCanModify(statement, userId, workspaceId);

    if (statement.status !== StatementStatus.NEEDS_REVIEW) {
      throw new BadRequestException(appError('STATEMENT_NOT_AWAITING_BALANCE'));
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    const actorLabel = user?.email || user?.name || 'User';

    const before = { status: statement.status };
    statement.status = StatementStatus.COMPLETED;
    statement.parsingDetails = {
      ...(statement.parsingDetails || {}),
      balanceConfirmation: {
        confirmedBy: userId,
        confirmedAt: new Date().toISOString(),
      },
    };

    const saved = await this.statementRepository.save(statement);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      actorLabel,
      entityType: EntityType.STATEMENT,
      entityId: statement.id,
      action: AuditAction.UPDATE,
      diff: { before, after: { status: saved.status } },
      meta: {
        reason: 'balance-mismatch-confirmed',
        balanceCheck: statement.parsingDetails?.validation?.balanceCheck ?? null,
      },
      severity: Severity.WARN,
      isUndoable: false,
    });

    return saved;
  }

  async getFileStream(
    id: string,
    workspaceId: string,
  ): Promise<{
    stream: NodeJS.ReadableStream;
    fileName: string;
    mimeType: string;
  }> {
    return this.statementFiles.fileStream(await this.findOne(id, workspaceId));
  }

  async restoreFile(id: string, userId: string, workspaceId: string) {
    return this.statementTrash.restore(id, userId, workspaceId);
  }

  async getThumbnail(id: string, workspaceId: string, requestedWidth?: number): Promise<Buffer> {
    return this.statementFiles.thumbnail(await this.findOne(id, workspaceId), requestedWidth);
  }

  async exportZip(workspaceId: string, outputStream: NodeJS.WritableStream): Promise<void> {
    const { data: statements } = await this.findAll(workspaceId, {});
    await this.statementFiles.exportZip(statements, outputStream);
  }
}
