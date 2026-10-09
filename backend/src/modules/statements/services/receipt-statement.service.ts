import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import type { Repository } from 'typeorm';
import { workspaceMemberCanEdit } from '../../../common/authz/workspace-permissions';
import { appError } from '../../../common/errors/app-error';
import type { CaptureLocation } from '../../../common/utils/capture-location.util';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { calculateFileHash } from '../../../common/utils/file-hash.util';
import { getFileTypeFromMime } from '../../../common/utils/file-validator.util';
import { normalizeFilename } from '../../../common/utils/filename.util';
import { toMinor } from '../../../common/utils/money.util';
import { Category, WorkspaceMember } from '../../../entities';
import { ActorType, AuditAction, EntityType, Severity } from '../../../entities/audit-event.entity';
import { ReceiptStatus } from '../../../entities/receipt.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../../entities/statement.entity';
import { TaxRate } from '../../../entities/tax-rate.entity';
import { Transaction, TransactionType } from '../../../entities/transaction.entity';
import { User } from '../../../entities/user.entity';
import { AuditService } from '../../audit/audit.service';
import { ReceiptsService } from '../../receipts/receipts.service';
import { TaxAssignmentService } from '../../tax/tax-assignment.service';

@Injectable()
export class ReceiptStatementService {
  private readonly logger = new Logger(ReceiptStatementService.name);

  constructor(
    @InjectRepository(Statement)
    private readonly statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(TaxRate)
    private readonly taxRateRepository: Repository<TaxRate>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly receiptsService: ReceiptsService,
    private readonly auditService: AuditService,
    private readonly taxAssignmentService: TaxAssignmentService,
  ) {}

  async createFromReceiptScan(params: {
    user: User;
    workspaceId: string;
    files: Express.Multer.File[];
    language?: string;
    captureLocation?: CaptureLocation;
  }): Promise<Statement[]> {
    const { user, workspaceId, files, language, captureLocation } = params;
    await this.ensureCanEditStatements(user.id, workspaceId);

    if (!files?.length) {
      throw new BadRequestException('No receipt files provided');
    }

    const results: Statement[] = [];

    for (const file of files) {
      const statement = await this.createStatementFromReceiptFile({
        user,
        workspaceId,
        file,
        language,
        captureLocation,
      });
      results.push(statement);
    }

    return results;
  }

  private async ensureCanEditStatements(userId: string, workspaceId: string): Promise<void> {
    if (!workspaceId) {
      return;
    }

    const membership = await this.workspaceMemberRepository.findOne({
      where: { workspaceId, userId },
      select: ['role', 'permissions'],
    });

    if (!membership) {
      return;
    }

    if (!workspaceMemberCanEdit(membership.role, 'canEditStatements', membership.permissions)) {
      throw new ForbiddenException(appError('STATEMENTS_EDIT_FORBIDDEN'));
    }
  }

  private normalizePositiveAmount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private static readonly VENDOR_TO_BANK: { pattern: RegExp; bank: BankName }[] = [
    { pattern: /\bkaspi\b/i, bank: BankName.KASPI },
    { pattern: /\bкаспи/i, bank: BankName.KASPI },
    { pattern: /\bbereke\b/i, bank: BankName.BEREKE_NEW },
    { pattern: /\bбереке/i, bank: BankName.BEREKE_NEW },
    { pattern: /\bhapoalim\b/i, bank: BankName.HAPOALIM },
  ];

  private static detectBankFromVendor(vendor: string): BankName {
    for (const { pattern, bank } of ReceiptStatementService.VENDOR_TO_BANK) {
      if (pattern.test(vendor)) {
        return bank;
      }
    }
    return BankName.OTHER;
  }

  private resolveReceiptFailureMessage(receipt: {
    metadata?: Record<string, unknown> | null;
    parsedData?: Record<string, unknown> | null;
  }) {
    const metadataError = receipt.metadata?.processingError;
    if (typeof metadataError === 'string' && metadataError.trim()) {
      return metadataError;
    }

    const parsedIssues = receipt.parsedData?.validationIssues;
    if (Array.isArray(parsedIssues)) {
      const [firstIssue] = parsedIssues;
      if (typeof firstIssue === 'string' && firstIssue.trim()) {
        return firstIssue;
      }
    }

    return 'Receipt scan could not be processed';
  }

  private async createStatementFromReceiptFile(params: {
    user: User;
    workspaceId: string;
    file: Express.Multer.File;
    language?: string;
    captureLocation?: CaptureLocation;
  }): Promise<Statement> {
    const { user, workspaceId, file, language, captureLocation } = params;
    const fileName = normalizeFilename(file.originalname);
    const fileType = getFileTypeFromMime(file.mimetype) as FileType;
    const fileHash = await calculateFileHash(file.path);
    const fileData = await fs.promises.readFile(file.path);
    const receipt = await this.receiptsService.createFromScan({
      userId: user.id,
      workspaceId,
      file,
      language,
      captureLocation,
    });

    if (receipt.status === ReceiptStatus.FAILED) {
      throw new BadRequestException(this.resolveReceiptFailureMessage(receipt));
    }

    const parsed = receipt.parsedData ?? {};
    const amountValue = this.normalizePositiveAmount(parsed.amount);

    const merchant =
      String(parsed.vendor || receipt.subject || fileName).trim() || 'Unknown merchant';
    const detectedBankName = ReceiptStatementService.detectBankFromVendor(merchant);
    const currency = String(parsed.currency || appDefaultCurrency())
      .trim()
      .toUpperCase();
    const parsedDate = parsed.date ? new Date(parsed.date) : new Date();
    const transactionDate = new Date(parsedDate.toISOString().slice(0, 10));

    const category = parsed.categoryId
      ? await this.categoryRepository.findOne({
          where: {
            workspaceId,
            id: parsed.categoryId,
          },
        })
      : null;

    // Only the category the receipt itself was given. Guessing the first enabled
    // expense category filed unrelated scans under it (an invoice as "Rent"), and
    // Review showed that guess as though someone had picked it.
    const categoryId = category?.id ?? null;

    const taxRate = await this.taxRateRepository.findOne({
      where: {
        workspaceId,
        isDefault: true,
        isEnabled: true,
      },
    });

    const hasAmount = amountValue !== null;
    const validationWarnings = [...(parsed.validationIssues ?? [])];
    if (!hasAmount) {
      validationWarnings.push('missing_amount');
    }

    const statement = this.statementRepository.create({
      userId: user.id,
      workspaceId,
      fileName,
      filePath: file.path,
      fileType,
      fileSize: file.size,
      fileHash,
      bankName: detectedBankName,
      status: hasAmount ? StatementStatus.COMPLETED : StatementStatus.UPLOADED,
      processedAt: new Date(),
      statementDateFrom: transactionDate,
      statementDateTo: transactionDate,
      totalTransactions: hasAmount ? 1 : 0,
      totalDebit: amountValue ?? 0,
      totalCredit: 0,
      currency,
      categoryId,
      parsingDetails: {
        detectedBy: 'receipt-scan',
        parserUsed: 'receipt-scan',
        parserVersion: '1',
        transactionsFound: hasAmount ? 1 : 0,
        transactionsCreated: hasAmount ? 1 : 0,
        metadataExtracted: {
          dateFrom: transactionDate.toISOString().slice(0, 10),
          dateTo: transactionDate.toISOString().slice(0, 10),
          currency,
        },
        validation: {
          passed: validationWarnings.length === 0,
          warnings: validationWarnings,
        },
        importPreview: {
          source: 'receipt-scan',
          merchant,
          description: merchant,
          attachments: 1,
          categoryId,
          taxRateId: taxRate?.id || null,
          taxRateLabel: taxRate
            ? `${taxRate.name} (${Number(taxRate.rate || 0).toFixed(0)}%)`
            : null,
          confidence: parsed.confidence ?? receipt.confidence,
          extractionMethod: receipt.extractionMethod,
        },
      },
    });

    const savedStatement = (await this.statementRepository.save(statement)) as Statement;

    await this.receiptsService.update(receipt.id, workspaceId, {
      statementId: savedStatement.id,
    });

    try {
      await this.statementRepository.update(savedStatement.id, { fileData });
    } catch (error) {
      this.logger.warn(`Failed to persist receipt scan file in DB: ${(error as Error)?.message}`);
    }

    if (hasAmount) {
      const transactionType =
        parsed.transactionType === 'income' ? TransactionType.INCOME : TransactionType.EXPENSE;
      const isExpense = transactionType === TransactionType.EXPENSE;

      // Resolved from the workspace rules and default as they stood on the
      // receipt's date. The tax the receipt itself states stays on the Receipt
      // record; reconciling the two is a separate question from assessing.
      const taxAssignment = await this.taxAssignmentService.resolve({
        workspaceId,
        transactionDate,
        amountMinor: toMinor(amountValue),
        categoryId,
        transactionType,
        transactionNature: null,
        explicitTaxRateId: null,
      });

      const transaction = this.transactionRepository.create({
        workspaceId,
        statementId: savedStatement.id,
        transactionDate,
        counterpartyName: merchant,
        paymentPurpose: merchant,
        debit: isExpense ? amountValue : null,
        credit: isExpense ? null : amountValue,
        amount: amountValue,
        currency,
        transactionType,
        categoryId,
        taxRateId: taxAssignment.taxRateId ?? taxRate?.id ?? null,
        taxRuleId: taxAssignment.taxRuleId,
        taxSource: taxAssignment.taxSource,
        taxAmount: taxAssignment.taxAmount,
        taxNetAmount: taxAssignment.taxNetAmount,
        taxReverseCharge: taxAssignment.taxReverseCharge,
        taxNotionalAmount: taxAssignment.taxNotionalAmount,
        // Counts once the user approves the receipt; until then it waits in Review.
        isVerified: false,
      });

      await this.transactionRepository.save(transaction);
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
        source: 'receipt-scan',
        amount: amountValue,
        currency,
        merchant,
        categoryId,
        taxRateId: taxRate?.id || null,
      },
      severity: Severity.INFO,
      isUndoable: false,
    });

    return savedStatement;
  }
}
