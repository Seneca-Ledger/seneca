import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, type QueryDeepPartialEntity, Repository } from 'typeorm';
import type { CaptureLocation } from '../../common/utils/capture-location.util';
import { currencyCodeOrDefault } from '../../common/utils/currency.util';
import { normalizePagination } from '../../common/utils/pagination.util';
import { payeeKeyOf } from '../../common/utils/payee-key.util';
import { taxLockedConflict } from '../../common/utils/tax-lock.util';
import { assertWorkspaceOwned } from '../../common/utils/workspace-refs.util';
import type { ReceiptsQuery } from '../../contracts';
import {
  Category,
  Receipt,
  ReceiptJobStatus,
  ReceiptProcessingJob,
  ReceiptSource,
  ReceiptStatus,
  Statement,
  TaxRate,
  Transaction,
  TransactionType,
  VatStatus,
  Workspace,
} from '../../entities';
import { ActorType, AuditAction, EntityType } from '../../entities/audit-event.entity';
import { TaxSource, TransactionCategorySource } from '../../entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';
import { hasDecidedCategory } from '../classification/engine/category-decision';
import {
  type ReceiptApprovedEvent,
  transactionCreatedEvent,
} from '../notifications/events/notification-events';
import { resolvePayeeId } from '../payees/payee-resolution';
import { TaxAssignmentService } from '../tax/tax-assignment.service';
import { TransactionAttachmentsService } from '../transactions/services/transaction-attachments.service';
import { WorkspaceCurrencyService } from '../workspaces/workspace-currency.service';
import {
  attachReceiptCategories,
  type ReceiptWithCategory,
} from './helpers/attach-receipt-categories';
import { ReceiptProcessorService } from './services/receipt-processor.service';

export interface ApproveReceiptOptions {
  /** Bank row to attach to; `null` forces a new transaction; omitted uses the stored suggestion. */
  attachTo?: string | null;
  /** Who approved; needed to record the copied file attachment. */
  userId?: string;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

function mimeTypeOf(fileName: string): string {
  return MIME_BY_EXTENSION[path.extname(fileName).toLowerCase()] ?? 'application/octet-stream';
}

type UploadParams = {
  userId: string;
  workspaceId: string;
  files: Express.Multer.File[];
  language?: string;
  captureLocation?: CaptureLocation;
};

type ScanParams = {
  userId: string;
  workspaceId: string;
  file: Express.Multer.File;
  language?: string;
  captureLocation?: CaptureLocation;
  /** Where the file came from; defaults to the in-app camera scan. */
  source?: ReceiptSource;
};

const MANUAL_RECEIPT_WORKER_ID = 'manual-receipt-sync';

/** How an approval settled a receipt. */
/** What `GET`/`PUT /receipts/:id/tax` answer (contract `ReceiptTax`). */
export interface ReceiptTaxView {
  transactionId: string | null;
  assessable: boolean;
  locked: boolean;
  taxRateId: string | null;
  taxSource: TaxSource | null;
  taxAmount: number | null;
}

type ApproveMode = NonNullable<ReceiptApprovedEvent['mode']>;

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptProcessingJob)
    private readonly jobRepository: Repository<ReceiptProcessingJob>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly receiptProcessor: ReceiptProcessorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    private readonly workspaceCurrency: WorkspaceCurrencyService,
    @Optional()
    private readonly attachmentsService?: TransactionAttachmentsService,
    @Optional()
    private readonly taxAssignmentService?: TaxAssignmentService,
  ) {}

  async createFromUpload(params: UploadParams): Promise<Receipt> {
    const [file] = params.files;
    const receipt = this.buildReceipt({
      userId: params.userId,
      workspaceId: params.workspaceId,
      source: ReceiptSource.UPLOAD,
      file,
      language: params.language,
      captureLocation: params.captureLocation,
    });

    const savedReceipt = await this.receiptRepository.save(receipt);
    const job = await this.createManualJob(
      savedReceipt.id,
      params.userId,
      'manual-upload',
      params.language,
    );
    await this.receiptProcessor.processReceipt(job);

    const result =
      (await this.receiptRepository.findOne({
        where: { id: savedReceipt.id, workspaceId: params.workspaceId },
      })) ?? savedReceipt;
    await this.recordCreate(result, params.userId, params.workspaceId);
    return result;
  }

  async createFromScan(params: ScanParams): Promise<Receipt> {
    const receipt = this.buildReceipt({
      userId: params.userId,
      workspaceId: params.workspaceId,
      source: params.source ?? ReceiptSource.SCAN,
      file: params.file,
      language: params.language,
      captureLocation: params.captureLocation,
    });

    const savedReceipt = await this.receiptRepository.save(receipt);
    const job = await this.createManualJob(
      savedReceipt.id,
      params.userId,
      'manual-scan',
      params.language,
    );
    await this.receiptProcessor.processReceipt(job);

    const result =
      (await this.receiptRepository.findOne({
        where: { id: savedReceipt.id, workspaceId: params.workspaceId },
      })) ?? savedReceipt;
    await this.recordCreate(result, params.userId, params.workspaceId);
    return result;
  }

  async findAll(workspaceId: string, query: ReceiptsQuery) {
    const { page, limit, skip } = normalizePagination(query);
    const where: Record<string, unknown> = { workspaceId };

    if (query.source) {
      where.source = query.source;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.statementId) {
      where.statementId = query.statementId;
    }

    const [data, total] = await this.receiptRepository.findAndCount({
      where,
      order: { receivedAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data: await this.withCategories(data, workspaceId), total, page, limit };
  }

  async findOne(
    id: string,
    workspaceId: string,
  ): Promise<(ReceiptWithCategory & { transactionSplit: boolean }) | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }
    const [withCategory] = await this.withCategories([receipt], workspaceId);
    // Whether the row it documents is split by its items, so the page offers undo.
    const transaction = receipt.transactionId
      ? await this.transactionRepository.findOne({
          where: { id: receipt.transactionId, workspaceId },
          select: { id: true, splitGroupId: true },
        })
      : null;
    return Object.assign(withCategory, { transactionSplit: Boolean(transaction?.splitGroupId) });
  }

  private withCategories(receipts: Receipt[], workspaceId: string): Promise<ReceiptWithCategory[]> {
    return attachReceiptCategories(receipts, this.categoryRepository, workspaceId);
  }

  async update(
    id: string,
    workspaceId: string,
    dto: {
      status?: ReceiptStatus;
      parsedData?: Record<string, unknown>;
      statementId?: string | null;
    },
    // Only a user's edit is audited; the scan linking its own statement passes none.
    userId?: string,
  ) {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }
    // The category is copied onto the receipt's transaction: one of this workspace's only.
    await assertWorkspaceOwned(
      this.receiptRepository.manager,
      Category,
      [dto.parsedData?.categoryId as string | null | undefined],
      workspaceId,
    );
    const before = this.changedFields(receipt, dto);

    if (dto.status) {
      receipt.status = dto.status;
    }

    if (dto.parsedData) {
      // Where a category came from is the server's to say, never the client's.
      const { categorySource: _source, categoryReason: _reason, ...edits } = dto.parsedData;
      receipt.parsedData = {
        ...(receipt.parsedData ?? {}),
        ...edits,
      };
      // A category a person picked on the receipt is theirs, and teaches the payee.
      if (userId && dto.parsedData.categoryId !== undefined) {
        receipt.parsedData.categorySource = dto.parsedData.categoryId
          ? TransactionCategorySource.MANUAL
          : null;
        receipt.parsedData.categoryReason = null;
      }
    }

    if (dto.statementId !== undefined) {
      receipt.statementId = dto.statementId;
    }

    const saved = await this.receiptRepository.save(receipt);
    await this.syncStatementCategory(saved, workspaceId);
    if (dto.parsedData) {
      await this.syncBookedTransaction(saved, workspaceId, dto.parsedData);
    }

    if (userId) {
      await this.recordAudit({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.RECEIPT,
        entityId: saved.id,
        action: AuditAction.UPDATE,
        diff: { before, after: this.changedFields(saved, dto) },
      });
    }

    return saved;
  }

  /**
   * The tax on the transaction the receipt stands for: the row it was approved
   * into or attached to, else its scan's row. Null when the receipt is unknown.
   */
  async getTax(id: string, workspaceId: string): Promise<ReceiptTaxView | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }
    return this.taxView(await this.findReceiptTransaction(receipt, workspaceId), workspaceId);
  }

  /**
   * Pins the rate a person picked on the receipt to its transaction, or with
   * null hands the row back to the rules and the workspace default. The figures
   * are worked out by the tax engine, as for any other row.
   */
  async setTax(
    id: string,
    workspaceId: string,
    taxRateId: string | null,
    userId: string,
  ): Promise<ReceiptTaxView | null> {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }
    const target = await this.findReceiptTransaction(receipt, workspaceId);
    if (!target) {
      throw new ConflictException('The receipt has no transaction to tax yet');
    }
    if (target.taxLocked) {
      throw taxLockedConflict(1);
    }
    if (taxRateId) {
      const owned = await this.transactionRepository.manager
        .getRepository(TaxRate)
        .exists({ where: { id: taxRateId, workspaceId } });
      if (!owned) {
        throw new NotFoundException('Tax rate not found');
      }
    }

    const before = { taxRateId: target.taxRateId, taxSource: target.taxSource };
    await this.transactionRepository.update(
      { id: target.id, workspaceId, taxLocked: false },
      taxRateId
        ? { taxRateId, taxSource: TaxSource.MANUAL }
        : // Not manual any more, so reassess derives the rate again.
          { taxRateId: null, taxSource: null },
    );
    await this.taxAssignmentService?.reassess(workspaceId, { ids: [target.id] });

    const updated = await this.transactionRepository.findOneOrFail({
      where: { id: target.id, workspaceId },
    });
    await this.recordAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.TRANSACTION,
      entityId: target.id,
      action: AuditAction.UPDATE,
      diff: { before, after: { taxRateId: updated.taxRateId, taxSource: updated.taxSource } },
    });
    return this.taxView(updated, workspaceId);
  }

  private async findReceiptTransaction(
    receipt: Receipt,
    workspaceId: string,
  ): Promise<Transaction | null> {
    return receipt.transactionId
      ? this.transactionRepository.findOne({ where: { id: receipt.transactionId, workspaceId } })
      : this.findScanTransaction(this.transactionRepository.manager, receipt, workspaceId);
  }

  private async taxView(
    transaction: Transaction | null,
    workspaceId: string,
  ): Promise<ReceiptTaxView> {
    const workspace = await this.transactionRepository.manager.getRepository(Workspace).findOne({
      where: { id: workspaceId },
      select: {
        id: true,
        vatStatus: true,
      },
    });
    return {
      transactionId: transaction?.id ?? null,
      assessable: workspace?.vatStatus === VatStatus.REGISTERED,
      locked: transaction?.taxLocked ?? false,
      taxRateId: transaction?.taxRateId ?? null,
      taxSource: transaction?.taxSource ?? null,
      taxAmount: transaction?.taxAmount ?? null,
    };
  }

  /**
   * A scan receipt is converted into a statement before the user ever opens it,
   * so the statement carries the fallback category picked at conversion time.
   * When the user then picks a category on the receipt, the statement has to
   * follow — otherwise the choice is invisible everywhere the statement is shown.
   */
  private async syncStatementCategory(receipt: Receipt, workspaceId: string): Promise<void> {
    const categoryId = receipt.parsedData?.categoryId;
    if (!(receipt.statementId && categoryId)) {
      return;
    }

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, workspaceId },
      select: {
        id: true,
      },
    });
    if (!category) {
      return;
    }

    const statement = await this.statementRepository.findOne({
      where: { id: receipt.statementId, workspaceId },
    });
    if (!statement) {
      return;
    }

    await this.statementRepository.update(
      { id: statement.id, workspaceId },
      { categoryId: category.id },
    );

    // The dashboard aggregates by transaction category, so the transaction the
    // scan produced has to follow the receipt too — otherwise the spend stays
    // filed under the fallback category picked at conversion time. Statements
    // parsed from a bank file carry unrelated transactions and are left alone.
    if (statement.parsingDetails?.detectedBy === 'receipt-scan') {
      // Rows on a filed tax return keep the category they were filed under.
      await this.transactionRepository.update(
        { statementId: statement.id, workspaceId, taxLocked: false },
        {
          categoryId: category.id,
          categorySource: receipt.parsedData?.categorySource ?? null,
          categoryReason: receipt.parsedData?.categoryReason ?? null,
        },
      );
      // update() skips the tax subscriber; the new category may carry another rate.
      await this.taxAssignmentService?.reassess(workspaceId, { statementId: statement.id });
    }
  }

  /**
   * Every figure sums transactions, not receipts, so an edit to a receipt has
   * to reach the row it stands for, or the documents list shows one date and
   * every number another. The row the receipt booked itself (its scan's row, or
   * the one approval created) takes every field the edit touched. A scan's row
   * exists before approval, while the receipt has no transactionId yet: Review
   * lists it. A row it was attached to (a bank row) keeps the bank's date and
   * amount and takes only a category picked here. A row filed on a tax return
   * does not change.
   */
  private async syncBookedTransaction(
    receipt: Receipt,
    workspaceId: string,
    edits: Record<string, unknown>,
  ): Promise<void> {
    const target = receipt.transactionId
      ? await this.transactionRepository.findOne({
          where: { id: receipt.transactionId, workspaceId },
        })
      : await this.findScanTransaction(this.transactionRepository.manager, receipt, workspaceId);
    if (!target || target.taxLocked) {
      return;
    }

    if (await this.isBookedByReceipt(receipt, target, workspaceId)) {
      const touched = Object.keys(edits).some(key => SYNCED_RECEIPT_FIELDS.has(key));
      if (!touched) {
        return;
      }
      const currency = await this.workspaceCurrency.resolve(workspaceId);
      const fields = receiptTransactionFields(receipt, workspaceId, currency);
      await assertWorkspaceOwned(
        this.transactionRepository.manager,
        Category,
        [fields.categoryId],
        workspaceId,
      );
      await this.transactionRepository.update(
        { id: target.id, workspaceId },
        {
          ...scanTransactionUpdate(fields, Boolean(receipt.parsedData?.date)),
          // update() skips the subscriber: the vendor may have changed.
          payeeId: await resolvePayeeId(this.transactionRepository.manager, workspaceId, fields),
        },
      );
    } else if (receipt.parsedData?.categoryId && edits.categoryId !== undefined) {
      await this.transactionRepository.update(
        { id: target.id, workspaceId },
        {
          categoryId: receipt.parsedData.categoryId,
          categorySource: receipt.parsedData.categorySource ?? null,
          categoryReason: receipt.parsedData.categoryReason ?? null,
        },
      );
    } else {
      return;
    }
    // update() skips the tax subscriber; the new amount or category may carry another rate.
    await this.taxAssignmentService?.reassess(workspaceId, { ids: [target.id] });
  }

  /**
   * Whether the receipt booked this row itself rather than being attached to an
   * existing one: the row on its own scan's statement, or a row approval created
   * (no statement, wallet or crypto wallet; a bank row always has a statement).
   */
  private async isBookedByReceipt(
    receipt: Receipt,
    target: Transaction,
    workspaceId: string,
  ): Promise<boolean> {
    if (target.statementId) {
      if (target.statementId !== receipt.statementId) {
        return false;
      }
      const statement = await this.statementRepository.findOne({
        where: { id: target.statementId, workspaceId },
        select: {
          id: true,
          parsingDetails: true,
        },
      });
      return statement?.parsingDetails?.detectedBy === 'receipt-scan';
    }
    return !(target.walletId || target.cryptoWalletId);
  }

  async approve(
    id: string,
    workspaceId: string,
    userId: string,
    options: { attachTo?: string | null } = {},
  ) {
    const workspaceCurrency = await this.workspaceCurrency.resolve(workspaceId);
    const result = await this.approveOnce(
      id,
      workspaceId,
      receipt => this.buildTransactionFromReceipt(receipt, workspaceId, workspaceCurrency),
      { ...options, userId },
    );
    if (!result) {
      return null;
    }
    if (result.created || result.attached) {
      await this.recordAudit(this.approveEvent(result, userId, workspaceId));
    }
    return { receipt: result.receipt, transaction: result.transaction, attached: result.attached };
  }

  /**
   * Turns a receipt into its transaction at most once. The receipt row is locked
   * for the duration, so a repeated or concurrent approve finds the transaction
   * the first one made and returns it instead of booking the expense twice.
   * Every approve path goes through it;
   * `buildTransaction` only decides the new transaction's fields.
   */
  async approveOnce(
    receiptId: string,
    workspaceId: string,
    buildTransaction: (receipt: Receipt) => Partial<Transaction>,
    options: ApproveReceiptOptions = {},
  ): Promise<{
    receipt: Receipt;
    transaction: Transaction;
    created: boolean;
    /** The receipt was attached to a transaction that already existed: a bank row, or its scan's own. */
    attached: boolean;
    /** How this call approved it; null when it had been approved before. */
    mode: ApproveMode | null;
    previousStatus: ReceiptStatus;
  } | null> {
    const result = await this.receiptRepository.manager.transaction(async manager => {
      const receipts = manager.getRepository(Receipt);
      const transactions = manager.getRepository(Transaction);
      const receipt = await receipts.findOne({
        where: { id: receiptId, workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!receipt) {
        return null;
      }
      if (receipt.transactionId) {
        const existing = await transactions.findOne({
          where: { id: receipt.transactionId, workspaceId },
        });
        if (existing) {
          return {
            receipt,
            transaction: existing,
            created: false,
            attached: false,
            mode: null as ApproveMode | null,
            previousStatus: receipt.status,
          };
        }
      }

      const scanTransaction = await this.findScanTransaction(manager, receipt, workspaceId);

      // Attach to the bank row the receipt documents (the suggestion, or the
      // one the user picked) instead of booking the expense a second time.
      // `attachTo: null` is the explicit "no, this is a new expense".
      const attachTo =
        options.attachTo === undefined
          ? (receipt.metadata?.transactionMatch?.transactionIds?.[0] ?? null)
          : options.attachTo;
      if (attachTo) {
        const target = await transactions.findOne({ where: { id: attachTo, workspaceId } });
        if (!target) {
          throw new NotFoundException('Transaction to attach to was not found');
        }
        const taken = await receipts.findOne({
          where: { transactionId: attachTo, workspaceId },
          select: {
            id: true,
          },
        });
        if (taken && taken.id !== receipt.id) {
          throw new ConflictException('Another receipt is already attached to that transaction');
        }
        // The bank row is the real payment; the transaction the scan booked
        // would count it twice. Flagged, not deleted, like any duplicate.
        // Flagging the scan row as a duplicate would take it out of a return it
        // was filed on, and a filed row's category is fixed.
        if (scanTransaction?.taxLocked && scanTransaction.id !== target.id) {
          throw taxLockedConflict(1);
        }
        if (scanTransaction && scanTransaction.id !== target.id) {
          await transactions.update(
            { id: scanTransaction.id, workspaceId },
            { isDuplicate: true, duplicateOfId: target.id },
          );
        }
        // Approving the receipt confirms the bank row it documents. As with a
        // matched entry in YNAB, the receipt's category wins over whatever the
        // import filled in, but never over one a person or their rule chose.
        const takesCategory =
          receipt.parsedData?.categoryId && !hasDecidedCategory(target) && !target.taxLocked;
        if (takesCategory) {
          await assertWorkspaceOwned(
            manager,
            Category,
            [receipt.parsedData.categoryId],
            workspaceId,
          );
        }
        await transactions.update(
          { id: target.id, workspaceId },
          takesCategory
            ? {
                isVerified: true,
                categoryId: receipt.parsedData.categoryId,
                categorySource: receipt.parsedData.categorySource ?? null,
                categoryReason: receipt.parsedData.categoryReason ?? null,
              }
            : { isVerified: true },
        );
        const previousStatus = receipt.status;
        receipt.status = ReceiptStatus.APPROVED;
        receipt.transactionId = target.id;
        const saved = await receipts.save(receipt);
        return {
          receipt: saved,
          transaction: target,
          created: false,
          attached: true,
          mode: (scanTransaction?.id === target.id
            ? 'confirmed_scan'
            : 'attached_to_bank_row') as ApproveMode,
          previousStatus,
        };
      }

      // A scan booked its transaction at upload; approving confirms it with the
      // receipt as it stands now instead of booking the expense again.
      if (scanTransaction?.taxLocked) {
        throw taxLockedConflict(1);
      }
      // Whatever the stored or the requested category, it must be one of this workspace's.
      const fields = buildTransaction(receipt);
      await assertWorkspaceOwned(manager, Category, [fields.categoryId], workspaceId);
      if (scanTransaction) {
        await transactions.update(
          { id: scanTransaction.id, workspaceId },
          {
            ...scanTransactionUpdate(fields, Boolean(receipt.parsedData?.date)),
            // update() skips the subscriber: the vendor may have been corrected since the upload.
            payeeId: await resolvePayeeId(manager, workspaceId, fields),
            isVerified: true,
          },
        );
        const previousStatus = receipt.status;
        receipt.status = ReceiptStatus.APPROVED;
        receipt.transactionId = scanTransaction.id;
        const saved = await receipts.save(receipt);
        const confirmed = await transactions.findOneOrFail({
          where: { id: scanTransaction.id, workspaceId },
        });
        return {
          receipt: saved,
          transaction: confirmed,
          created: false,
          attached: true,
          mode: 'confirmed_scan' as ApproveMode,
          previousStatus,
        };
      }

      const transaction = await transactions.save(
        transactions.create(withLedgerSides({ ...fields, isVerified: true })),
      );
      const previousStatus = receipt.status;
      receipt.status = ReceiptStatus.APPROVED;
      receipt.transactionId = transaction.id;
      const saved = await receipts.save(receipt);
      return {
        receipt: saved,
        transaction,
        created: true,
        attached: false,
        mode: 'created' as ApproveMode,
        previousStatus,
      };
    });

    if (result?.attached) {
      await this.copyFileToTransaction(result.receipt, result.transaction.id, options.userId);
    }

    if (result?.mode) {
      this.eventEmitter
        .emitAsync('receipt.approved', {
          workspaceId: result.receipt.workspaceId,
          receiptId: result.receipt.id,
          transactionId: result.transaction.id,
          mode: result.mode,
        } satisfies ReceiptApprovedEvent)
        .catch(err => this.logger.error('Failed to emit receipt.approved event', err));
    }
    if (result?.created) {
      this.eventEmitter.emit(
        'transaction.created',
        transactionCreatedEvent(result.transaction, 'receipt_approval'),
      );
    }
    return result;
  }

  /**
   * The transaction a scan upload booked for this receipt. Only a scan's own
   * statement qualifies: a bank statement uploaded through the scan holds
   * unrelated rows.
   */
  private async findScanTransaction(
    manager: EntityManager,
    receipt: Receipt,
    workspaceId: string,
  ): Promise<Transaction | null> {
    if (!receipt.statementId) {
      return null;
    }
    const statement = await manager.getRepository(Statement).findOne({
      where: { id: receipt.statementId, workspaceId },
      select: {
        id: true,
        parsingDetails: true,
      },
    });
    if (statement?.parsingDetails?.detectedBy !== 'receipt-scan') {
      return null;
    }
    return manager
      .getRepository(Transaction)
      .findOne({ where: { statementId: statement.id, workspaceId } });
  }

  async bulkApprove(
    receiptIds: string[],
    workspaceId: string,
    userId: string,
    categoryId?: string,
  ) {
    await assertWorkspaceOwned(this.receiptRepository.manager, Category, [categoryId], workspaceId);
    // Resolved once for the batch: a receipt whose parse found no currency is
    // booked in the workspace's own.
    const workspaceCurrency = await this.workspaceCurrency.resolve(workspaceId);
    const results = {
      approved: 0,
      failed: 0,
      errors: [] as Array<{ receiptId: string; error: string }>,
    };
    const auditEvents: CreateAuditEventDto[] = [];

    for (const receiptId of receiptIds) {
      try {
        const receipt = await this.receiptRepository.findOne({
          where: { id: receiptId, workspaceId },
        });

        if (!receipt) {
          results.failed += 1;
          results.errors.push({ receiptId, error: 'Receipt not found' });
          continue;
        }

        if (!(receipt.parsedData?.amount && receipt.parsedData?.date)) {
          results.failed += 1;
          results.errors.push({ receiptId, error: 'Missing required data' });
          continue;
        }

        const approved = await this.approveOnce(
          receiptId,
          workspaceId,
          locked =>
            this.buildTransactionFromReceipt(locked, workspaceId, workspaceCurrency, categoryId),
          { userId },
        );
        if (!approved) {
          results.failed += 1;
          results.errors.push({ receiptId, error: 'Receipt not found' });
          continue;
        }
        results.approved += 1;
        if (approved.created || approved.attached) {
          auditEvents.push(this.approveEvent(approved, userId, workspaceId));
        }
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          receiptId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.recordBatchAudit(auditEvents);

    return results;
  }

  async delete(id: string, workspaceId: string, userId: string) {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    let statementDeleted = false;

    if (receipt?.statementId) {
      const statement = await this.statementRepository.findOne({
        where: { id: receipt.statementId, workspaceId },
      });

      if (statement && !statement.deletedAt) {
        statement.deletedAt = new Date();
        await this.statementRepository.save(statement);
        statementDeleted = true;
      }
    }

    for (const attachmentPath of receipt?.attachmentPaths ?? []) {
      try {
        await fs.unlink(attachmentPath);
      } catch {
        // Best-effort cleanup: missing or already-removed files should not block deletion.
      }
    }

    await this.receiptRepository.delete({ id, workspaceId });

    if (receipt) {
      await this.recordAudit({
        workspaceId,
        actorType: ActorType.USER,
        actorId: userId,
        entityType: EntityType.RECEIPT,
        entityId: receipt.id,
        action: AuditAction.DELETE,
        diff: { before: receiptAuditSnapshot(receipt), after: null },
        meta: { statementId: receipt.statementId ?? null, statementDeleted },
      });
    }
    return { success: true };
  }

  private async recordCreate(receipt: Receipt, userId: string, workspaceId: string) {
    await this.recordAudit({
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.RECEIPT,
      entityId: receipt.id,
      action: AuditAction.CREATE,
      diff: { before: null, after: receiptAuditSnapshot(receipt) },
      meta: { source: receipt.source, fileName: receipt.subject },
    });
  }

  private approveEvent(
    result: { receipt: Receipt; transaction: Transaction; previousStatus: ReceiptStatus },
    userId: string,
    workspaceId: string,
  ): CreateAuditEventDto {
    return {
      workspaceId,
      actorType: ActorType.USER,
      actorId: userId,
      entityType: EntityType.RECEIPT,
      entityId: result.receipt.id,
      action: AuditAction.UPDATE,
      diff: {
        before: { status: result.previousStatus, transactionId: null },
        after: { status: result.receipt.status, transactionId: result.transaction.id },
      },
      meta: { approved: true },
    };
  }

  /** The fields an update touches, so the diff shows only what the user changed. */
  private changedFields(
    receipt: Receipt,
    dto: {
      status?: ReceiptStatus;
      parsedData?: Record<string, unknown>;
      statementId?: string | null;
    },
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    if (dto.status) {
      fields.status = receipt.status;
    }
    if (dto.statementId !== undefined) {
      fields.statementId = receipt.statementId ?? null;
    }
    if (dto.parsedData) {
      const parsed = (receipt.parsedData ?? {}) as Record<string, unknown>;
      fields.parsedData = Object.fromEntries(
        Object.keys(dto.parsedData).map(key => [key, parsed[key] ?? null]),
      );
    }
    return fields;
  }

  private async recordBatchAudit(events: CreateAuditEventDto[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    try {
      await this.auditService.createBatchEvents(events, randomUUID());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit events failed for bulk receipt approval: ${message}`);
    }
  }

  // An audit failure must never fail the user's operation.
  private async recordAudit(event: CreateAuditEventDto): Promise<void> {
    try {
      await this.auditService.createEvent(event);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Audit event failed for receipt ${event.entityId}: ${message}`);
    }
  }

  async getFilePayload(id: string, workspaceId: string) {
    const receipt = await this.receiptRepository.findOne({ where: { id, workspaceId } });
    if (!receipt) {
      return null;
    }

    const attachment = receipt.metadata?.attachments?.[0];
    const filePath = receipt.attachmentPaths?.[0];

    if (!(attachment && filePath)) {
      return null;
    }

    const buffer = await fs.readFile(filePath);

    return {
      buffer,
      fileName: attachment.filename || receipt.subject,
      mimeType: attachment.mimeType || 'application/octet-stream',
    };
  }

  private async createManualJob(
    receiptId: string,
    userId: string,
    integrationId: 'manual-upload' | 'manual-scan',
    language?: string,
  ): Promise<ReceiptProcessingJob> {
    const job = this.jobRepository.create({
      userId,
      receiptId,
      status: ReceiptJobStatus.PROCESSING,
      progress: 0,
      lockedAt: new Date(),
      lockedBy: MANUAL_RECEIPT_WORKER_ID,
      payload: {
        integrationId,
        messageId: receiptId,
        historyId: language ?? 'auto',
      },
    });

    return this.jobRepository.save(job);
  }

  private buildReceipt(params: {
    userId: string;
    workspaceId: string;
    source: ReceiptSource;
    file: Express.Multer.File;
    language?: string;
    captureLocation?: CaptureLocation;
  }): Receipt {
    return this.receiptRepository.create({
      userId: params.userId,
      workspaceId: params.workspaceId,
      source: params.source,
      messageId: null,
      subject: params.file.originalname,
      sender:
        params.source === ReceiptSource.SCAN
          ? 'camera-scan'
          : params.source === ReceiptSource.TELEGRAM
            ? 'telegram'
            : 'manual-upload',
      receivedAt: new Date(),
      status: ReceiptStatus.NEW,
      attachmentPaths: [params.file.path],
      metadata: {
        attachments: [
          {
            id: params.file.filename,
            filename: params.file.originalname,
            mimeType: params.file.mimetype,
            size: params.file.size,
          },
        ],
        ...(params.captureLocation
          ? {
              captureLocation: {
                ...params.captureLocation,
                source: 'device' as const,
                capturedAt: new Date().toISOString(),
              },
            }
          : {}),
      },
      language: params.language && params.language !== 'auto' ? params.language : null,
      extractionMethod: null,
      confidence: null,
      isDuplicate: false,
    });
  }

  /**
   * The receipt image goes onto the bank row as an attachment, so it is found
   * where the expense is. Best effort: a missing file must not undo an approve.
   */
  private async copyFileToTransaction(
    receipt: Receipt,
    transactionId: string,
    userId: string | undefined,
  ): Promise<void> {
    const filePath = receipt.attachmentPaths?.[0];
    if (!(filePath && userId && this.attachmentsService)) {
      return;
    }
    try {
      const buffer = await fs.readFile(filePath);
      const originalname = path.basename(filePath);
      await this.attachmentsService.create(transactionId, receipt.workspaceId, userId, {
        originalname,
        mimetype: mimeTypeOf(originalname),
        size: buffer.length,
        buffer,
      } as Express.Multer.File);
    } catch (error) {
      this.logger.warn(
        `Could not attach receipt ${receipt.id} file to transaction ${transactionId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private buildTransactionFromReceipt(
    receipt: Receipt,
    workspaceId: string,
    workspaceCurrency: string,
    categoryId?: string,
  ): Partial<Transaction> {
    // Without its own date the expense would be booked on the day it was
    // approved. Attaching to a bank row needs none: the bank's date stands.
    if (!receipt.parsedData?.date) {
      throw new BadRequestException('Set the receipt date before approving it');
    }
    return receiptTransactionFields(receipt, workspaceId, workspaceCurrency, categoryId);
  }
}

/** The receipt fields that live on the row it booked too, so an edit to one moves the row. */
const SYNCED_RECEIPT_FIELDS = new Set([
  'date',
  'amount',
  'currency',
  'vendor',
  'transactionType',
  'categoryId',
]);

/**
 * The row a receipt books, from its fields as they stand. Without a date the
 * transaction date is today's; callers that may lack one leave it out
 * (`scanTransactionUpdate`).
 */
function receiptTransactionFields(
  receipt: Receipt,
  workspaceId: string,
  workspaceCurrency: string,
  categoryId?: string,
): Partial<Transaction> {
  const transactionType =
    receipt.parsedData?.transactionType === 'income'
      ? TransactionType.INCOME
      : TransactionType.EXPENSE;

  const counterpartyName = receipt.parsedData?.vendor || receipt.subject || 'Unknown';
  const paymentPurpose = receipt.parsedData?.vendor || receipt.subject || '';
  return {
    statementId: null,
    workspaceId,
    transactionDate: receipt.parsedData?.date ? new Date(receipt.parsedData.date) : new Date(),
    counterpartyName,
    paymentPurpose,
    // Set here because a scan's row is confirmed with update(), which skips
    // the entity hook: the vendor may have been corrected since the upload.
    payeeKey: payeeKeyOf({ counterpartyName, paymentPurpose }),
    amount: receipt.parsedData?.amount ?? null,
    currency: currencyCodeOrDefault(receipt.parsedData?.currency, workspaceCurrency),
    // A category passed in is the one the person picked while approving.
    ...(categoryId
      ? { categoryId, categorySource: TransactionCategorySource.MANUAL, categoryReason: null }
      : {
          categoryId: receipt.parsedData?.categoryId || null,
          categorySource: receipt.parsedData?.categorySource ?? null,
          categoryReason: receipt.parsedData?.categoryReason ?? null,
        }),
    transactionType,
  };
}

/** Plain fields of a receipt for the audit diff: no file paths, metadata or relations. */
export function receiptAuditSnapshot(receipt: Receipt): Record<string, unknown> {
  return {
    source: receipt.source,
    status: receipt.status,
    subject: receipt.subject,
    vendor: receipt.parsedData?.vendor ?? null,
    amount: receipt.parsedData?.amount ?? null,
    currency: receipt.parsedData?.currency ?? null,
    date: receipt.parsedData?.date ?? null,
    categoryId: receipt.parsedData?.categoryId ?? null,
    statementId: receipt.statementId ?? null,
    transactionId: receipt.transactionId ?? null,
  };
}

/**
 * The receipt's fields for its scan's transaction. The transaction keeps its
 * statement, and a field the receipt lacks keeps its value: no amount parsed,
 * or no date (the builder would fall back to today).
 */
function scanTransactionUpdate(
  fields: Partial<Transaction>,
  hasDate: boolean,
): QueryDeepPartialEntity<Transaction> {
  const { statementId: _statementId, workspaceId: _workspaceId, transactionDate, ...rest } = fields;
  const update: QueryDeepPartialEntity<Transaction> = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== null && value !== undefined),
  );
  if (hasDate) {
    update.transactionDate = transactionDate;
  }
  return withLedgerSides(update as Partial<Transaction>) as QueryDeepPartialEntity<Transaction>;
}

/**
 * A booked row carries its amount on the side it moves: debit for spending,
 * credit for income. Every income and spending figure sums those two, so a row
 * with only an amount would count as nothing. A parse may hand the amount over
 * as text; it is a number by the time it is stored.
 */
function withLedgerSides<T extends Partial<Transaction>>(fields: T): T {
  if (fields.amount === null || fields.amount === undefined) {
    return fields;
  }
  const amount = Math.round(Math.abs(Number(fields.amount)) * 100) / 100;
  if (!Number.isFinite(amount)) {
    return fields;
  }
  const isExpense = fields.transactionType !== TransactionType.INCOME;
  return {
    ...fields,
    amount,
    debit: isExpense ? amount : null,
    credit: isExpense ? null : amount,
  };
}
