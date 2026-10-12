import { Injectable, Logger } from '@nestjs/common';
import { DataQualityFramework } from '../../../common/utils/data-quality-framework.util';
import { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { ChecksumValidationService } from './checksum-validation.service';
import { TransactionNormalizer } from './transaction-normalizer.service';

export interface NormalizationResult {
  normalizedTransactions: ParsedTransaction[];
  qualityMetrics: {
    totalRows: number;
    successfullyNormalized: number;
    failedNormalization: number;
    duplicatesRemoved: number;
    dataQualityScore: number;
  };
  errors: string[];
  warnings: string[];
}

@Injectable()
export class StatementNormalizationService {
  private readonly logger = new Logger(StatementNormalizationService.name);

  constructor(
    private readonly transactionNormalizer: TransactionNormalizer,
    private readonly dataQualityFramework: DataQualityFramework,
    private readonly checksumValidation: ChecksumValidationService,
  ) {}

  async normalizeStatement(statement: ParsedStatement): Promise<NormalizationResult> {
    this.logger.log(`Starting normalization for ${statement.transactions.length} transactions`);

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Step 1: Normalize individual transactions
      const normalizedTransactions = await this.normalizeTransactions(
        statement.transactions,
        statement.metadata.locale,
      );

      // Step 2: Remove duplicates
      const deduplicatedTransactions = await this.removeDuplicates(normalizedTransactions);

      // Step 3: Validate data quality
      const qualityMetrics = await this.calculateQualityMetrics(
        statement.transactions,
        normalizedTransactions,
        deduplicatedTransactions,
      );

      // Step 4: Validate checksums and control totals
      const checksumValidation = await this.checksumValidation.validateStatementChecksums(
        deduplicatedTransactions,
        statement.metadata,
      );

      if (!checksumValidation.isValid) {
        warnings.push(
          `Checksum validation failed: ${checksumValidation.discrepancies.length} discrepancies found`,
        );
      }

      // Step 5: Generate quality report
      const qualityRows = this.mapTransactionsToRows(deduplicatedTransactions);
      const qualityReport = await this.dataQualityFramework.analyzeQuality(qualityRows, {
        expectedColumns: qualityRows[0]?.length ?? 0,
      });

      const issueWarnings = qualityReport.issues
        .filter(issue => issue.severity !== 'low')
        .map(issue => issue.description);

      if (issueWarnings.length > 0) {
        warnings.push(...issueWarnings);
      }

      this.logger.log(
        `Normalization completed. Quality score: ${qualityMetrics.dataQualityScore.toFixed(2)}`,
      );

      return {
        normalizedTransactions: deduplicatedTransactions,
        qualityMetrics,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error('Normalization failed', error);
      errors.push(
        `Normalization failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        normalizedTransactions: [],
        qualityMetrics: {
          totalRows: statement.transactions.length,
          successfullyNormalized: 0,
          failedNormalization: statement.transactions.length,
          duplicatesRemoved: 0,
          dataQualityScore: 0,
        },
        errors,
        warnings,
      };
    }
  }

  private async normalizeTransactions(
    transactions: ParsedTransaction[],
    locale?: string,
  ): Promise<ParsedTransaction[]> {
    const normalized: ParsedTransaction[] = [];
    const errors: string[] = [];

    for (const transaction of transactions) {
      try {
        const normalizedTx = await this.transactionNormalizer.normalizeTransaction(transaction, {
          locale,
        });
        normalized.push(normalizedTx);
      } catch (error) {
        errors.push(
          `Failed to normalize transaction ${transaction.documentNumber}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        // Add original transaction as fallback
        normalized.push(transaction);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`${errors.length} transactions failed to normalize`);
    }

    return normalized;
  }

  private async removeDuplicates(transactions: ParsedTransaction[]): Promise<ParsedTransaction[]> {
    const uniqueTransactions = new Map<string, ParsedTransaction>();
    let duplicatesRemoved = 0;

    for (const transaction of transactions) {
      // Create a unique key based on date, amount, counterparty, and purpose
      const key = this.createTransactionKey(transaction);

      const existing = uniqueTransactions.get(key);
      if (existing) {
        duplicatesRemoved++;
        // Keep the transaction with more complete data
        const replacement = this.selectBetterTransaction(existing, transaction);
        uniqueTransactions.set(key, replacement);
      } else {
        uniqueTransactions.set(key, transaction);
      }
    }

    this.logger.log(`Removed ${duplicatesRemoved} duplicate transactions`);

    return Array.from(uniqueTransactions.values());
  }

  private createTransactionKey(transaction: ParsedTransaction): string {
    const date = transaction.transactionDate.toISOString().split('T')[0];
    const amount = (transaction.debit || transaction.credit || 0).toString();
    const counterparty = (transaction.counterpartyName || '').toLowerCase().trim();
    const purpose = (transaction.paymentPurpose || '').toLowerCase().trim();

    return `${date}|${amount}|${counterparty}|${purpose}`;
  }

  private selectBetterTransaction(
    tx1: ParsedTransaction,
    tx2: ParsedTransaction,
  ): ParsedTransaction {
    // Count non-null fields for each transaction
    const score1 = this.countCompleteFields(tx1);
    const score2 = this.countCompleteFields(tx2);

    return score2 > score1 ? tx2 : tx1;
  }

  private countCompleteFields(transaction: ParsedTransaction): number {
    const fields = [
      transaction.documentNumber,
      transaction.counterpartyName,
      transaction.counterpartyBin,
      transaction.counterpartyAccount,
      transaction.counterpartyBank,
      transaction.paymentPurpose,
      transaction.currency,
      transaction.exchangeRate,
      transaction.amountForeign,
    ];

    return fields.filter(field => field != null && field !== '').length;
  }

  private mapTransactionsToRows(transactions: ParsedTransaction[]): string[][] {
    return transactions.map(transaction => [
      transaction.transactionDate ? transaction.transactionDate.toISOString() : '',
      transaction.documentNumber ?? '',
      transaction.counterpartyName ?? '',
      transaction.counterpartyBin ?? '',
      transaction.counterpartyAccount ?? '',
      transaction.counterpartyBank ?? '',
      transaction.debit != null ? String(transaction.debit) : '',
      transaction.credit != null ? String(transaction.credit) : '',
      transaction.paymentPurpose ?? '',
      transaction.currency ?? '',
      transaction.exchangeRate != null ? String(transaction.exchangeRate) : '',
      transaction.amountForeign != null ? String(transaction.amountForeign) : '',
    ]);
  }

  private async calculateQualityMetrics(
    original: ParsedTransaction[],
    normalized: ParsedTransaction[],
    deduplicated: ParsedTransaction[],
  ): Promise<NormalizationResult['qualityMetrics']> {
    const successfullyNormalized = normalized.filter(
      (tx, index) => JSON.stringify(tx) !== JSON.stringify(original[index]),
    ).length;

    const qualityRows = this.mapTransactionsToRows(deduplicated);
    const qualityReport = await this.dataQualityFramework.analyzeQuality(qualityRows, {
      expectedColumns: qualityRows[0]?.length ?? 0,
    });
    const dataQualityScore = qualityReport.metrics.overallQuality;

    // Calculate additional quality metrics
    const checksumValidation =
      await this.checksumValidation.validateStatementChecksums(deduplicated);

    // Combine quality scores
    const combinedScore = (dataQualityScore + checksumValidation.qualityScore) / 2;

    return {
      totalRows: original.length,
      successfullyNormalized,
      failedNormalization: original.length - successfullyNormalized,
      duplicatesRemoved: normalized.length - deduplicated.length,
      dataQualityScore: combinedScore,
    };
  }
}
