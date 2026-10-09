import { Injectable, Logger } from '@nestjs/common';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { ColumnValidationResult, ColumnValidationService } from './column-validation.service';
import { TextCleaningResult, TextCleaningService } from './text-cleaning.service';
import { AmountParseResult, UniversalAmountParser } from './universal-amount-parser.service';
import { DateParseResult, UniversalDateParser } from './universal-date-parser.service';

export interface TransactionNormalizationOptions {
  locale?: string;
  defaultCurrency?: string;
  strictMode?: boolean;
  preserveOriginalValues?: boolean;
}

export interface NormalizedTransaction extends ParsedTransaction {
  // Additional metadata about normalization
  _normalization?: {
    confidence: number;
    changes: string[];
    issues: string[];
  };
}

@Injectable()
export class TransactionNormalizer {
  private readonly logger = new Logger(TransactionNormalizer.name);

  constructor(
    private readonly dateParser: UniversalDateParser,
    private readonly amountParser: UniversalAmountParser,
    private readonly textCleaning: TextCleaningService,
    private readonly columnValidation: ColumnValidationService,
  ) {}

  async normalizeTransaction(
    transaction: ParsedTransaction,
    options: TransactionNormalizationOptions = {},
  ): Promise<NormalizedTransaction> {
    const {
      locale = 'en',
      defaultCurrency = appDefaultCurrency(),
      strictMode = false,
      preserveOriginalValues = false,
    } = options;

    this.logger.debug(`Normalizing transaction: ${transaction.documentNumber || 'unknown'}`);

    const changes: string[] = [];
    const issues: string[] = [];
    let confidence = 1.0;

    const normalized: NormalizedTransaction = { ...transaction };

    // Step 1: Normalize transaction date
    const dateResult = await this.normalizeDate(normalized.transactionDate, locale);
    if (dateResult) {
      normalized.transactionDate = dateResult.date;
      changes.push(`Date normalized: ${dateResult.format}`);
      confidence *= dateResult.confidence;
    } else {
      issues.push('Failed to normalize transaction date');
      confidence *= 0.3;
    }

    // Step 2: Normalize amounts
    const amountResults = await this.normalizeAmounts(normalized, locale);
    if (amountResults.debit) {
      normalized.debit = amountResults.debit.amount;
      changes.push(`Debit normalized: ${amountResults.debit.format}`);
      confidence *= amountResults.debit.confidence;
    }

    if (amountResults.credit) {
      normalized.credit = amountResults.credit.amount;
      changes.push(`Credit normalized: ${amountResults.credit.format}`);
      confidence *= amountResults.credit.confidence;
    }

    if (amountResults.currency) {
      normalized.currency = amountResults.currency;
    }

    // Step 3: Clean text fields
    const textResults = await this.normalizeTextFields(normalized, locale);
    if (textResults.counterpartyName) {
      normalized.counterpartyName = textResults.counterpartyName.cleanedText;
      changes.push(`Counterparty cleaned: ${textResults.counterpartyName.changes.join(', ')}`);
      confidence *= textResults.counterpartyName.confidence;
    }

    if (textResults.paymentPurpose) {
      normalized.paymentPurpose = textResults.paymentPurpose.cleanedText;
      changes.push(`Payment purpose cleaned: ${textResults.paymentPurpose.changes.join(', ')}`);
      confidence *= textResults.paymentPurpose.confidence;
    }

    // Step 4: Validate and fix structure
    if (!strictMode) {
      const validationResult = await this.validateAndFixTransaction(normalized);
      if (!validationResult.isValid) {
        issues.push(...validationResult.inconsistencies.map(inc => inc.field));
        // Apply auto-fixes if available
        const corrected = validationResult.correctedTransactions?.[0];
        if (corrected) {
          Object.assign(normalized, corrected);
        }
      }
      confidence *= validationResult.qualityScore;
    }

    // Step 5: Apply business logic rules
    await this.applyBusinessRules(normalized, defaultCurrency);

    // Add normalization metadata
    if (!preserveOriginalValues) {
      normalized._normalization = {
        confidence: Math.max(0.1, Math.min(1.0, confidence)),
        changes,
        issues,
      };
    }

    return normalized;
  }

  private async normalizeDate(date: Date, locale?: string): Promise<DateParseResult | null> {
    if (!date) {
      return null;
    }

    try {
      // If date is already valid, just return it
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return {
          date,
          format: 'ALREADY_VALID',
          confidence: 0.95,
        };
      }

      // Try to parse as string if it's not a Date object
      const dateString = String(date);
      return await this.dateParser.parseDate(dateString, locale);
    } catch (error) {
      this.logger.warn(`Failed to normalize date: ${date}`, error);
      return null;
    }
  }

  private async normalizeAmounts(
    transaction: ParsedTransaction,
    _locale?: string,
  ): Promise<{
    debit?: AmountParseResult;
    credit?: AmountParseResult;
    currency?: string;
  }> {
    const results: {
      debit?: AmountParseResult;
      credit?: AmountParseResult;
      currency?: string;
    } = {};

    try {
      // Normalize debit
      if (transaction.debit !== undefined && transaction.debit !== null) {
        const debitString = String(transaction.debit);
        results.debit = await this.amountParser.parseAmount(debitString);
        if (results.debit?.currency) {
          results.currency = results.debit.currency;
        }
      }

      // Normalize credit
      if (transaction.credit !== undefined && transaction.credit !== null) {
        const creditString = String(transaction.credit);
        results.credit = await this.amountParser.parseAmount(creditString);
        if (results.credit?.currency && !results.currency) {
          results.currency = results.credit.currency;
        }
      }

      // Use existing currency if no currency detected in amounts
      if (!results.currency && transaction.currency) {
        results.currency = transaction.currency;
      }
    } catch (error) {
      this.logger.warn('Failed to normalize amounts', error);
    }

    return results;
  }

  private async normalizeTextFields(
    transaction: ParsedTransaction,
    locale?: string,
  ): Promise<{
    counterpartyName?: TextCleaningResult;
    paymentPurpose?: TextCleaningResult;
  }> {
    const results: {
      counterpartyName?: TextCleaningResult;
      paymentPurpose?: TextCleaningResult;
    } = {};

    try {
      // Clean counterparty name
      if (transaction.counterpartyName) {
        results.counterpartyName = await this.textCleaning.cleanCounterpartyName(
          transaction.counterpartyName,
          locale,
        );
      }

      // Clean payment purpose
      if (transaction.paymentPurpose) {
        results.paymentPurpose = await this.textCleaning.cleanPaymentPurpose(
          transaction.paymentPurpose,
          locale,
        );
      }
    } catch (error) {
      this.logger.warn('Failed to normalize text fields', error);
    }

    return results;
  }

  private async validateAndFixTransaction(
    transaction: NormalizedTransaction,
  ): Promise<ColumnValidationResult> {
    return await this.columnValidation.validateTransactions([transaction]);
  }

  private async applyBusinessRules(
    transaction: NormalizedTransaction,
    defaultCurrency: string,
  ): Promise<void> {
    // Rule 1: Ensure currency is set
    if (!transaction.currency) {
      transaction.currency = defaultCurrency;
    }

    // Rule 2: Normalize BIN/IIN format for Kazakh transactions
    if (transaction.counterpartyBin && transaction.currency === 'KZT') {
      const bin = String(transaction.counterpartyBin).replace(/\s/g, '');
      if (/^\d{12}$/.test(bin)) {
        transaction.counterpartyBin = bin;
      }
    }

    // Rule 3: Extract additional info from payment purpose if needed
    if (transaction.paymentPurpose && !transaction.documentNumber) {
      // Try to extract document number from payment purpose
      const docNumberMatch = transaction.paymentPurpose.match(
        /(?:doc|документ|док)\s*[:#]?\s*(\w+)/i,
      );
      if (docNumberMatch) {
        transaction.documentNumber = docNumberMatch[1];
      }
    }

    // Rule 4: Set reasonable defaults for missing optional fields
    if (!transaction.exchangeRate && transaction.amountForeign) {
      transaction.exchangeRate = 1; // Default to 1:1 if not specified
    }

    // Rule 5: Ensure financial consistency
    const hasDebit = transaction.debit && transaction.debit > 0;
    const hasCredit = transaction.credit && transaction.credit > 0;

    if (!(hasDebit || hasCredit)) {
      // If no amounts specified, check if we can infer from context
      if (transaction.paymentPurpose) {
        const isExpense = /(?:списание|расход|оплата|payment|expense|withdrawal)/i.test(
          transaction.paymentPurpose,
        );
        if (isExpense) {
          // Default to small amount for expense tracking
          transaction.debit = 0;
        }
      }
    }

    // Rule 6: Normalize document number format
    if (transaction.documentNumber) {
      // Remove extra spaces and normalize format
      transaction.documentNumber = String(transaction.documentNumber).trim().replace(/\s+/g, ' ');
    }
  }

  // Batch normalization for multiple transactions
  async normalizeTransactions(
    transactions: ParsedTransaction[],
    options: TransactionNormalizationOptions = {},
  ): Promise<NormalizedTransaction[]> {
    this.logger.log(`Normalizing ${transactions.length} transactions`);

    const normalized: NormalizedTransaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        const result = await this.normalizeTransaction(transactions[i], options);
        normalized.push(result);
      } catch (error) {
        this.logger.error(`Failed to normalize transaction at index ${i}`, error);
        errors.push(`Transaction ${i}: ${error.message}`);

        // Add original transaction with error metadata
        const fallback: NormalizedTransaction = {
          ...transactions[i],
          _normalization: {
            confidence: 0.1,
            changes: [],
            issues: [`Normalization failed: ${error.message}`],
          },
        };
        normalized.push(fallback);
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`${errors.length} transactions failed to normalize completely`);
    }

    this.logger.log(
      `Normalization completed. Average confidence: ${this.calculateAverageConfidence(normalized).toFixed(2)}`,
    );

    return normalized;
  }

  private calculateAverageConfidence(transactions: NormalizedTransaction[]): number {
    const totalConfidence = transactions.reduce((sum, tx) => {
      return sum + (tx._normalization?.confidence || 0);
    }, 0);

    return totalConfidence / transactions.length;
  }

  // Method to get normalization statistics
  getNormalizationStatistics(transactions: NormalizedTransaction[]): {
    totalTransactions: number;
    averageConfidence: number;
    commonIssues: string[];
    successRate: number;
  } {
    const totalTransactions = transactions.length;
    const averageConfidence = this.calculateAverageConfidence(transactions);

    const issueCounts = new Map<string, number>();
    let successfulCount = 0;

    transactions.forEach(tx => {
      if (tx._normalization) {
        if (tx._normalization.confidence > 0.7) {
          successfulCount++;
        }

        tx._normalization.issues.forEach(issue => {
          const count = issueCounts.get(issue) || 0;
          issueCounts.set(issue, count + 1);
        });
      }
    });

    const commonIssues = Array.from(issueCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([issue]) => issue);

    return {
      totalTransactions,
      averageConfidence,
      commonIssues,
      successRate: (successfulCount / totalTransactions) * 100,
    };
  }
}
