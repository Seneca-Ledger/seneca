import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Repository } from 'typeorm';
import { appError } from '../../common/errors/app-error';
import { calculateFileHash } from '../../common/utils/file-hash.util';
import { resolveFileType, validateFile } from '../../common/utils/file-validator.util';
import { normalizeFilename } from '../../common/utils/filename.util';
import { toMinor } from '../../common/utils/money.util';
import { readUploadedFile, resolveUploadsDir } from '../../common/utils/uploads.util';
import type { CreateManualExpenseBody } from '../../contracts';
import { Category, Wallet, WorkspaceMember } from '../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../entities/audit-event.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../entities/statement.entity';
import { TaxRate } from '../../entities/tax-rate.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../entities/transaction.entity';
import { User } from '../../entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { transactionCreatedEvent } from '../notifications/events/notification-events';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import { readManualExpenseInput } from './manual-expense-input';
import { ensureCanEditStatements } from './statement-access';
import { accountOfUpload, walletOwnerMemberId } from './statement-accounts';

function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/**
 * An expense typed in by hand, with or without a photo of its receipt: one
 * document with one row, its category the person's choice (the payee learns
 * it), its tax from that choice or the workspace's rules on that date.
 */
@Injectable()
export class ManualExpenseService {
  private readonly logger = new Logger(ManualExpenseService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Wallet)
    private readonly walletRepository: Repository<Wallet>,
    private readonly auditService: AuditService,
    private readonly taxAssignmentService: TaxAssignmentService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  async create(params: {
    user: User;
    workspaceId: string;
    payload: CreateManualExpenseBody;
    files: Express.Multer.File[];
  }): Promise<Statement> {
    const { user, workspaceId, payload, files } = params;
    await ensureCanEditStatements(this.workspaceMemberRepository, user.id, workspaceId);

    const {
      amountValue,
      merchant,
      currency,
      allowDuplicates,
      description,
      category,
      taxRateId,
      taxRate,
      transactionDate,
    } = await readManualExpenseInput(payload, workspaceId, {
      workspaceCurrency: this.workspaceCurrency,
      categories: this.categoryRepository,
      taxRates: this.taxRateRepository,
    });

    // Array.isArray, not `files || []`: `files` comes from a multipart
    // upload field decorated with @UploadedFiles(), and although Multer's
    // FilesInterceptor always produces an array (or omits the field), an
    // explicit type check rather than truthiness keeps that guarantee from
    // ever being taken on faith for this parameter.
    const normalizedFiles = Array.isArray(files) ? files : [];
    for (const file of normalizedFiles) {
      validateFile(file);
    }

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
      fileData = await readUploadedFile(primaryFile.path);
    } else {
      fileName = `manual-expense-${Date.now()}.csv`;
      filePath = path.join(resolveUploadsDir(), `${randomUUID()}.csv`);
      const csv = [
        'date,merchant,description,amount,currency',
        [
          payload.date,
          escapeCsvValue(merchant),
          escapeCsvValue(description),
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
    const accountId = await accountOfUpload(
      this.walletRepository,
      payload.walletId ?? undefined,
      workspaceId,
    );
    const accountOwner = accountId
      ? await walletOwnerMemberId(this.walletRepository, accountId, workspaceId)
      : null;

    let createdTransaction: Transaction | null = null;
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
        walletId: accountId,
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
        // The person filling the form picked it, so the payee learns from it.
        categorySource: TransactionCategorySource.MANUAL,
        taxRateId: taxAssignment.taxRateId ?? taxRate?.id ?? null,
        taxRuleId: taxAssignment.taxRuleId,
        taxSource: taxAssignment.taxSource,
        taxAmount: taxAssignment.taxAmount,
        taxNetAmount: taxAssignment.taxNetAmount,
        taxReverseCharge: taxAssignment.taxReverseCharge,
        taxNotionalAmount: taxAssignment.taxNotionalAmount,
        walletId: accountId,
        ownerMemberId: accountOwner,
        isVerified: true,
      });

      createdTransaction = await manager.getRepository(Transaction).save(transaction);
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

    // After the commit: a listener must never see a row that rolled back.
    if (createdTransaction) {
      this.eventEmitter?.emit(
        'transaction.created',
        transactionCreatedEvent(createdTransaction, 'manual_expense'),
      );
    }

    return savedStatement;
  }
}
