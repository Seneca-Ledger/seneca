import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Repository } from 'typeorm';
// DataSource is imported as a value, not a type: Nest resolves this constructor
// parameter from the emitted design:paramtypes metadata, which `import type` erases.
import { DataSource } from 'typeorm';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { toMinor } from '../../../common/utils/money.util';
import { extractTextFromPdf } from '../../../common/utils/pdf-parser.util';
import { Semaphore } from '../../../common/utils/semaphore.util';
import { ImportSessionMode } from '../../../entities/import-session.entity';
import { BankName, FileType, Statement, StatementStatus } from '../../../entities/statement.entity';
import {
  Transaction,
  TransactionCategorySource,
  TransactionType,
} from '../../../entities/transaction.entity';
import { User } from '../../../entities/user.entity';
import { extractTaxFromPurpose } from '../../classification/helpers/tax-extractor.util';
import type { TransactionEnrichment } from '../../classification/interfaces/transaction-enrichment.interface';
import { ClassificationService } from '../../classification/services/classification.service';
import { ImportSessionService } from '../../import/services/import-session.service';
import type {
  ImportCommittedEvent,
  ParsingErrorEvent,
  TransactionsUncategorizedEvent,
} from '../../notifications/events/notification-events';
import { MetricsService } from '../../observability/metrics.service';
import { TaxAssignmentService } from '../../tax/tax-assignment.service';
import { CrossStatementDeduplicationService } from '../../transactions/services/cross-statement-deduplication.service';
import { TransactionFingerprintService } from '../../transactions/services/transaction-fingerprint.service';
import { TransferPairingService } from '../../transactions/services/transfer-pairing.service';
import { AiParseValidator } from '../helpers/ai-parse-validator.helper';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { MetadataExtractionService } from './metadata-extraction.service';
import { OcrService } from './ocr.service';
import { ParserFactoryService } from './parser-factory.service';

interface StatementImportPreview {
  sessionId?: string;
  transactions?: unknown;
  [key: string]: unknown;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Injectable()
export class StatementProcessingService {
  private readonly logger = new Logger(StatementProcessingService.name);
  private aiValidator = new AiParseValidator();
  private static readonly inFlight = new Map<string, Promise<Statement>>();
  private static readonly parsingSemaphore = new Semaphore(
    parsePositiveInt(process.env.STATEMENT_PARSING_CONCURRENCY, 5),
  );
  private static readonly BALANCE_EPS = (() => {
    const parsed = Number.parseFloat(process.env.BALANCE_EPS || '0.01');
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0.01;
    }
    return parsed;
  })();

  constructor(
    @InjectRepository(Statement)
    private statementRepository: Repository<Statement>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private parserFactory: ParserFactoryService,
    private classificationService: ClassificationService,
    private metadataExtractionService: MetadataExtractionService,
    private importSessionService: ImportSessionService,
    private transactionFingerprintService: TransactionFingerprintService,
    private readonly dataSource: DataSource,
    private readonly taxAssignmentService: TaxAssignmentService,
    private metricsService?: MetricsService,
    @Optional()
    private crossStatementDeduplicationService?: CrossStatementDeduplicationService,
    private readonly eventEmitter?: EventEmitter2,
    @Optional()
    private readonly transferPairingService?: TransferPairingService,
  ) {}

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getImportPreview(statement: Statement): StatementImportPreview | undefined {
    const importPreview = statement.parsingDetails?.importPreview;
    return this.isRecord(importPreview) ? (importPreview as StatementImportPreview) : undefined;
  }

  private isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
  }

  private mergeParserMetadata(
    parserMetadata: ParsedStatement['metadata'],
    enrichedMetadata: ParsedStatement['metadata'],
  ): ParsedStatement['metadata'] {
    return {
      ...parserMetadata,
      accountNumber: parserMetadata.accountNumber?.trim() || enrichedMetadata.accountNumber || '',
      dateFrom: this.isValidDate(parserMetadata.dateFrom)
        ? parserMetadata.dateFrom
        : enrichedMetadata.dateFrom,
      dateTo: this.isValidDate(parserMetadata.dateTo)
        ? parserMetadata.dateTo
        : enrichedMetadata.dateTo,
      balanceStart: parserMetadata.balanceStart ?? enrichedMetadata.balanceStart,
      balanceEnd: parserMetadata.balanceEnd ?? enrichedMetadata.balanceEnd,
      currency:
        parserMetadata.currency?.trim() || enrichedMetadata.currency || appDefaultCurrency(),
      rawHeader: enrichedMetadata.rawHeader || parserMetadata.rawHeader,
      normalizedHeader: enrichedMetadata.normalizedHeader || parserMetadata.normalizedHeader,
      periodLabel: enrichedMetadata.periodLabel || parserMetadata.periodLabel,
      institution: parserMetadata.institution || enrichedMetadata.institution,
      locale: parserMetadata.locale || enrichedMetadata.locale,
      headerDisplay: {
        ...enrichedMetadata.headerDisplay,
        ...parserMetadata.headerDisplay,
      },
    };
  }

  private async resolveActorName(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['name', 'email'],
    });
    return user?.name || user?.email || 'User';
  }

  private getFileExtension(statement: Statement): string {
    switch (statement.fileType) {
      case 'pdf':
        return 'pdf';
      case 'xlsx':
        return 'xlsx';
      case 'csv':
        return 'csv';
      case 'image':
        return 'jpg';
      case 'docx':
        return 'docx';
      default:
        return 'bin';
    }
  }

  private async ensureFileAvailable(statement: Statement): Promise<{
    filePath: string;
    tempFilePath?: string;
  }> {
    if (statement.filePath && fs.existsSync(statement.filePath)) {
      return { filePath: statement.filePath };
    }

    const withData = await this.statementRepository
      .createQueryBuilder('statement')
      .addSelect('statement.fileData')
      .where('statement.id = :id', { id: statement.id })
      .getOne();

    let fileData: Buffer | null | undefined = withData?.fileData;

    if (!fileData && statement.fileHash) {
      const alternative = await this.statementRepository
        .createQueryBuilder('statement')
        .addSelect('statement.fileData')
        .where('statement.userId = :userId', { userId: statement.userId })
        .andWhere('statement.fileHash = :fileHash', {
          fileHash: statement.fileHash,
        })
        .andWhere('statement.fileData IS NOT NULL')
        .orderBy('statement.createdAt', 'DESC')
        .getOne();
      fileData = alternative?.fileData;
    }

    if (!fileData) {
      throw new Error(`File not found: ${statement.filePath}`);
    }

    const ext = this.getFileExtension(statement);
    const tempFilePath = path.join(
      os.tmpdir(),
      `lumio-statement-${statement.id}-${Date.now()}.${ext}`,
    );
    await fs.promises.writeFile(tempFilePath, fileData);
    return { filePath: tempFilePath, tempFilePath };
  }

  private observeDuration(
    stage: string,
    startedAt: number,
    bank: BankName,
    fileType: FileType,
    result: 'ok' | 'warn' | 'error' = 'ok',
  ) {
    if (!this.metricsService) {
      return;
    }

    const durationSeconds = (Date.now() - startedAt) / 1000;
    this.metricsService.statementParsingDurationSeconds.observe(
      {
        stage,
        bank,
        file_type: fileType,
        result,
      },
      durationSeconds,
    );
  }

  private countError(stage: string, error: unknown) {
    if (!this.metricsService) {
      return;
    }

    const label =
      error instanceof Error
        ? error.name || 'Error'
        : typeof error === 'string'
          ? error
          : 'UnknownError';

    this.metricsService.statementParsingErrorsTotal.inc({
      stage,
      error: label.substring(0, 80),
    });
  }

  private static readonly HIGH_DROP_RATIO_THRESHOLD = 0.5;

  /**
   * Summing debit/credit across transactions only makes sense when they
   * share one currency — a statement whose rows carry different currency
   * codes (e.g. a generic CSV/XLSX with a per-row currency column) would
   * otherwise get compared against balanceEnd as if KZT and USD were the
   * same unit. Parsers that convert foreign amounts into the statement's
   * own currency (Hapoalim tracks the original via amountForeign instead)
   * already report one currency per row, so they're unaffected.
   */
  private findMixedCurrencies(transactions: ParsedTransaction[]): string[] | null {
    const currencies = new Set(transactions.map(t => t.currency).filter((c): c is string => !!c));
    return currencies.size > 1 ? Array.from(currencies) : null;
  }

  private validateStatement(
    metadata: ParsedStatement['metadata'],
    transactions: ParsedTransaction[],
    dropInfo?: { rawCount: number; droppedCount: number },
  ): {
    passed: boolean;
    warnings: string[];
    balanceCheck?: {
      expectedEnd?: number;
      actualEnd?: number;
      difference?: number;
      tolerance: number;
    };
  } {
    const warnings: string[] = [];
    const debitSum = transactions.reduce((sum, t) => sum + (t.debit ?? 0), 0);
    const creditSum = transactions.reduce((sum, t) => sum + (t.credit ?? 0), 0);

    const mixedCurrencies = this.findMixedCurrencies(transactions);

    let balanceCheck:
      | {
          expectedEnd?: number;
          actualEnd?: number;
          difference?: number;
          tolerance: number;
        }
      | undefined;

    if (mixedCurrencies) {
      warnings.push(
        `Statement mixes multiple currencies (${mixedCurrencies.join(', ')}) — balance could not be automatically reconciled`,
      );
    } else if (
      metadata.balanceStart !== null &&
      metadata.balanceStart !== undefined &&
      metadata.balanceEnd !== null &&
      metadata.balanceEnd !== undefined
    ) {
      const expectedEnd = metadata.balanceStart + creditSum - debitSum;
      const diff = Math.abs(expectedEnd - metadata.balanceEnd);
      balanceCheck = {
        expectedEnd,
        actualEnd: metadata.balanceEnd,
        difference: diff,
        tolerance: StatementProcessingService.BALANCE_EPS,
      };

      if (diff > StatementProcessingService.BALANCE_EPS) {
        warnings.push(
          `Balance mismatch: expected ${expectedEnd.toFixed(2)} got ${metadata.balanceEnd.toFixed(2)} (diff ${diff.toFixed(2)})`,
        );
      }
    }

    // The balance check above passes trivially whenever the bank statement
    // didn't include balances at all, or when every row happened to net to
    // zero — that's not the same as a good parse. A statement that produced
    // zero transactions, or dropped most of what it attempted, must not be
    // reported as COMPLETED just because there was nothing left to compare.
    if (dropInfo) {
      const { rawCount, droppedCount } = dropInfo;
      const validCount = transactions.length;

      if (rawCount > 0 && validCount === 0) {
        warnings.push(
          `All ${rawCount} parsed rows were rejected during validation — statement produced zero transactions`,
        );
      } else if (
        rawCount > 0 &&
        droppedCount / rawCount > StatementProcessingService.HIGH_DROP_RATIO_THRESHOLD
      ) {
        const percent = Math.round((droppedCount / rawCount) * 100);
        warnings.push(
          `${droppedCount} of ${rawCount} parsed rows were rejected during validation (${percent}%)`,
        );
      } else if (
        rawCount === 0 &&
        validCount === 0 &&
        (metadata.balanceStart == null || metadata.balanceEnd == null)
      ) {
        // Both balances must be present to trust that zero transactions means
        // a genuinely empty period rather than a failed extraction — one
        // balance found and the other missing is still a partial failure.
        warnings.push('No transactions or balances could be extracted from the statement');
      }
    }

    return { passed: warnings.length === 0, warnings, balanceCheck };
  }

  private enforceTransactionSchema(
    transactions: ParsedTransaction[],
    defaultCurrency: string,
    log: (level: string, message: string) => void,
    droppedSamples?: Array<{
      reason: string;
      transaction?: Partial<ParsedTransaction>;
    }>,
  ): { valid: ParsedTransaction[]; warnings: string[] } {
    const valid: ParsedTransaction[] = [];
    const warnings: string[] = [];
    const currencyFallback = (defaultCurrency || '').trim() || appDefaultCurrency();

    transactions.forEach((tx, index) => {
      const prefix = `tx#${index + 1}`;
      if (!(tx.transactionDate instanceof Date) || Number.isNaN(tx.transactionDate.getTime())) {
        const msg = `${prefix}: skipped (invalid date)`;
        warnings.push(msg);
        log('warn', msg);
        droppedSamples?.push({ reason: msg, transaction: tx });
        return;
      }

      const debit = Number.isFinite(tx.debit as number) ? Number(tx.debit) : 0;
      const credit = Number.isFinite(tx.credit as number) ? Number(tx.credit) : 0;

      if (debit < 0 || credit < 0) {
        const msg = `${prefix}: skipped (negative amount)`;
        warnings.push(msg);
        log('warn', msg);
        droppedSamples?.push({ reason: msg, transaction: tx });
        return;
      }

      if (debit === 0 && credit === 0) {
        const msg = `${prefix}: skipped (no debit/credit amount)`;
        warnings.push(msg);
        log('warn', msg);
        droppedSamples?.push({ reason: msg, transaction: tx });
        return;
      }

      const currency = (tx.currency || currencyFallback).trim() || currencyFallback;
      const sanitized: ParsedTransaction = {
        ...tx,
        transactionDate: tx.transactionDate,
        debit: debit > 0 ? debit : undefined,
        credit: credit > 0 ? credit : undefined,
        currency,
        counterpartyName:
          (tx.counterpartyName || 'Неизвестный контрагент').toString().trim() ||
          'Неизвестный контрагент',
        paymentPurpose: (tx.paymentPurpose || 'Не указано').toString().trim() || 'Не указано',
      };

      valid.push(sanitized);
    });

    return { valid, warnings };
  }

  private reportAi(
    kind: 'extract' | 'validate',
    result: 'success' | 'empty' | 'error' | 'skipped',
  ) {
    if (!this.metricsService) {
      return;
    }
    this.metricsService.aiParsingCallsTotal.inc({ kind, result });
  }

  async processStatement(statementId: string): Promise<Statement> {
    const existing = StatementProcessingService.inFlight.get(statementId);
    if (existing) {
      return existing;
    }

    const runPromise = StatementProcessingService.parsingSemaphore.use(() =>
      this.processStatementInternal(statementId),
    );
    StatementProcessingService.inFlight.set(statementId, runPromise);

    try {
      return await runPromise;
    } finally {
      StatementProcessingService.inFlight.delete(statementId);
    }
  }

  async commitImport(statementId: string, workspaceId: string): Promise<Statement> {
    const statement = await this.statementRepository.findOne({
      where: { id: statementId, workspaceId },
    });

    if (!statement) {
      throw new Error(`Statement ${statementId} not found`);
    }

    const importPreview = this.getImportPreview(statement);
    if (!importPreview?.sessionId) {
      if (statement.status === StatementStatus.COMPLETED) {
        return statement;
      }

      const transactionCount = await this.transactionRepository.count({
        where: { statementId: statement.id },
      });

      if (transactionCount > 0) {
        return statement;
      }
      throw new Error(`Import preview session missing for statement ${statementId}`);
    }

    const transactions = this.hydratePreviewTransactions(importPreview.transactions);
    if (transactions.length === 0) {
      throw new Error(`No preview transactions available for statement ${statementId}`);
    }

    const commitResult = await this.importSessionService.processImport(
      importPreview.sessionId,
      transactions,
      ImportSessionMode.COMMIT,
    );

    if (this.crossStatementDeduplicationService && statement.workspaceId) {
      this.logger.log(`Running cross-statement duplicate detection for ${statementId}...`);
      try {
        const duplicateGroups = await this.crossStatementDeduplicationService.findDuplicates(
          statement.workspaceId,
          statement.id,
          0.85,
        );

        if (duplicateGroups.length > 0) {
          const markedCount =
            await this.crossStatementDeduplicationService.markDuplicates(duplicateGroups);
          statement.parsingDetails = {
            ...(statement.parsingDetails || {}),
            crossStatementDuplicates: {
              groups: duplicateGroups.length,
              marked: markedCount,
            },
          };
        }
      } catch (dedupError) {
        this.logger.warn(
          `Cross-statement deduplication failed: ${this.getErrorMessage(dedupError)}`,
        );
      }
    }

    // After dedupe on purpose: a duplicate leg must not take the pair.
    if (this.transferPairingService && statement.workspaceId) {
      try {
        const pairing = await this.transferPairingService.detectAndApply(
          statement.workspaceId,
          statement.id,
        );
        if (pairing.paired > 0) {
          statement.parsingDetails = {
            ...(statement.parsingDetails || {}),
            transferPairs: pairing,
          };
        }
      } catch (pairingError) {
        this.logger.warn(`Transfer pairing failed: ${this.getErrorMessage(pairingError)}`);
      }
    }

    const committedTransactions = await this.transactionRepository.find({
      where: { statementId: statement.id },
    });
    statement.totalTransactions = committedTransactions.length;
    statement.totalDebit = committedTransactions.reduce((sum, t) => sum + (t.debit ?? 0), 0);
    statement.totalCredit = committedTransactions.reduce((sum, t) => sum + (t.credit ?? 0), 0);
    statement.status = StatementStatus.COMPLETED;
    statement.processedAt = new Date();
    statement.parsingDetails = {
      ...(statement.parsingDetails || {}),
      importCommit: commitResult.summary,
    } as unknown as Statement['parsingDetails'];

    await this.statementRepository.save(statement);

    return statement;
  }

  private async processStatementInternal(statementId: string): Promise<Statement> {
    const startTime = Date.now();
    const parsingDetails: Statement['parsingDetails'] = {
      logEntries: [],
      errors: [],
      warnings: [],
    };

    const addLog = (level: string, message: string) => {
      const timestamp = new Date().toISOString();
      parsingDetails.logEntries = parsingDetails.logEntries || [];
      parsingDetails.logEntries.push({ timestamp, level, message });
      this.logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `[${statementId}] ${message}`,
      );
    };

    const statement = await this.statementRepository.findOne({
      where: { id: statementId },
      relations: ['workspace'],
    });

    if (!statement) {
      throw new Error(`Statement ${statementId} not found`);
    }

    const workspaceCurrency = statement.workspace?.currency || null;

    const manualCategorySelectionRequired =
      statement.parsingDetails?.manualCategorySelectionRequired === true;
    if (manualCategorySelectionRequired) {
      parsingDetails.manualCategorySelectionRequired = true;
    }

    // Deliberately no early return on PROCESSING. Concurrency is held off by the
    // in-process `inFlight` map and, across instances, by the queue reusing the
    // statement id as the job id. A status guard here would instead swallow every
    // retry of a statement whose worker died mid-parse, stranding it forever.

    addLog('info', `Starting processing of statement ${statementId}`);
    addLog(
      'info',
      `File: ${statement.fileName} (${statement.fileType}, ${statement.fileSize} bytes)`,
    );

    let tempFilePath: string | undefined;
    let processingFilePath = statement.filePath;

    try {
      const ensured = await this.ensureFileAvailable(statement);
      processingFilePath = ensured.filePath;
      tempFilePath = ensured.tempFilePath;

      // Update status to processing
      statement.status = StatementStatus.PROCESSING;
      statement.parsingDetails = parsingDetails;
      await this.statementRepository.save(statement);

      // Detect bank and format
      addLog('info', `Detecting bank and format for file type: ${statement.fileType}`);
      const detectStartTime = Date.now();
      let cachedText: string | undefined;
      let ocrConfidence: number | undefined;
      if (statement.fileType === FileType.PDF) {
        try {
          cachedText = await extractTextFromPdf(processingFilePath);
        } catch (error) {
          addLog(
            'warn',
            `PDF text extraction failed before detection: ${this.getErrorMessage(error)}`,
          );
        }
      } else if (statement.fileType === FileType.IMAGE) {
        try {
          const imageBuffer = await fs.promises.readFile(processingFilePath);
          const ocrService = new OcrService();
          const ocrResult = await ocrService.extractTextFromImage(imageBuffer);
          cachedText = ocrResult.text;
          ocrConfidence = ocrResult.confidence;
          addLog(
            'info',
            `OCR extracted ${ocrResult.text.length} chars (confidence: ${ocrResult.confidence.toFixed(2)})`,
          );
        } catch (error) {
          addLog('warn', `Image OCR failed before detection: ${this.getErrorMessage(error)}`);
        }
      }
      const { bankName, formatVersion, detectedBy, detectedEvidence, otherBankMentions } =
        await this.parserFactory.detectBankAndFormat(
          processingFilePath,
          statement.fileType,
          cachedText,
        );
      const detectTime = Date.now() - detectStartTime;

      parsingDetails.detectedBank = bankName;
      parsingDetails.detectedFormat = formatVersion;
      parsingDetails.detectedBy = detectedBy;
      parsingDetails.detectedEvidence = detectedEvidence;
      parsingDetails.otherBankMentions = otherBankMentions;
      addLog(
        'info',
        `Detected bank: ${bankName}, format: ${formatVersion || 'unknown'} (${detectTime}ms)`,
      );
      if (detectedBy) {
        addLog('info', `Detected by: ${detectedBy}`);
      }
      if (detectedEvidence?.length) {
        addLog('info', `Detection evidence: ${detectedEvidence.join(', ')}`);
      }
      if (otherBankMentions?.length) {
        addLog('info', `Other bank mentions: ${otherBankMentions.join(', ')}`);
      }
      this.observeDuration('detect', detectStartTime, bankName, statement.fileType, 'ok');

      statement.bankName = bankName;
      await this.statementRepository.save(statement);

      // Get appropriate parser
      addLog('info', `Looking for parser for bank ${bankName} and file type ${statement.fileType}`);
      const parser = await this.parserFactory.getParser(
        bankName,
        statement.fileType,
        processingFilePath,
        cachedText,
      );

      if (!parser) {
        const errorMsg = `No parser found for bank ${bankName} and file type ${statement.fileType}`;
        addLog('error', errorMsg);
        parsingDetails.errors = parsingDetails.errors || [];
        parsingDetails.errors.push(errorMsg);
        throw new Error(errorMsg);
      }

      const parserVersion =
        typeof parser.getVersion === 'function' ? parser.getVersion() : 'unknown';

      parsingDetails.parserUsed = parser.constructor.name;
      parsingDetails.parserVersion = parserVersion;
      addLog('info', `Using parser: ${parser.constructor.name} (version: ${parserVersion})`);

      // Parse statement
      addLog('info', 'Starting PDF text extraction...');
      const parseStartTime = Date.now();
      let parsedStatement = await parser.parse(processingFilePath, cachedText, ocrConfidence);
      const parseTime = Date.now() - parseStartTime;

      addLog('info', `Parsing completed in ${parseTime}ms`);
      addLog('info', `Found ${parsedStatement.transactions.length} transactions in parsed data`);
      this.observeDuration('parse', parseStartTime, statement.bankName, statement.fileType, 'ok');

      // Heartbeat: persists progress so far and, via @UpdateDateColumn, bumps
      // updatedAt — everything from here (metadata extraction, optional AI
      // reconciliation, transaction creation/dedup) can legitimately run long
      // on a big OCR'd PDF or large XLSX, and the only other save() calls are
      // at the very start and very end of this method. Without a heartbeat in
      // between, a statement genuinely still processing looks identical to a
      // truly stuck one once STALE_PROCESSING_MS elapses, and
      // StaleStatementReaper would reset+re-enqueue it while this run is
      // still writing to it.
      statement.parsingDetails = parsingDetails;
      await this.statementRepository.update(statement.id, { parsingDetails });

      // Extract enhanced metadata from raw text
      addLog('info', 'Extracting statement headers and metadata...');
      const metadataStartTime = Date.now();
      try {
        const rawText = cachedText || JSON.stringify(parsedStatement);

        // Extract metadata
        const extractedMetadata = await this.metadataExtractionService.extractMetadata(
          rawText,
          parsedStatement.metadata?.locale,
        );

        // Convert and merge metadata
        const displayInfo = this.metadataExtractionService.createDisplayInfo(extractedMetadata);
        const enhancedMetadata =
          this.metadataExtractionService.convertToParsedStatementMetadata(extractedMetadata);

        // Update parsed statement with enhanced metadata
        parsedStatement.metadata = this.mergeParserMetadata(parsedStatement.metadata, {
          ...enhancedMetadata,
          rawHeader: extractedMetadata.rawHeader,
          normalizedHeader: extractedMetadata.normalizedHeader,
          headerDisplay: {
            title: displayInfo.title,
            subtitle: displayInfo.subtitle,
            periodDisplay: displayInfo.periodDisplay,
            accountDisplay: displayInfo.accountDisplay,
            institutionDisplay: displayInfo.institutionDisplay,
            currencyDisplay: displayInfo.currencyDisplay,
          },
        });

        addLog('info', `Metadata extraction completed in ${Date.now() - metadataStartTime}ms`);
        addLog('info', `Extracted title: "${displayInfo.title}"`);
        if (displayInfo.subtitle) {
          addLog('info', `Extracted subtitle: "${displayInfo.subtitle}"`);
        }
        addLog('info', `Period display: "${displayInfo.periodDisplay}"`);
        addLog('info', `Account display: "${displayInfo.accountDisplay}"`);
        addLog('info', `Institution display: "${displayInfo.institutionDisplay}"`);
      } catch (metadataError) {
        addLog('warn', `Metadata extraction failed: ${this.getErrorMessage(metadataError)}`);
        // Continue without metadata - not a critical error
      }

      // AI reconciliation with PDF text to correct/match results
      const aiEnabled =
        process.env.AI_PARSING_ENABLED === '1' || process.env.AI_PARSING_ENABLED === 'true';
      if (aiEnabled && this.aiValidator.isAvailable()) {
        addLog('info', 'Running AI reconciliation between PDF and parsed result...');
        try {
          const aiResult = await this.aiValidator.reconcileFromPdf(
            processingFilePath,
            parsedStatement,
          );
          parsedStatement = aiResult.corrected;
          if (aiResult.notes.length) {
            for (const note of aiResult.notes) {
              addLog('info', `[AI] ${note}`);
            }
          }
          addLog(
            'info',
            `After AI reconciliation: ${parsedStatement.transactions.length} transactions`,
          );
          this.reportAi('validate', parsedStatement.transactions.length > 0 ? 'success' : 'empty');
        } catch (aiError) {
          this.reportAi('validate', 'error');
          addLog('warn', `AI reconciliation failed: ${this.getErrorMessage(aiError)}`);
        }
      } else {
        if (!aiEnabled) {
          addLog('info', 'AI reconciliation disabled (set AI_PARSING_ENABLED=1 to enable)');
        } else {
          addLog('info', 'AI reconciliation skipped (set AI_BASE_URL and AI_MODEL to enable)');
        }
        this.reportAi('validate', 'skipped');
      }

      const droppedSamples: Array<{
        reason: string;
        transaction?: Partial<ParsedTransaction>;
      }> = [];
      const rawTransactionCount = parsedStatement.transactions.length;
      const schemaResult = this.enforceTransactionSchema(
        parsedStatement.transactions,
        parsedStatement.metadata?.currency ||
          statement.currency ||
          workspaceCurrency ||
          appDefaultCurrency(),
        addLog,
        droppedSamples,
      );
      if (schemaResult.warnings.length) {
        parsingDetails.warnings = parsingDetails.warnings || [];
        for (const w of schemaResult.warnings) {
          parsingDetails.warnings?.push(w);
        }
      }
      parsedStatement.transactions = schemaResult.valid;
      parsingDetails.transactionsFound = parsedStatement.transactions.length;
      parsingDetails.droppedSamples = droppedSamples;
      const enrichedMetadata = this.buildCompleteMetadata(
        parsedStatement,
        parsedStatement.transactions,
        workspaceCurrency,
      );
      parsingDetails.metadataExtracted = {
        accountNumber: enrichedMetadata.accountNumber || undefined,
        dateFrom: enrichedMetadata.dateFrom?.toISOString(),
        dateTo: enrichedMetadata.dateTo?.toISOString(),
        balanceStart: enrichedMetadata.balanceStart ?? undefined,
        balanceEnd: enrichedMetadata.balanceEnd ?? undefined,
        currency: enrichedMetadata.currency,
        rawHeader: parsedStatement.metadata?.rawHeader,
        normalizedHeader: parsedStatement.metadata?.normalizedHeader,
        periodLabel: parsedStatement.metadata?.periodLabel,
        institution: parsedStatement.metadata?.institution,
        locale: parsedStatement.metadata?.locale,
      };

      // Update statement metadata using enriched values to avoid blanks
      statement.accountNumber = enrichedMetadata.accountNumber;
      statement.statementDateFrom = enrichedMetadata.dateFrom;
      statement.statementDateTo = enrichedMetadata.dateTo;
      statement.balanceStart = enrichedMetadata.balanceStart;
      statement.balanceEnd = enrichedMetadata.balanceEnd;
      statement.currency = enrichedMetadata.currency;

      addLog(
        'info',
        `Metadata extracted - Account: ${statement.accountNumber || 'N/A'}, Currency: ${statement.currency}`,
      );
      addLog(
        'info',
        `Date range: ${statement.statementDateFrom?.toISOString() || 'N/A'} to ${statement.statementDateTo?.toISOString() || 'N/A'}`,
      );

      const majorityCategory = await this.classificationService.determineMajorityCategory(
        parsedStatement.transactions,
        statement.userId,
        statement.workspaceId,
      );

      addLog('info', 'Creating transactions...');
      if (!statement.workspaceId) {
        throw new Error('Statement workspaceId is missing');
      }

      const creationResult = await this.createTransactions(
        statement,
        parsedStatement.transactions,
        statement.userId,
        majorityCategory.categoryId,
        manualCategorySelectionRequired,
        addLog,
      );

      parsingDetails.transactionsCreated = creationResult.transactions.length;
      parsingDetails.transactionsDeduplicated = creationResult.duplicatesSkipped;
      parsingDetails.transactionsFlaggedDuplicate = creationResult.duplicatesFlagged;

      // Totals describe the document itself, so duplicates stay counted here —
      // analytics excludes them via the `isDuplicate = false` filters instead.
      statement.totalTransactions = creationResult.transactions.length;
      statement.totalDebit = creationResult.transactions.reduce(
        (sum, t) => sum + (t.debit ?? 0),
        0,
      );
      statement.totalCredit = creationResult.transactions.reduce(
        (sum, t) => sum + (t.credit ?? 0),
        0,
      );
      if (!manualCategorySelectionRequired && majorityCategory.categoryId) {
        statement.categoryId = majorityCategory.categoryId;
      }

      addLog('info', `Totals - Debit: ${statement.totalDebit}, Credit: ${statement.totalCredit}`);

      // Heartbeat: createTransactions() above does real DB inserts and can
      // run long on a large statement; see the earlier heartbeat comment.
      statement.parsingDetails = parsingDetails;
      await this.statementRepository.update(statement.id, { parsingDetails });

      const validationResult = this.validateStatement(
        enrichedMetadata,
        parsedStatement.transactions,
        {
          rawCount: rawTransactionCount,
          droppedCount: droppedSamples.length,
        },
      );
      parsingDetails.validation = {
        passed: validationResult.passed,
        warnings: validationResult.warnings,
        balanceCheck: validationResult.balanceCheck,
      };
      if (validationResult.warnings.length) {
        parsingDetails.warnings = parsingDetails.warnings || [];
        validationResult.warnings.forEach(warning => {
          parsingDetails.warnings?.push(warning);
          addLog('warn', warning);
        });
      }

      // A statement whose balance does not reconcile is held out of analytics
      // until a user confirms it. `passed` is also true when the bank gave us no
      // balances to check against, so only a real mismatch blocks here.
      const finalStatus = validationResult.passed
        ? StatementStatus.COMPLETED
        : StatementStatus.NEEDS_REVIEW;

      if (finalStatus === StatementStatus.NEEDS_REVIEW) {
        addLog(
          'warn',
          'Statement held for review: balance did not reconcile. It is excluded from analytics until confirmed.',
        );
      }

      // Update status
      const totalTime = Date.now() - startTime;
      parsingDetails.processingTime = totalTime;
      statement.status = finalStatus;
      statement.processedAt = new Date();
      statement.parsingDetails = parsingDetails;
      await this.statementRepository.save(statement);

      if (this.eventEmitter && statement.workspaceId) {
        const actorName = await this.resolveActorName(statement.userId);
        this.eventEmitter.emit('import.committed', {
          workspaceId: statement.workspaceId,
          actorId: statement.userId,
          actorName,
          statementId: statement.id,
          transactionCount: creationResult.transactions.length,
        } satisfies ImportCommittedEvent);

        const uncategorizedCount = creationResult.transactions.filter(
          transaction => !transaction.categoryId,
        ).length;
        if (uncategorizedCount > 0) {
          this.eventEmitter.emit('transactions.uncategorized', {
            workspaceId: statement.workspaceId,
            userId: statement.userId,
            statementId: statement.id,
            count: uncategorizedCount,
          } satisfies TransactionsUncategorizedEvent);
        }
      }

      this.observeDuration(
        'total',
        startTime,
        statement.bankName,
        statement.fileType,
        validationResult.passed ? 'ok' : 'warn',
      );

      addLog(
        'info',
        `Successfully processed statement ${statementId}: ${parsedStatement.transactions.length} transactions (total time: ${totalTime}ms)`,
      );

      return statement;
    } catch (error) {
      const message = this.getErrorMessage(error);
      const errorMsg = `Error processing statement ${statementId}: ${message}`;
      addLog('error', errorMsg);
      parsingDetails.errors = parsingDetails.errors || [];
      parsingDetails.errors.push(message);
      parsingDetails.processingTime = Date.now() - startTime;
      this.countError('processing', error);
      this.observeDuration('total', startTime, statement.bankName, statement.fileType, 'error');

      statement.status = StatementStatus.ERROR;
      statement.errorMessage = message;
      statement.parsingDetails = parsingDetails;
      await this.statementRepository.save(statement);

      if (this.eventEmitter && statement.workspaceId) {
        this.eventEmitter.emit('parsing.error', {
          workspaceId: statement.workspaceId,
          userId: statement.userId,
          statementId: statement.id,
          statementName: statement.fileName,
          errorMessage: message,
        } satisfies ParsingErrorEvent);
      }

      this.logger.error(`Error processing statement ${statementId}:`, error);
      throw error;
    } finally {
      if (tempFilePath) {
        fs.promises.unlink(tempFilePath).catch(() => undefined);
      }
    }
  }

  private async createTransactions(
    statement: Statement,
    parsedTransactions: ParsedTransaction[],
    userId: string,
    _defaultCategoryId: string | undefined,
    manualCategorySelectionRequired: boolean,
    addLog?: (level: string, message: string) => void,
  ): Promise<{
    transactions: Transaction[];
    duplicatesSkipped: number;
    duplicatesFlagged: number;
  }> {
    const log =
      addLog ||
      ((level: string, msg: string) => this.logger[level === 'error' ? 'error' : 'log'](msg));

    // In-file duplicates are not dropped here: flagFingerprintDuplicates below
    // already detects same-batch fingerprint collisions (and cross-statement
    // ones) and marks them isDuplicate=true instead — still persisted, still
    // visible/reversible via the duplicates review UI, just excluded from
    // totals. A row silently dropped here could never be recovered.
    const deduped: ParsedTransaction[] = parsedTransactions;

    log(
      'info',
      `Processing ${deduped.length}/${parsedTransactions.length} parsed transactions after dedup (statement currency: ${statement.currency || 'N/A'})`,
    );

    let aiBatchResults = new Map<
      number,
      { categoryId: string; enrichment?: TransactionEnrichment }
    >();
    if (!manualCategorySelectionRequired && statement.workspaceId && deduped.length > 0) {
      try {
        aiBatchResults = await this.classificationService.classifyTransactionsBatch(
          deduped.map((parsed, index) => {
            const transactionType =
              parsed.debit && parsed.debit > 0
                ? TransactionType.EXPENSE
                : parsed.credit && parsed.credit > 0
                  ? TransactionType.INCOME
                  : TransactionType.INCOME;

            return {
              index,
              counterpartyName: (parsed.counterpartyName || '').trim() || 'Неизвестный контрагент',
              paymentPurpose: (parsed.paymentPurpose || '').trim() || 'Не указано',
              transactionType,
            };
          }),
          statement.workspaceId,
        );

        log(
          'info',
          `AI batch results: ${aiBatchResults.size}/${deduped.length} transactions classified and enriched`,
        );
      } catch (error) {
        log(
          'warn',
          `AI batch categorization failed, fallback to default classification: ${this.getErrorMessage(error)}`,
        );
      }
    }

    // Build every entity in memory first: classification hits the DB and external
    // services, so it must not run inside the write transaction below.
    const drafts: Transaction[] = [];

    for (let i = 0; i < deduped.length; i++) {
      const parsed = deduped[i];

      const counterpartyName = (parsed.counterpartyName || '').trim() || 'Неизвестный контрагент';
      const paymentPurpose = (parsed.paymentPurpose || '').trim() || 'Не указано';

      // Determine transaction type
      const transactionType =
        parsed.debit && parsed.debit > 0
          ? TransactionType.EXPENSE
          : parsed.credit && parsed.credit > 0
            ? TransactionType.INCOME
            : TransactionType.INCOME;

      // Calculate amount preserving zero values
      const amount = (parsed.debit ?? parsed.credit ?? 0) as number;

      // Classify transaction first (before creating entity)
      const tempTransaction = {
        transactionDate: parsed.transactionDate,
        documentNumber: parsed.documentNumber,
        counterpartyName,
        counterpartyBin: parsed.counterpartyBin,
        counterpartyAccount: parsed.counterpartyAccount,
        counterpartyBank: parsed.counterpartyBank,
        debit: parsed.debit ?? null,
        credit: parsed.credit ?? null,
        amount,
        currency:
          parsed.currency ||
          statement.currency ||
          statement.workspace?.currency ||
          appDefaultCurrency(),
        paymentPurpose,
        transactionType,
        workspaceId: statement.workspaceId,
      } as Transaction;

      const classification = await this.classificationService.classifyTransaction(
        tempTransaction,
        userId,
      );

      if (manualCategorySelectionRequired) {
        classification.categoryId = undefined;
        classification.categorySource = null;
        classification.categoryReason = null;
      }

      // The model is the last resort before "uncategorised": rules, keywords and
      // what the user taught all come first.
      const aiBatchResult = aiBatchResults.get(i);
      const fellThrough =
        !classification.categoryId ||
        classification.categorySource === TransactionCategorySource.DEFAULT;
      if (!manualCategorySelectionRequired && fellThrough && aiBatchResult) {
        classification.categoryId = aiBatchResult.categoryId;
        classification.categorySource = TransactionCategorySource.AI;
        classification.categoryReason =
          aiBatchResult.enrichment?.confidence !== undefined
            ? `confidence ${aiBatchResult.enrichment.confidence.toFixed(2)}`
            : null;
      }

      const currency =
        parsed.currency ||
        statement.currency ||
        statement.workspace?.currency ||
        appDefaultCurrency();
      const exchangeRate = parsed.exchangeRate ?? null;
      const amountForeign = parsed.amountForeign ?? null;

      // Extract enrichment data from AI batch results, with regex tax fallback
      const enrichment = aiBatchResult?.enrichment;
      const regexTax = extractTaxFromPurpose(paymentPurpose);
      const taxDetected = enrichment?.taxMentioned ?? regexTax.taxMentioned;

      // Create transaction with classification and enrichment
      const transaction = this.transactionRepository.create({
        statementId: statement.id,
        workspaceId: statement.workspaceId,
        transactionDate: parsed.transactionDate,
        documentNumber: parsed.documentNumber,
        counterpartyName,
        counterpartyBin: parsed.counterpartyBin,
        counterpartyAccount: parsed.counterpartyAccount,
        counterpartyBank: parsed.counterpartyBank,
        debit: parsed.debit,
        credit: parsed.credit,
        amount,
        currency,
        exchangeRate,
        amountForeign,
        paymentPurpose,
        transactionType,
        ...classification,
        vendorNormalized: enrichment?.vendorNormalized || null,
        categoryHint: enrichment?.categoryHint || null,
        transactionNature: enrichment?.transactionNature || null,
        taxDetected,
        enrichmentConfidence: enrichment?.confidence || null,
      });

      // Assessed from the workspace rules and default as they stood on the
      // transaction's own date. Rows the classifier left uncategorised, and
      // transfers, wages and loan movements, are deliberately left unassessed
      // by the resolver rather than taxed on a guess.
      //
      // ponytail: two small indexed queries per transaction, so a 500-row
      // statement costs ~1000 of them. Negligible next to the AI
      // classification this loop already does; if it ever shows up, hoist the
      // rule and rate lookups out of the loop and pass them in.
      const taxAssignment = await this.taxAssignmentService.resolve({
        workspaceId: statement.workspaceId,
        transactionDate: parsed.transactionDate,
        amountMinor: toMinor(amount ?? 0),
        categoryId: classification.categoryId ?? null,
        transactionType,
        transactionNature: enrichment?.transactionNature || null,
        explicitTaxRateId: null,
      });

      transaction.taxRateId = taxAssignment.taxRateId;
      transaction.taxRuleId = taxAssignment.taxRuleId;
      transaction.taxSource = taxAssignment.taxSource;
      transaction.taxAmount = taxAssignment.taxAmount;
      transaction.taxNetAmount = taxAssignment.taxNetAmount;
      transaction.taxReverseCharge = taxAssignment.taxReverseCharge;
      transaction.taxNotionalAmount = taxAssignment.taxNotionalAmount;

      transaction.fingerprint = this.buildFingerprint(transaction, statement, log, i);
      drafts.push(transaction);

      const missing: string[] = [];
      if (!counterpartyName || /неизвест/i.test(counterpartyName)) {
        missing.push('counterparty');
      }
      if (!paymentPurpose || paymentPurpose === 'Не указано') {
        missing.push('purpose');
      }
      if (!classification.categoryId) {
        missing.push('category');
      }
      if (!classification.branchId) {
        missing.push('branch');
      }
      if (!classification.walletId) {
        missing.push('wallet');
      }

      if (missing.length && (i < 5 || i === parsedTransactions.length - 1)) {
        log(
          'warn',
          `Transaction ${i + 1} (${parsed.documentNumber || 'no doc'}): missing ${missing.join(
            ', ',
          )}`,
        );
      } else if (classification.categoryId || classification.branchId || classification.walletId) {
        log(
          'info',
          `Transaction ${i + 1} classification -> cat: ${
            classification.categoryId || '—'
          }, branch: ${classification.branchId || '—'}, wallet: ${classification.walletId || '—'}`,
        );
      }

      if ((i + 1) % 10 === 0) {
        log('info', `Prepared ${i + 1}/${deduped.length} transactions`);
      }
    }

    const duplicatesFlagged = await this.flagFingerprintDuplicates(drafts, statement, log);

    // Single atomic write. A half-imported statement marked COMPLETED is worse
    // than a failed one: totals and balance checks would silently be wrong.
    const transactions = await this.dataSource.transaction(manager =>
      manager.save(Transaction, drafts, { chunk: 200 }),
    );

    log('info', `Successfully created ${transactions.length}/${deduped.length} transactions`);
    const duplicatesSkipped = parsedTransactions.length - deduped.length;
    return { transactions, duplicatesSkipped, duplicatesFlagged };
  }

  /**
   * Fingerprints feed the partial unique index
   * `(workspace_id, fingerprint) WHERE is_duplicate = false`, which is what makes
   * re-uploading an overlapping period idempotent.
   */
  private buildFingerprint(
    transaction: Transaction,
    statement: Statement,
    log: (level: string, message: string) => void,
    index: number,
  ): string | null {
    try {
      return this.transactionFingerprintService.generateFingerprint(
        transaction,
        statement.accountNumber || '',
      );
    } catch (error) {
      // A missing fingerprint only costs dedup, so never fail the import over it.
      log(
        'warn',
        `Fingerprint generation failed for transaction ${index + 1}: ${this.getErrorMessage(error)}`,
      );
      return null;
    }
  }

  /**
   * Marks drafts whose fingerprint already exists — either in the workspace or
   * earlier in this same batch — as duplicates. They are still persisted (nothing
   * is silently dropped), but `isDuplicate = true` keeps them out of the unique
   * index and out of totals downstream.
   */
  private async flagFingerprintDuplicates(
    drafts: Transaction[],
    statement: Statement,
    log: (level: string, message: string) => void,
  ): Promise<number> {
    const fingerprints = drafts
      .map(draft => draft.fingerprint)
      .filter((value): value is string => !!value);

    if (!(fingerprints.length && statement.workspaceId)) {
      return 0;
    }

    const existing = await this.transactionFingerprintService.findByFingerprints(
      statement.workspaceId,
      fingerprints,
    );

    const existingByFingerprint = new Map<string, Transaction>();
    existing.forEach(transaction => {
      if (transaction.fingerprint && !existingByFingerprint.has(transaction.fingerprint)) {
        existingByFingerprint.set(transaction.fingerprint, transaction);
      }
    });

    const seenInBatch = new Set<string>();
    let flagged = 0;

    drafts.forEach(draft => {
      if (!draft.fingerprint) {
        return;
      }

      const previous = existingByFingerprint.get(draft.fingerprint);
      if (previous) {
        draft.isDuplicate = true;
        draft.duplicateOfId = previous.id;
        flagged++;
        return;
      }

      if (seenInBatch.has(draft.fingerprint)) {
        draft.isDuplicate = true;
        flagged++;
        return;
      }

      seenInBatch.add(draft.fingerprint);
    });

    if (flagged) {
      log('warn', `${flagged}/${drafts.length} transactions flagged as duplicates by fingerprint`);
    }

    return flagged;
  }

  private hydratePreviewTransactions(raw: unknown): ParsedTransaction[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return (raw as Array<Omit<ParsedTransaction, 'transactionDate'> & { transactionDate?: string }>)
      .map(tx => ({
        ...tx,
        transactionDate: tx.transactionDate ? new Date(tx.transactionDate) : new Date('invalid'),
      }))
      .filter(
        tx => tx.transactionDate instanceof Date && !Number.isNaN(tx.transactionDate.getTime()),
      );
  }

  private buildCompleteMetadata(
    parsed: ParsedStatement,
    transactions: ParsedTransaction[],
    workspaceCurrency?: string | null,
  ): {
    accountNumber: string;
    dateFrom: Date;
    dateTo: Date;
    balanceStart: number | null | undefined;
    balanceEnd: number | null | undefined;
    currency: string;
  } {
    const transactionDates = transactions.map(t => t.transactionDate).filter((d): d is Date => !!d);

    const minDate =
      transactionDates.length > 0
        ? new Date(Math.min(...transactionDates.map(d => d.getTime())))
        : null;
    const maxDate =
      transactionDates.length > 0
        ? new Date(Math.max(...transactionDates.map(d => d.getTime())))
        : null;

    const currencyFromTransactions = transactions.find(t => t.currency)?.currency;

    // No counterparty-account fallback here on purpose: a counterparty's
    // account number is someone else's, not this statement's own, and using
    // it (a) mislabels the statement's account in the UI and (b) makes the
    // dedup fingerprint unstable — re-parsing the same file can pick a
    // different first transaction and change which counterparty account gets
    // borrowed, breaking idempotent re-upload detection.
    const accountNumber = (parsed.metadata.accountNumber || '').trim() || 'Unknown';
    const dateFrom = parsed.metadata.dateFrom || minDate || new Date();
    const dateTo = parsed.metadata.dateTo || maxDate || dateFrom;
    const balanceStart = parsed.metadata.balanceStart ?? null;
    const balanceEnd = parsed.metadata.balanceEnd ?? null;
    const currency =
      parsed.metadata.currency ||
      currencyFromTransactions ||
      workspaceCurrency ||
      appDefaultCurrency();

    return {
      accountNumber,
      dateFrom,
      dateTo,
      balanceStart,
      balanceEnd,
      currency,
    };
  }
}
