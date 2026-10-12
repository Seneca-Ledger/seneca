import { Injectable, Logger } from '@nestjs/common';
import {
  ParsedStatementMetadata,
  ParsedTransaction,
} from '../interfaces/parsed-statement.interface';

export interface ChecksumValidationResult {
  isValid: boolean;
  expectedTotal?: number;
  calculatedTotal?: number;
  discrepancy?: number;
  discrepancies: TotalDiscrepancy[];
  qualityScore: number;
}

export interface TotalDiscrepancy {
  type: 'opening_balance' | 'closing_balance' | 'transaction_sum' | 'control_total';
  expectedValue: number;
  calculatedValue: number;
  difference: number;
  percentageDifference: number;
  severity: 'low' | 'medium' | 'high';
}

export interface ControlTotal {
  label: string;
  amount: number;
  type: 'debit_total' | 'credit_total' | 'balance_total';
  rowNumber?: number;
}

interface TransactionTotals {
  totalDebit: number;
  totalCredit: number;
  transactionCount: number;
  averageAmount: number;
  minAmount: number;
  maxAmount: number;
}

@Injectable()
export class ChecksumValidationService {
  private readonly logger = new Logger(ChecksumValidationService.name);

  async validateStatementChecksums(
    transactions: ParsedTransaction[],
    metadata?: ParsedStatementMetadata,
  ): Promise<ChecksumValidationResult> {
    this.logger.log(`Validating checksums for ${transactions.length} transactions`);

    const discrepancies: TotalDiscrepancy[] = [];
    let totalScore = 1.0;

    // Calculate transaction totals
    const transactionTotals = this.calculateTransactionTotals(transactions);

    // Validate against control totals if available
    if (metadata) {
      const metadataValidation = await this.validateAgainstMetadata(transactionTotals, metadata);
      discrepancies.push(...metadataValidation.discrepancies);
      totalScore *= metadataValidation.qualityScore;
    }

    // Validate internal consistency
    const internalValidation = this.validateInternalConsistency(transactionTotals);
    discrepancies.push(...internalValidation.discrepancies);
    totalScore *= internalValidation.qualityScore;

    // Look for control totals in transaction descriptions
    const controlTotals = this.extractControlTotals(transactions);
    if (controlTotals.length > 0) {
      const controlValidation = this.validateAgainstControlTotals(transactionTotals, controlTotals);
      discrepancies.push(...controlValidation.discrepancies);
      totalScore *= controlValidation.qualityScore;
    }

    // Calculate overall discrepancy
    let expectedTotal: number | undefined;
    let calculatedTotal: number | undefined;
    let discrepancy: number | undefined;

    if (metadata?.balanceEnd !== undefined) {
      expectedTotal = metadata.balanceEnd;
      calculatedTotal = this.calculateExpectedBalance(transactions, metadata);
      if (expectedTotal !== undefined && calculatedTotal !== undefined) {
        discrepancy = Math.abs(expectedTotal - calculatedTotal);
      }
    }

    const qualityScore = Math.max(0.1, Math.min(1.0, totalScore));

    this.logger.log(
      `Checksum validation completed. Quality score: ${qualityScore.toFixed(2)}, Discrepancies: ${discrepancies.length}`,
    );

    return {
      isValid: discrepancies.length === 0,
      expectedTotal,
      calculatedTotal,
      discrepancy,
      discrepancies,
      qualityScore,
    };
  }

  private calculateTransactionTotals(transactions: ParsedTransaction[]): TransactionTotals {
    const totals: TransactionTotals = {
      totalDebit: 0,
      totalCredit: 0,
      transactionCount: transactions.length,
      averageAmount: 0,
      minAmount: Number.POSITIVE_INFINITY,
      maxAmount: 0,
    };

    transactions.forEach(tx => {
      if (tx.debit && tx.debit > 0) {
        totals.totalDebit += tx.debit;
        totals.minAmount = Math.min(totals.minAmount, tx.debit);
        totals.maxAmount = Math.max(totals.maxAmount, tx.debit);
      }

      if (tx.credit && tx.credit > 0) {
        totals.totalCredit += tx.credit;
        totals.minAmount = Math.min(totals.minAmount, tx.credit);
        totals.maxAmount = Math.max(totals.maxAmount, tx.credit);
      }
    });

    // Calculate average of all non-zero amounts
    const nonZeroAmounts = transactions
      .map(tx => tx.debit || tx.credit || 0)
      .filter(amount => amount > 0);

    totals.averageAmount =
      nonZeroAmounts.length > 0
        ? nonZeroAmounts.reduce((sum, amount) => sum + amount, 0) / nonZeroAmounts.length
        : 0;

    if (totals.minAmount === Number.POSITIVE_INFINITY) {
      totals.minAmount = 0;
    }

    return totals;
  }

  private async validateAgainstMetadata(
    transactionTotals: TransactionTotals,
    metadata: ParsedStatementMetadata,
  ): Promise<{ discrepancies: TotalDiscrepancy[]; qualityScore: number }> {
    const discrepancies: TotalDiscrepancy[] = [];
    let score = 1.0;

    // Validate opening balance if available
    if (metadata.balanceStart !== undefined) {
      // Note: Opening balance validation would require historical data
      // For now, we'll just check if it's a reasonable value
      if (Math.abs(metadata.balanceStart) > 1e12) {
        // More than 1 trillion
        discrepancies.push({
          type: 'opening_balance',
          expectedValue: metadata.balanceStart,
          calculatedValue: 0,
          difference: metadata.balanceStart,
          percentageDifference: 100,
          severity: 'medium',
        });
        score *= 0.8;
      }
    }

    // Validate closing balance
    if (metadata.balanceEnd !== undefined) {
      const calculatedEndBalance = this.calculateExpectedBalanceFromTotals(
        transactionTotals,
        metadata.balanceStart,
      );

      if (calculatedEndBalance !== null) {
        const difference = Math.abs(metadata.balanceEnd - calculatedEndBalance);
        const percentageDiff =
          (difference / Math.max(Math.abs(metadata.balanceEnd), Math.abs(calculatedEndBalance))) *
          100;

        if (percentageDiff > 0.1) {
          // More than 0.1% difference
          discrepancies.push({
            type: 'closing_balance',
            expectedValue: metadata.balanceEnd,
            calculatedValue: calculatedEndBalance,
            difference,
            percentageDifference: percentageDiff,
            severity: percentageDiff > 5 ? 'high' : percentageDiff > 1 ? 'medium' : 'low',
          });
          score *= Math.max(0.5, 1 - percentageDiff / 100);
        }
      }
    }

    return { discrepancies, qualityScore: score };
  }

  private validateInternalConsistency(transactionTotals: TransactionTotals): {
    discrepancies: TotalDiscrepancy[];
    qualityScore: number;
  } {
    const discrepancies: TotalDiscrepancy[] = [];
    let score = 1.0;

    // Check for suspicious patterns
    const { totalDebit, totalCredit, averageAmount } = transactionTotals;

    // Check if debits and credits are roughly balanced (typical for account statements)
    const difference = Math.abs(totalDebit - totalCredit);
    const total = totalDebit + totalCredit;

    if (total > 0) {
      const imbalancePercentage = (difference / total) * 100;

      // Note: High imbalance might be normal for some account types,
      // so we only flag extreme cases
      if (imbalancePercentage > 90) {
        discrepancies.push({
          type: 'transaction_sum',
          expectedValue: total / 2,
          calculatedValue: Math.min(totalDebit, totalCredit),
          difference,
          percentageDifference: imbalancePercentage,
          severity: 'medium',
        });
        score *= 0.9;
      }
    }

    // Check for unusual average amounts
    if (averageAmount > 1000000) {
      // More than 1 million average
      discrepancies.push({
        type: 'transaction_sum',
        expectedValue: 1000000,
        calculatedValue: averageAmount,
        difference: averageAmount - 1000000,
        percentageDifference: ((averageAmount - 1000000) / 1000000) * 100,
        severity: 'low',
      });
      score *= 0.95;
    }

    return { discrepancies, qualityScore: score };
  }

  private extractControlTotals(transactions: ParsedTransaction[]): ControlTotal[] {
    const controlTotals: ControlTotal[] = [];

    // Patterns that might indicate control totals in transaction descriptions
    const totalPatterns = [
      /\b(?:итого|total|сумма|amount|баланс|balance)\s*[:=]?\s*([\d.,\s-]+)/gi,
      /\b(?:оборот|turnover|оборот по дебету|debit turnover)\s*[:=]?\s*([\d.,\s-]+)/gi,
      /\b(?:оборот по кредиту|credit turnover)\s*[:=]?\s*([\d.,\s-]+)/gi,
    ];

    transactions.forEach((tx, index) => {
      const text = (tx.paymentPurpose || '').toLowerCase();

      totalPatterns.forEach(pattern => {
        const matches = [...text.matchAll(pattern)];
        matches.forEach(match => {
          const amountStr = match[1].replace(/[^\d.,-]/g, '');
          const amount = this.parseAmountFromText(amountStr);

          if (amount && amount > 0) {
            let type: 'debit_total' | 'credit_total' | 'balance_total' = 'balance_total';

            if (match[0].includes('дебет') || match[0].includes('debit')) {
              type = 'debit_total';
            } else if (match[0].includes('кредит') || match[0].includes('credit')) {
              type = 'credit_total';
            }

            controlTotals.push({
              label: match[0].trim(),
              amount,
              type,
              rowNumber: index,
            });
          }
        });
      });
    });

    return controlTotals;
  }

  private validateAgainstControlTotals(
    transactionTotals: TransactionTotals,
    controlTotals: ControlTotal[],
  ): { discrepancies: TotalDiscrepancy[]; qualityScore: number } {
    const discrepancies: TotalDiscrepancy[] = [];
    let score = 1.0;

    controlTotals.forEach(control => {
      let expectedValue: number;

      switch (control.type) {
        case 'debit_total':
          expectedValue = transactionTotals.totalDebit;
          break;
        case 'credit_total':
          expectedValue = transactionTotals.totalCredit;
          break;
        case 'balance_total':
          expectedValue = Math.abs(transactionTotals.totalDebit - transactionTotals.totalCredit);
          break;
      }

      const difference = Math.abs(control.amount - expectedValue);
      const percentageDiff = (difference / Math.max(control.amount, expectedValue, 1)) * 100;

      if (percentageDiff > 1) {
        // More than 1% difference
        discrepancies.push({
          type: 'control_total',
          expectedValue,
          calculatedValue: control.amount,
          difference,
          percentageDifference: percentageDiff,
          severity: percentageDiff > 10 ? 'high' : percentageDiff > 5 ? 'medium' : 'low',
        });
        score *= Math.max(0.6, 1 - percentageDiff / 100);
      }
    });

    return { discrepancies, qualityScore: score };
  }

  private calculateExpectedBalance(
    transactions: ParsedTransaction[],
    metadata: ParsedStatementMetadata,
  ): number | undefined {
    if (metadata.balanceStart === undefined || metadata.balanceEnd === undefined) {
      return undefined;
    }

    return (
      this.calculateExpectedBalanceFromTotals(
        this.calculateTransactionTotals(transactions),
        metadata.balanceStart,
      ) ?? undefined
    );
  }

  private calculateExpectedBalanceFromTotals(
    transactionTotals: TransactionTotals,
    openingBalance?: number,
  ): number | null {
    if (openingBalance === undefined) {
      return null;
    }

    // For most account types, closing balance = opening balance + credits - debits
    return openingBalance + transactionTotals.totalCredit - transactionTotals.totalDebit;
  }

  private parseAmountFromText(amountStr: string): number | null {
    try {
      // Remove common separators and convert to number
      const cleaned = amountStr.replace(/[,\s]/g, match => {
        return match === ',' ? '.' : '';
      });

      const amount = Number.parseFloat(cleaned);
      return Number.isNaN(amount) ? null : amount;
    } catch {
      return null;
    }
  }

  // Method to generate checksum report
  generateChecksumReport(validationResult: ChecksumValidationResult): string {
    const lines: string[] = [];

    lines.push('=== Checksum Validation Report ===');
    lines.push(`Overall Status: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
    lines.push(`Quality Score: ${(validationResult.qualityScore * 100).toFixed(1)}%`);
    lines.push('');

    if (
      validationResult.expectedTotal !== undefined &&
      validationResult.calculatedTotal !== undefined
    ) {
      lines.push('Balance Verification:');
      lines.push(`  Expected: ${validationResult.expectedTotal.toFixed(2)}`);
      lines.push(`  Calculated: ${validationResult.calculatedTotal.toFixed(2)}`);
      if (validationResult.discrepancy !== undefined) {
        lines.push(`  Discrepancy: ${validationResult.discrepancy.toFixed(2)}`);
      }
      lines.push('');
    }

    if (validationResult.discrepancies.length > 0) {
      lines.push('Discrepancies Found:');
      validationResult.discrepancies.forEach((disc, index) => {
        lines.push(
          `  ${index + 1}. ${disc.type.replace('_', ' ').toUpperCase()} (${disc.severity})`,
        );
        lines.push(`     Expected: ${disc.expectedValue.toFixed(2)}`);
        lines.push(`     Calculated: ${disc.calculatedValue.toFixed(2)}`);
        lines.push(
          `     Difference: ${disc.difference.toFixed(2)} (${disc.percentageDifference.toFixed(2)}%)`,
        );
      });
    } else {
      lines.push('No discrepancies found - all checksums are valid!');
    }

    return lines.join('\n');
  }

  // Method to suggest corrections for common checksum issues
  suggestCorrections(validationResult: ChecksumValidationResult): string[] {
    const suggestions: string[] = [];

    validationResult.discrepancies.forEach(disc => {
      switch (disc.type) {
        case 'closing_balance':
          if (disc.percentageDifference < 1) {
            suggestions.push('Minor balance difference - likely due to rounding');
          } else if (disc.percentageDifference < 5) {
            suggestions.push(
              'Balance discrepancy - check for missing transactions or incorrect amounts',
            );
          } else {
            suggestions.push(
              'Significant balance error - verify data integrity or statement period',
            );
          }
          break;

        case 'control_total':
          suggestions.push('Control total mismatch - verify transaction classification');
          break;

        case 'transaction_sum':
          suggestions.push(
            'Transaction sum inconsistent - review large transactions for data entry errors',
          );
          break;

        case 'opening_balance':
          suggestions.push('Unusual opening balance - verify account and period');
          break;
      }
    });

    return suggestions;
  }
}
