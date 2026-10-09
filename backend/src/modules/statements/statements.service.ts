import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import archiver = require('archiver');

import { randomUUID } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { FileStorageService } from '../../common/services/file-storage.service';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { ensureCanEdit } from '../../common/utils/ensure-can-edit.util';
import { calculateFileHash } from '../../common/utils/file-hash.util';
import { resolveFileType, validateFile } from '../../common/utils/file-validator.util';
import { normalizeFilename, sanitizeArchiveEntryName } from '../../common/utils/filename.util';
import { toMinor } from '../../common/utils/money.util';
import { runExecutable } from '../../common/utils/thumbnail-command.util';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { Category, Wallet, WorkspaceMember, WorkspaceRole } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { CategoryType } from '../../entities/category.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../entities/statement.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import type {
  DataDeletedEvent,
  StatementUploadedEvent,
} from '../notifications/events/notification-events';
import { StatementParsingQueue } from '../parsing/queue/statement-parsing.queue';
import { StatementProcessingService } from '../parsing/services/statement-processing.service';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import type { ConvertDroppedSampleDto } from './dto/convert-dropped-sample.dto';
import type { CreateManualExpenseDto } from './dto/create-manual-expense.dto';
import type { FilterStatementsDto } from './dto/filter-statements.dto';
import type { UpdateStatementDto } from './dto/update-statement.dto';
import { ReceiptStatementService } from './services/receipt-statement.service';

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
type StatementTransactionSummary = {
  description: string | null;
  exchangeRate: string | null;
  exchangeRateMixed: boolean;
  cardLabel: string | null;
};
type StatementTransactionSummaryRow = {
  statementId: string;
  description: string | null;
  exchangeRate: string | null;
  exchangeRateCount: string;
  cardLabel: string | null;
};

const APPROVED_STATUSES = [
  StatementStatus.VALIDATED,
  StatementStatus.COMPLETED,
  StatementStatus.PARSED,
];
const NOT_APPROVED_STATUSES = [
  StatementStatus.UPLOADED,
  StatementStatus.PROCESSING,
  StatementStatus.ERROR,
  StatementStatus.NEEDS_REVIEW,
];

const toDateOnlyString = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDatePresetRange = (preset: 'thisMonth' | 'lastMonth' | 'yearToDate', now: Date) => {
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === 'thisMonth') {
    return {
      dateFrom: toDateOnlyString(new Date(current.getFullYear(), current.getMonth(), 1)),
      dateTo: toDateOnlyString(new Date(current.getFullYear(), current.getMonth() + 1, 0)),
    };
  }

  if (preset === 'lastMonth') {
    return {
      dateFrom: toDateOnlyString(new Date(current.getFullYear(), current.getMonth() - 1, 1)),
      dateTo: toDateOnlyString(new Date(current.getFullYear(), current.getMonth(), 0)),
    };
  }

  return {
    dateFrom: toDateOnlyString(new Date(current.getFullYear(), 0, 1)),
    dateTo: toDateOnlyString(current),
  };
};

const splitReferenceTokens = (tokens?: string[]) => {
  const normalizedTokens = tokens || [];
  const allowedBankNames = new Set(Object.values(BankName));

  return normalizedTokens.reduce(
    (acc, token) => {
      if (token.startsWith('user:')) {
        const userId = token.replace('user:', '').trim();
        if (userId) {
          acc.userIds.push(userId);
        }
      }

      if (token.startsWith('bank:')) {
        const bankName = token.replace('bank:', '').trim().toLowerCase();
        if (bankName && allowedBankNames.has(bankName as BankName)) {
          acc.bankNames.push(bankName);
        }
      }

      return acc;
    },
    { userIds: [] as string[], bankNames: [] as string[] },
  );
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
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
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
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
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

  private async loadTransactionSummaries(
    workspaceId: string,
    statementIds: string[],
  ): Promise<Map<string, StatementTransactionSummary>> {
    if (statementIds.length === 0) {
      return new Map();
    }

    const queryBuilder = this.transactionRepository.createQueryBuilder('transaction');
    if (
      typeof queryBuilder.leftJoin !== 'function' ||
      typeof queryBuilder.addSelect !== 'function' ||
      typeof queryBuilder.getRawMany !== 'function'
    ) {
      return new Map();
    }

    const rows = await queryBuilder
      .leftJoin('transaction.wallet', 'wallet')
      .select('transaction.statementId', 'statementId')
      .addSelect(
        "(ARRAY_REMOVE(ARRAY_AGG(NULLIF(transaction.paymentPurpose, '') ORDER BY transaction.transactionDate ASC, transaction.createdAt ASC), NULL))[1]",
        'description',
      )
      .addSelect(
        'MIN(transaction.exchangeRate) FILTER (WHERE transaction.exchangeRate IS NOT NULL)',
        'exchangeRate',
      )
      .addSelect(
        'COUNT(DISTINCT transaction.exchangeRate) FILTER (WHERE transaction.exchangeRate IS NOT NULL)',
        'exchangeRateCount',
      )
      .addSelect(
        "(ARRAY_REMOVE(ARRAY_AGG(NULLIF(wallet.name, '') ORDER BY transaction.transactionDate ASC, transaction.createdAt ASC), NULL))[1]",
        'cardLabel',
      )
      .where('transaction.workspaceId = :workspaceId', { workspaceId })
      .andWhere('transaction.statementId IN (:...statementIds)', { statementIds })
      .groupBy('transaction.statementId')
      .getRawMany<StatementTransactionSummaryRow>();

    return new Map(
      rows.map(row => [
        row.statementId,
        {
          description: row.description ?? null,
          exchangeRate: row.exchangeRate ?? null,
          exchangeRateMixed: Number(row.exchangeRateCount || 0) > 1,
          cardLabel: row.cardLabel ?? null,
        },
      ]),
    );
  }

  private async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    await ensureCanEdit(
      this.workspaceMemberRepository,
      workspaceId,
      userId,
      'canEditStatements',
      'STATEMENTS_EDIT_FORBIDDEN',
    );
  }

  private async ensureCanModify(
    statement: Statement,
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.ensureCanEditStatements(userId, workspaceId);
    if (statement.userId === userId) {
      return;
    }
    if (workspaceId && statement.workspaceId === workspaceId) {
      const membership = await this.workspaceMemberRepository.findOne({
        where: { workspaceId, userId },
        select: ['role'],
      });
      if (membership && [WorkspaceRole.ADMIN, WorkspaceRole.OWNER].includes(membership.role)) {
        return;
      }
    }
    throw new ForbiddenException(appError('STATEMENT_EDIT_FORBIDDEN'));
  }

  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  }

  /** Who owns the wallet, or null when it is shared. */
  private async walletOwnerMemberId(walletId: string): Promise<string | null> {
    const wallet = await this.walletRepository.findOne({
      where: { id: walletId },
      select: ['ownerMemberId'],
    });
    return wallet?.ownerMemberId ?? null;
  }

  private normalizePositiveAmount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

  async createManualExpense(params: {
    user: User;
    workspaceId: string;
    payload: CreateManualExpenseDto;
    files: Express.Multer.File[];
  }): Promise<Statement> {
    const { user, workspaceId, payload, files } = params;
    await this.ensureCanEditStatements(user.id, workspaceId);

    const amountValue = Number(
      String(payload.amount || '')
        .replace(',', '.')
        .trim(),
    );
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const merchant = payload.merchant?.trim();
    if (!merchant) {
      throw new BadRequestException('Merchant is required');
    }

    const currency = await this.workspaceCurrency.resolveFor(workspaceId, payload.currency);
    if (!currency) {
      throw new BadRequestException('Currency is required');
    }

    const parsedDate = new Date(payload.date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Date is invalid');
    }

    const allowDuplicates = payload.allowDuplicates ?? false;
    const description = payload.description?.trim() || '';
    const categoryId = payload.categoryId?.trim();
    if (!categoryId) {
      throw new BadRequestException('Category is required');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, workspaceId },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }

    if (category.isEnabled === false) {
      throw new BadRequestException('Category is disabled');
    }

    if (category.type !== CategoryType.EXPENSE) {
      throw new BadRequestException('Category must be an expense category');
    }

    const taxRateId = payload.taxRateId?.trim();
    let taxRate: TaxRate | null = null;

    if (taxRateId) {
      taxRate = await this.taxRateRepository.findOne({
        where: {
          id: taxRateId,
          workspaceId,
          isEnabled: true,
        },
      });

      if (!taxRate) {
        throw new BadRequestException('Tax rate not found');
      }
    } else {
      taxRate = await this.taxRateRepository.findOne({
        where: {
          workspaceId,
          isDefault: true,
          isEnabled: true,
        },
      });
    }

    const transactionDate = new Date(parsedDate.toISOString().slice(0, 10));

    // Array.isArray, not `files || []`: `files` comes from a multipart
    // upload field decorated with @UploadedFiles(), and although Multer's
    // FilesInterceptor always produces an array (or omits the field), an
    // explicit type check rather than truthiness keeps that guarantee from
    // ever being taken on faith for this parameter.
    const normalizedFiles = Array.isArray(files) ? files : [];
    normalizedFiles.forEach(validateFile);

    let fileName: string;
    let filePath: string;
    let fileType: FileType;
    let fileHash: string;
    let fileSize: number;
    let fileData: Buffer;

    const primaryFile = normalizedFiles[0];
    if (primaryFile) {
      fileName = normalizeFilename(primaryFile.originalname);
      filePath = primaryFile.path;
      fileType = resolveFileType(primaryFile) as FileType;
      fileHash = await calculateFileHash(primaryFile.path);
      fileSize = primaryFile.size;
      fileData = await fs.promises.readFile(primaryFile.path);
    } else {
      fileName = `manual-expense-${Date.now()}.csv`;
      filePath = path.join(resolveUploadsDir(), `${randomUUID()}.csv`);
      const csv = [
        'date,merchant,description,amount,currency',
        [
          payload.date,
          this.escapeCsvValue(merchant),
          this.escapeCsvValue(description),
          amountValue.toFixed(2),
          currency,
        ].join(','),
      ].join('\n');

      fileData = Buffer.from(csv, 'utf8');
      await fs.promises.writeFile(filePath, fileData);
      fileType = FileType.CSV;
      fileHash = createHash('sha256').update(fileData).digest('hex');
      fileSize = fileData.length;
    }

    // Resolved from the user's own choice where they made one, otherwise from
    // the workspace rules and default as they stood on the expense's date.
    const taxAssignment = await this.taxAssignmentService.resolve({
      workspaceId,
      transactionDate,
      amountMinor: toMinor(amountValue),
      categoryId: category.id,
      transactionType: TransactionType.EXPENSE,
      transactionNature: null,
      explicitTaxRateId: taxRateId || null,
    });

    // Проверка дубликата и обе вставки — в одной транзакции под advisory-lock:
    // иначе double-submit формы проходил check-then-act дважды и создавал два
    // одинаковых расхода (тот же паттерн, что в create() для выписок).
    const savedStatement = await this.statementRepository.manager.transaction(async manager => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `manual-expense:${workspaceId}:${payload.date}:${merchant}:${amountValue}:${currency}`,
      ]);

      if (!allowDuplicates) {
        const existingDuplicate = await manager.getRepository(Transaction).findOne({
          where: {
            workspaceId,
            transactionType: TransactionType.EXPENSE,
            transactionDate,
            currency,
            counterpartyName: merchant,
            debit: amountValue,
          },
        });

        if (existingDuplicate) {
          throw new ConflictException(appError('EXPENSE_DUPLICATE'));
        }
      }

      const statements = manager.getRepository(Statement);
      const statement = statements.create({
        userId: user.id,
        workspaceId,
        fileName,
        filePath,
        fileType,
        fileSize,
        fileHash,
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        processedAt: new Date(),
        statementDateFrom: transactionDate,
        statementDateTo: transactionDate,
        totalTransactions: 1,
        totalDebit: amountValue,
        totalCredit: 0,
        currency,
        categoryId: category.id,
        parsingDetails: {
          detectedBy: 'manual-expense',
          parserUsed: 'manual-expense',
          parserVersion: '1',
          transactionsFound: 1,
          transactionsCreated: 1,
          metadataExtracted: {
            dateFrom: payload.date,
            dateTo: payload.date,
            currency,
          },
          importPreview: {
            source: 'manual-expense',
            merchant,
            description,
            attachments: normalizedFiles.length,
            categoryId: category.id,
            taxRateId: taxRate?.id || null,
            taxRateLabel: taxRate
              ? `${taxRate.name} (${Number(taxRate.rate || 0).toFixed(0)}%)`
              : null,
          },
        },
      });

      const created = (await statements.save(statement)) as Statement;

      const transaction = manager.getRepository(Transaction).create({
        workspaceId,
        statementId: created.id,
        transactionDate,
        counterpartyName: merchant,
        paymentPurpose: description || merchant,
        debit: amountValue,
        credit: null,
        amount: amountValue,
        currency,
        transactionType: TransactionType.EXPENSE,
        categoryId: category.id,
        taxRateId: taxAssignment.taxRateId ?? taxRate?.id ?? null,
        taxRuleId: taxAssignment.taxRuleId,
        taxSource: taxAssignment.taxSource,
        taxAmount: taxAssignment.taxAmount,
        taxNetAmount: taxAssignment.taxNetAmount,
        taxReverseCharge: taxAssignment.taxReverseCharge,
        taxNotionalAmount: taxAssignment.taxNotionalAmount,
        isVerified: true,
      });

      await manager.getRepository(Transaction).save(transaction);
      return created;
    });

    try {
      await this.statementRepository.update(savedStatement.id, { fileData });
    } catch (error) {
      this.logger.warn(
        `[Statements] Failed to persist manual expense file in DB: ${(error as Error)?.message}`,
      );
    }

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
        source: 'manual-expense',
        amount: amountValue,
        currency,
        merchant,
        categoryId: category.id,
        taxRateId: taxRate?.id || null,
      },
      severity: Severity.INFO,
      isUndoable: false,
    });

    return savedStatement;
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
    payload: ConvertDroppedSampleDto,
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
      throw new NotFoundException('Dropped sample not found');
    }

    const transactionDate = new Date(payload.transaction.transactionDate);
    if (Number.isNaN(transactionDate.getTime())) {
      throw new BadRequestException('Transaction date is invalid');
    }

    const debit = this.normalizePositiveAmount(payload.transaction.debit);
    const credit = this.normalizePositiveAmount(payload.transaction.credit);

    if (!(debit || credit)) {
      throw new BadRequestException('Either debit or credit amount is required');
    }

    const transactionType = debit ? TransactionType.EXPENSE : TransactionType.INCOME;
    const amount = debit || credit || 0;
    const originalTransaction = sample?.transaction as
      | Record<string, string | number | null | undefined>
      | undefined;

    const walletId =
      payload.transaction.walletId || (originalTransaction?.walletId as string) || null;

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
      categoryId:
        payload.transaction.categoryId || (originalTransaction?.categoryId as string) || null,
      branchId: payload.transaction.branchId || (originalTransaction?.branchId as string) || null,
      walletId,
      // Same rule as the import path: the row starts on whoever owns the wallet.
      ownerMemberId: walletId ? await this.walletOwnerMemberId(walletId) : null,
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
      fileData = await fs.promises.readFile(file.path);
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
    filters: FilterStatementsDto = {},
  ): Promise<{
    data: Statement[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters.page;
    const limit = filters.limit ?? (page ? 20 : undefined);
    const statementDateExpression =
      'DATE(COALESCE(statement.statementDateTo, statement.statementDateFrom, statement.createdAt))';
    const amountExpression =
      'GREATEST(COALESCE(statement.totalDebit, 0), COALESCE(statement.totalCredit, 0))';
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

    if (filters.search) {
      qb.andWhere('statement.fileName ILIKE :search', {
        search: `%${filters.search}%`,
      });
    }

    if (filters.type) {
      qb.andWhere('statement.fileType = :type', {
        type: filters.type.toLowerCase(),
      });
    }

    if (filters.statuses && filters.statuses.length > 0) {
      // status is a Postgres enum: LOWER() has no enum overload, and comparing the
      // enum to an unknown value errors, so compare as text.
      qb.andWhere('CAST(statement.status AS text) IN (:...statuses)', {
        statuses: filters.statuses.map(status => status.toLowerCase()),
      });
    }

    if (typeof filters.approved === 'boolean') {
      if (filters.approved) {
        qb.andWhere('statement.status IN (:...approvedStatuses)', {
          approvedStatuses: APPROVED_STATUSES,
        });
      } else {
        qb.andWhere('statement.status IN (:...notApprovedStatuses)', {
          notApprovedStatuses: NOT_APPROVED_STATUSES,
        });
      }
    }

    if (typeof filters.billable === 'boolean') {
      if (filters.billable) {
        qb.andWhere(`${amountExpression} > 0`);
      } else {
        qb.andWhere(`${amountExpression} <= 0`);
      }
    }

    if (filters.datePreset) {
      const { dateFrom, dateTo } = getDatePresetRange(filters.datePreset, new Date());
      qb.andWhere(`${statementDateExpression} BETWEEN :dateFrom AND :dateTo`, {
        dateFrom,
        dateTo,
      });
    } else if (filters.dateMode && filters.dateFrom) {
      if (filters.dateMode === 'on') {
        if (filters.dateTo) {
          const sortedRange = [filters.dateFrom, filters.dateTo].sort();
          qb.andWhere(`${statementDateExpression} BETWEEN :dateFrom AND :dateTo`, {
            dateFrom: sortedRange[0],
            dateTo: sortedRange[1],
          });
        } else {
          qb.andWhere(`${statementDateExpression} = :dateFrom`, {
            dateFrom: filters.dateFrom,
          });
        }
      } else if (filters.dateMode === 'after') {
        qb.andWhere(`${statementDateExpression} > :dateFrom`, {
          dateFrom: filters.dateFrom,
        });
      } else {
        qb.andWhere(`${statementDateExpression} < :dateTo`, {
          dateTo: filters.dateTo || filters.dateFrom,
        });
      }
    }

    const fromReferences = splitReferenceTokens(filters.from);
    if (fromReferences.userIds.length > 0 || fromReferences.bankNames.length > 0) {
      const conditions: string[] = [];
      const params: Record<string, string[]> = {};

      if (fromReferences.userIds.length > 0) {
        conditions.push('statement.userId IN (:...fromUserIds)');
        params.fromUserIds = fromReferences.userIds;
      }

      if (fromReferences.bankNames.length > 0) {
        conditions.push('statement.bankName IN (:...fromBankNames)');
        params.fromBankNames = fromReferences.bankNames;
      }

      qb.andWhere(`(${conditions.join(' OR ')})`, params);
    }

    const toReferences = splitReferenceTokens(filters.to);
    if (toReferences.userIds.length > 0 || toReferences.bankNames.length > 0) {
      const conditions: string[] = [];
      const params: Record<string, string[]> = {};

      if (toReferences.userIds.length > 0) {
        conditions.push('statement.userId IN (:...toUserIds)');
        params.toUserIds = toReferences.userIds;
      }

      if (toReferences.bankNames.length > 0) {
        conditions.push('statement.bankName IN (:...toBankNames)');
        params.toBankNames = toReferences.bankNames;
      }

      qb.andWhere(`(${conditions.join(' OR ')})`, params);
    }

    if (filters.keywords?.trim()) {
      qb.andWhere(
        `(
          statement.fileName ILIKE :keywords OR
          CAST(statement.bankName AS text) ILIKE :keywords OR
          CAST(statement.status AS text) ILIKE :keywords OR
          COALESCE(user.name, '') ILIKE :keywords OR
          COALESCE(user.email, '') ILIKE :keywords OR
          COALESCE(statement.accountNumber, '') ILIKE :keywords
        )`,
        {
          keywords: `%${filters.keywords.trim()}%`,
        },
      );
    }

    if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
      const amountConditions: string[] = [];
      const params: Record<string, number> = {};

      if (filters.amountMin !== undefined) {
        amountConditions.push(`${amountExpression} >= :amountMin`);
        params.amountMin = filters.amountMin;
      }

      if (filters.amountMax !== undefined) {
        amountConditions.push(`${amountExpression} <= :amountMax`);
        params.amountMax = filters.amountMax;
      }

      qb.andWhere(amountConditions.join(' AND '), params);
    }

    if (filters.currencies && filters.currencies.length > 0) {
      qb.andWhere('LOWER(statement.currency) IN (:...currencies)', {
        currencies: filters.currencies.map(currency => currency.toLowerCase()),
      });
    }

    if (typeof filters.exported === 'boolean') {
      qb.andWhere(
        filters.exported ? 'statement.processedAt IS NOT NULL' : 'statement.processedAt IS NULL',
      );
    }

    if (typeof filters.paid === 'boolean') {
      qb.andWhere(
        filters.paid
          ? 'statement.statementDateTo IS NOT NULL'
          : 'statement.statementDateTo IS NULL',
      );
    }

    if (filters.has?.includes('errors')) {
      qb.andWhere(
        `(
          statement.status = :errorStatus OR
          statement.errorMessage IS NOT NULL OR
          jsonb_array_length(COALESCE(statement.parsingDetails->'errors', '[]'::jsonb)) > 0
        )`,
        { errorStatus: StatementStatus.ERROR },
      );
    }

    if (filters.has?.includes('processingDetails')) {
      qb.andWhere(
        "jsonb_array_length(COALESCE(statement.parsingDetails->'logEntries', '[]'::jsonb)) > 0",
      );
    }

    if (filters.has?.includes('transactions')) {
      qb.andWhere('statement.totalTransactions > 0');
    }

    if (filters.has?.includes('dateRange')) {
      qb.andWhere(
        '(statement.statementDateFrom IS NOT NULL OR statement.statementDateTo IS NOT NULL)',
      );
    }

    if (filters.has?.includes('currency')) {
      qb.andWhere(
        `(
          statement.currency IS NOT NULL OR
          statement.parsingDetails->'metadataExtracted'->>'currency' IS NOT NULL OR
          statement.parsingDetails->'metadataExtracted'->'headerDisplay'->>'currencyDisplay' IS NOT NULL
        )`,
      );
    }

    if (filters.categoryId) {
      const categorySubQuery = this.transactionRepository
        .createQueryBuilder('transaction')
        .select('DISTINCT transaction.statementId')
        .where('transaction.workspaceId = :workspaceId', { workspaceId })
        .andWhere('transaction.statementId IS NOT NULL');

      if (filters.categoryId === 'uncategorized') {
        categorySubQuery.andWhere('transaction.categoryId IS NULL');
      } else {
        categorySubQuery.andWhere('transaction.categoryId = :categoryId', {
          categoryId: filters.categoryId,
        });
      }

      qb.andWhere(`statement.id IN (${categorySubQuery.getQuery()})`).setParameters(
        categorySubQuery.getParameters(),
      );
    }

    if (filters.groupBy === 'date') {
      qb.orderBy(statementDateExpression, 'ASC');
    } else if (filters.groupBy === 'status') {
      qb.orderBy('statement.status', 'ASC');
    } else if (filters.groupBy === 'type') {
      qb.orderBy('statement.fileType', 'ASC');
    } else if (filters.groupBy === 'bank') {
      qb.orderBy('statement.bankName', 'ASC');
    } else if (filters.groupBy === 'user') {
      qb.orderBy(`LOWER(COALESCE(user.name, user.email, ''))`, 'ASC');
    } else if (filters.groupBy === 'amount') {
      qb.orderBy(amountExpression, 'ASC');
    }

    const [dataRaw, totalCount] = await qb.getManyAndCount();
    const transactionSummaries = await this.loadTransactionSummaries(
      workspaceId,
      dataRaw.map(statement => statement.id),
    );
    const data = await Promise.all(
      dataRaw.map(async st => {
        const availability = await this.fileStorageService.getFileAvailability(st);
        const statement = this.attachFileAvailability(st, availability);
        statement.transactionSummary = transactionSummaries.get(st.id) ?? {
          description: null,
          exchangeRate: null,
          exchangeRateMixed: false,
          cardLabel: null,
        };
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

  async findOne(id: string, workspaceId: string): Promise<Statement> {
    const statementRepository = this
      .statementRepository as StatementRepositoryWithOptionalQueryBuilder;

    if (typeof statementRepository.createQueryBuilder !== 'function') {
      const statement = await this.statementRepository.findOne({
        where: { id, workspaceId },
        relations: ['transactions', 'user'],
      });

      if (!statement) {
        throw new NotFoundException('Statement not found');
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
      throw new NotFoundException('Statement not found');
    }

    const availability = await this.fileStorageService.getFileAvailability(statement);
    this.attachFileAvailability(statement, availability);

    return statement;
  }

  async updateMetadata(
    id: string,
    userId: string,
    workspaceId: string,
    updateDto: UpdateStatementDto,
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
      const fileData = await fs.promises.readFile(file.path);
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
    const statement = await this.findOne(id, workspaceId);
    await this.ensureCanModify(statement, userId, workspaceId);

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
      relations: ['user'],
    });

    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    await this.ensureCanModify(statement, userId, workspaceId);

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

    // Delete file from filesystem
    if (fs.existsSync(statement.filePath)) {
      try {
        fs.unlinkSync(statement.filePath);
      } catch (error) {
        this.logger.error(`Failed to delete file ${statement.filePath}:`, error);
        // Continue with statement deletion even if file deletion fails
      }
    }

    // Finally delete the statement
    await this.statementRepository.remove(statement);

    // Invalidate thumbnail cache
    await this.cacheManager.del(`statements:thumbnail:${id}`);
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
        if (timeDiff > 1000) {
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
      select: ['id', 'name', 'email'],
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
    const statement = await this.findOne(id, workspaceId);
    const { stream, fileName, mimeType } =
      await this.fileStorageService.getStatementFileStream(statement);
    return { stream, fileName, mimeType };
  }

  async restoreFile(id: string, userId: string, workspaceId: string) {
    const statement = await this.statementRepository.findOne({
      where: { id, workspaceId },
      relations: ['user'],
    });

    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    await this.ensureCanModify(statement, userId, workspaceId);

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
      throw new NotFoundException('File data is unavailable for restore');
    }
    return { status: 'restored', source: restored.source };
  }

  async getThumbnail(id: string, workspaceId: string, requestedWidth?: number): Promise<Buffer> {
    const statement = await this.findOne(id, workspaceId);

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
      throw new BadRequestException('Thumbnails are only available for PDF files');
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
      throw new NotFoundException('File data not available');
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
      throw new BadRequestException('Failed to generate thumbnail');
    }
  }

  async exportZip(workspaceId: string, outputStream: NodeJS.WritableStream): Promise<void> {
    const { data: statements } = await this.findAll(workspaceId, {});

    const archive = archiver('zip', { zlib: { level: 5 } });
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
