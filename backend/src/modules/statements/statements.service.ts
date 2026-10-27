import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { calculateFileHash } from '../../common/utils/file-hash.util';
import { resolveFileType, validateFile } from '../../common/utils/file-validator.util';
import { normalizeFilename } from '../../common/utils/filename.util';
import { assertNoTaxLockedTransactions } from '../../common/utils/tax-lock.util';
import { readUploadedFile } from '../../common/utils/uploads.util';
import { assertWorkspaceRefs } from '../../common/utils/workspace-refs.util';
import type {
  ConvertDroppedSampleBody,
  CreateManualExpenseBody,
  StatementsQuery,
  UpdateStatementBody,
} from '../../contracts';
import { Category, Wallet, WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../entities/statement.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import {
  type StatementUploadedEvent,
  transactionCreatedEvent,
} from '../notifications/events/notification-events';
import { StatementParsingQueue } from '../parsing/queue/statement-parsing.queue';
import { StatementProcessingService } from '../parsing/services/statement-processing.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { ManualExpenseService } from './manual-expense.service';
import { ReceiptStatementService } from './services/receipt-statement.service';
import { ensureCanEditStatements, ensureCanModifyStatement } from './statement-access';
import { accountOfUpload, walletOwnerMemberId } from './statement-accounts';
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
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly fileStorageService: FileStorageService,
    private statementProcessingService: StatementProcessingService,
    private readonly statementParsingQueue: StatementParsingQueue,
    private readonly receiptStatementService: ReceiptStatementService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly statementFiles: StatementFilesService,
    private readonly statementTrash: StatementTrashService,
    private readonly manualExpenses: ManualExpenseService,
    private readonly eventEmitter?: EventEmitter2,
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

  private normalizePositiveAmount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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
    await this.ensureCanModify(statement, userId, workspaceId);

    const warnings = statement.parsingDetails?.warnings || [];
    const droppedSamples = statement.parsingDetails?.droppedSamples || [];
    const warning = payload.warning || warnings[payload.index] || null;
    const warningTxKey = warning?.match(/tx#\d+/i)?.[0]?.toLowerCase() || null;
    const sampleIndex = droppedSamples.findIndex(sample => {
      const sampleTxKey = sample.reason.match(/tx#\d+/i)?.[0]?.toLowerCase() || null;
      return sample.reason === warning || Boolean(warningTxKey && sampleTxKey === warningTxKey);
    });
    const sample = sampleIndex >= 0 ? droppedSamples[sampleIndex] : null;

    if (!(sample || warning)) {
      throw new NotFoundException(appError('STATEMENT_SAMPLE_NOT_FOUND'));
    }

    const transactionDate = new Date(payload.transaction.transactionDate);
    if (Number.isNaN(transactionDate.getTime())) {
      throw new BadRequestException(appError('STATEMENT_TRANSACTION_DATE_INVALID'));
    }

    const debit = this.normalizePositiveAmount(payload.transaction.debit);
    const credit = this.normalizePositiveAmount(payload.transaction.credit);

    if (!(debit || credit)) {
      throw new BadRequestException(appError('STATEMENT_AMOUNT_REQUIRED'));
    }

    const transactionType = debit ? TransactionType.EXPENSE : TransactionType.INCOME;
    const amount = debit || credit || 0;
    const originalTransaction = sample?.transaction as
      | Record<string, string | number | null | undefined>
      | undefined;

    const walletId =
      payload.transaction.walletId || (originalTransaction?.walletId as string) || null;
    const categoryId =
      payload.transaction.categoryId || (originalTransaction?.categoryId as string) || null;
    const branchId =
      payload.transaction.branchId || (originalTransaction?.branchId as string) || null;
    await assertWorkspaceRefs(this.transactionRepository.manager, workspaceId, {
      categoryId,
      branchId,
      walletId,
    });

    const transaction = this.transactionRepository.create({
      workspaceId,
      statementId: statement.id,
      transactionDate: new Date(transactionDate.toISOString().slice(0, 10)),
      documentNumber:
        payload.transaction.documentNumber ||
        (originalTransaction?.documentNumber as string) ||
        null,
      counterpartyName:
        payload.transaction.counterpartyName?.trim() ||
        String(originalTransaction?.counterpartyName || '').trim() ||
        'Неизвестный контрагент',
      counterpartyBin:
        payload.transaction.counterpartyBin ||
        (originalTransaction?.counterpartyBin as string) ||
        null,
      counterpartyAccount:
        payload.transaction.counterpartyAccount ||
        (originalTransaction?.counterpartyAccount as string) ||
        null,
      counterpartyBank:
        payload.transaction.counterpartyBank ||
        (originalTransaction?.counterpartyBank as string) ||
        null,
      debit: debit ?? null,
      credit: credit ?? null,
      amount,
      currency: currencyCodeOrDefault(
        payload.transaction.currency || String(originalTransaction?.currency || ''),
        statement.currency,
      ),
      paymentPurpose:
        payload.transaction.paymentPurpose?.trim() ||
        String(originalTransaction?.paymentPurpose || '').trim() ||
        'Не указано',
      categoryId,
      categorySource: payload.transaction.categoryId ? TransactionCategorySource.MANUAL : null,
      branchId,
      walletId,
      // Same rule as the import path: the row starts on whoever owns the wallet.
      ownerMemberId: walletId
        ? await walletOwnerMemberId(this.walletRepository, walletId, workspaceId)
        : null,
      article: payload.transaction.article || (originalTransaction?.article as string) || null,
      comments: payload.transaction.comments || (originalTransaction?.comments as string) || null,
      transactionType,
      isVerified: true,
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    const nextDroppedSamples =
      sampleIndex >= 0
        ? droppedSamples.filter((_, index) => index !== sampleIndex)
        : droppedSamples;
    const warningToRemove = warning || sample?.reason || null;
    const nextWarnings = warnings.filter(currentWarning => currentWarning !== warningToRemove);

    statement.totalTransactions = Number(statement.totalTransactions || 0) + 1;
    statement.totalDebit = Number(statement.totalDebit || 0) + (debit || 0);
    statement.totalCredit = Number(statement.totalCredit || 0) + (credit || 0);
    statement.parsingDetails = {
      ...(statement.parsingDetails || {}),
      warnings: nextWarnings,
      droppedSamples: nextDroppedSamples,
      transactionsCreated: Number(statement.parsingDetails?.transactionsCreated || 0) + 1,
    };

    const savedStatement = await this.statementRepository.save(statement);

    await this.auditService.createEvent({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      actorLabel: (await this.userRepository.findOne({ where: { id: userId } }))?.email || 'User',
      entityType: EntityType.TRANSACTION,
      entityId: savedTransaction.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: savedTransaction },
      meta: {
        source: 'statement-dropped-sample-conversion',
        statementId: statement.id,
        droppedSampleIndex: payload.index,
      },
      severity: Severity.INFO,
      isUndoable: false,
    });
    this.eventEmitter?.emit(
      'transaction.created',
      transactionCreatedEvent(savedTransaction, 'dropped_sample'),
    );

    return {
      statement: savedStatement,
      transaction: savedTransaction,
    };
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
    await this.ensureCanEditStatements(user.id, workspaceId);
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

    const statement = await this.findOne(id, workspaceId);
    await this.ensureCanModify(statement, userId, workspaceId);

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

    await this.cacheManager.del(`statements:thumbnail:${id}`);
    return updatedStatement;
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
