import { Injectable, Logger } from '@nestjs/common';
import { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { createFieldValidationState } from './column-validation.util';

type FieldValue = string | number | boolean | Date | null | undefined;
type TransactionRecord = ParsedTransaction & Record<string, FieldValue>;

export interface ColumnValidationResult {
  isValid: boolean;
  inconsistencies: ColumnInconsistency[];
  correctedTransactions: ParsedTransaction[];
  qualityScore: number;
}

export interface ColumnInconsistency {
  type: 'missing_column' | 'extra_column' | 'type_mismatch' | 'format_inconsistency';
  field: string;
  rowNumber?: number;
  expectedValue?: unknown;
  actualValue?: unknown;
  severity: 'low' | 'medium' | 'high';
  autoFixable: boolean;
}

export interface ColumnSchema {
  field: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  format?: string;
  patterns?: RegExp[];
}

@Injectable()
export class ColumnValidationService {
  private readonly logger = new Logger(ColumnValidationService.name);

  private getTransactionField(transaction: ParsedTransaction, field: string): FieldValue {
    return (transaction as TransactionRecord)[field];
  }

  private setTransactionField(transaction: ParsedTransaction, field: string, value: unknown): void {
    (transaction as TransactionRecord)[field] = value as FieldValue;
  }

  // Expected schema for transaction data
  private readonly transactionSchema: ColumnSchema[] = [
    { field: 'transactionDate', type: 'date', required: true },
    { field: 'documentNumber', type: 'string', required: false },
    { field: 'counterpartyName', type: 'string', required: true },
    { field: 'counterpartyBin', type: 'string', required: false },
    { field: 'counterpartyAccount', type: 'string', required: false },
    { field: 'counterpartyBank', type: 'string', required: false },
    { field: 'debit', type: 'number', required: false },
    { field: 'credit', type: 'number', required: false },
    { field: 'paymentPurpose', type: 'string', required: true },
    { field: 'currency', type: 'string', required: false },
    { field: 'exchangeRate', type: 'number', required: false },
    { field: 'amountForeign', type: 'number', required: false },
  ];

  async validateTransactions(transactions: ParsedTransaction[]): Promise<ColumnValidationResult> {
    this.logger.log(`Validating ${transactions.length} transactions`);

    const inconsistencies: ColumnInconsistency[] = [];
    let correctedTransactions = [...transactions];
    let totalScore = 1.0;

    // Validate each transaction
    for (let i = 0; i < correctedTransactions.length; i++) {
      const result = await this.validateTransaction(correctedTransactions[i], i);

      if (result.inconsistencies.length > 0) {
        inconsistencies.push(...result.inconsistencies);
        correctedTransactions[i] = result.correctedTransaction;

        // Reduce quality score based on severity
        const severityWeight = result.inconsistencies.reduce((weight, inc) => {
          switch (inc.severity) {
            case 'high':
              return weight + 0.3;
            case 'medium':
              return weight + 0.2;
            case 'low':
              return weight + 0.1;
            default:
              return weight;
          }
        }, 0);
        totalScore *= 1 - severityWeight;
      }
    }

    // Apply cross-transaction validation
    const crossValidationResult =
      await this.validateCrossTransactionConsistency(correctedTransactions);
    inconsistencies.push(...crossValidationResult.inconsistencies);
    correctedTransactions = crossValidationResult.correctedTransactions;

    // Calculate overall quality score
    const qualityScore = Math.max(0.1, Math.min(1.0, totalScore));

    this.logger.log(
      `Validation completed. Quality score: ${qualityScore.toFixed(2)}, Inconsistencies: ${inconsistencies.length}`,
    );

    return {
      isValid: inconsistencies.length === 0,
      inconsistencies,
      correctedTransactions,
      qualityScore,
    };
  }

  private async validateTransaction(
    transaction: ParsedTransaction,
    rowNumber: number,
  ): Promise<{ inconsistencies: ColumnInconsistency[]; correctedTransaction: ParsedTransaction }> {
    const inconsistencies: ColumnInconsistency[] = [];
    const corrected = { ...transaction };

    // Check each field according to schema
    for (const schema of this.transactionSchema) {
      const fieldResult = await this.validateField(
        this.getTransactionField(transaction, schema.field),
        schema,
        rowNumber,
      );

      if (!fieldResult.isValid) {
        inconsistencies.push(...fieldResult.inconsistencies);

        // Apply auto-fix if possible
        if (fieldResult.correctedValue !== undefined) {
          this.setTransactionField(corrected, schema.field, fieldResult.correctedValue);
        }
      }
    }

    // Check financial logic
    const financialResult = await this.validateFinancialLogic(corrected, rowNumber);
    inconsistencies.push(...financialResult.inconsistencies);

    if (financialResult.correctedTransaction) {
      Object.assign(corrected, financialResult.correctedTransaction);
    }

    return { inconsistencies, correctedTransaction: corrected };
  }

  private async validateField(
    value: unknown,
    schema: ColumnSchema,
    rowNumber: number,
  ): Promise<{
    isValid: boolean;
    inconsistencies: ColumnInconsistency[];
    correctedValue?: unknown;
  }> {
    const inconsistencies: ColumnInconsistency[] = [];

    // Check required fields
    if (schema.required && (value === undefined || value === null || value === '')) {
      inconsistencies.push({
        type: 'missing_column',
        field: schema.field,
        rowNumber,
        severity: 'high',
        autoFixable: true,
      });

      const defaultValue = this.getDefaultValue(schema);
      return {
        isValid: false,
        inconsistencies,
        correctedValue: defaultValue,
      };
    }

    // If field is not required and empty, skip further validation
    if (!schema.required && (value === undefined || value === null || value === '')) {
      return { isValid: true, inconsistencies };
    }

    // Type validation
    const typeValidation = await this.validateFieldType(value, schema, rowNumber);
    if (!typeValidation.isValid) {
      inconsistencies.push(...typeValidation.inconsistencies);
      return {
        isValid: false,
        inconsistencies,
        correctedValue: typeValidation.correctedValue,
      };
    }

    // Format validation
    if (schema.format || schema.patterns) {
      const formatValidation = await this.validateFieldFormat(value, schema, rowNumber);
      if (!formatValidation.isValid) {
        inconsistencies.push(...formatValidation.inconsistencies);
        return {
          isValid: false,
          inconsistencies,
          correctedValue: formatValidation.correctedValue,
        };
      }
    }

    return { isValid: true, inconsistencies };
  }

  private async validateFieldType(
    value: unknown,
    schema: ColumnSchema,
    rowNumber: number,
  ): Promise<{
    isValid: boolean;
    inconsistencies: ColumnInconsistency[];
    correctedValue?: unknown;
  }> {
    const state = createFieldValidationState(value);

    switch (schema.type) {
      case 'string':
        if (typeof value !== 'string') {
          state.isValid = false;
          const stringValue = String(value).trim();
          state.inconsistencies.push({
            type: 'type_mismatch',
            field: schema.field,
            rowNumber,
            expectedValue: 'string',
            actualValue: typeof value,
            severity: 'medium',
            autoFixable: true,
          });
          state.correctedValue = stringValue;
        }
        break;

      case 'number':
        if (typeof value !== 'number') {
          const numValue = Number(value);
          if (Number.isNaN(numValue)) {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'type_mismatch',
              field: schema.field,
              rowNumber,
              expectedValue: 'number',
              actualValue: typeof value,
              severity: 'high',
              autoFixable: false,
            });
          } else {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'type_mismatch',
              field: schema.field,
              rowNumber,
              expectedValue: 'number',
              actualValue: typeof value,
              severity: 'medium',
              autoFixable: true,
            });
            state.correctedValue = numValue;
          }
        }
        break;

      case 'date':
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
          const dateValue =
            typeof value === 'string' || typeof value === 'number' || value instanceof Date
              ? new Date(value)
              : new Date(Number.NaN);
          if (Number.isNaN(dateValue.getTime())) {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'type_mismatch',
              field: schema.field,
              rowNumber,
              expectedValue: 'date',
              actualValue: typeof value,
              severity: 'high',
              autoFixable: false,
            });
          } else {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'type_mismatch',
              field: schema.field,
              rowNumber,
              expectedValue: 'date',
              actualValue: typeof value,
              severity: 'medium',
              autoFixable: true,
            });
            state.correctedValue = dateValue;
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          const boolValue = this.parseBoolean(value);
          if (boolValue === undefined) {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'type_mismatch',
              field: schema.field,
              rowNumber,
              expectedValue: 'boolean',
              actualValue: typeof value,
              severity: 'high',
              autoFixable: false,
            });
          } else {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'type_mismatch',
              field: schema.field,
              rowNumber,
              expectedValue: 'boolean',
              actualValue: typeof value,
              severity: 'medium',
              autoFixable: true,
            });
            state.correctedValue = boolValue;
          }
        }
        break;
    }

    return state;
  }

  private async validateFieldFormat(
    value: unknown,
    schema: ColumnSchema,
    rowNumber: number,
  ): Promise<{
    isValid: boolean;
    inconsistencies: ColumnInconsistency[];
    correctedValue?: unknown;
  }> {
    const state = createFieldValidationState(value);

    // Check patterns if defined
    if (schema.patterns && Array.isArray(schema.patterns)) {
      for (const pattern of schema.patterns) {
        if (!pattern.test(String(value))) {
          state.isValid = false;
          state.inconsistencies.push({
            type: 'format_inconsistency',
            field: schema.field,
            rowNumber,
            expectedValue: pattern.source,
            actualValue: String(value),
            severity: 'medium',
            autoFixable: false,
          });
        }
      }
    }

    // Check specific format requirements
    if (schema.format) {
      switch (schema.format) {
        case 'currency_code': {
          if (!/^[A-Z]{3}$/.test(String(value))) {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'format_inconsistency',
              field: schema.field,
              rowNumber,
              expectedValue: '3-letter ISO currency code',
              actualValue: String(value),
              severity: 'medium',
              autoFixable: true,
            });
            state.correctedValue = String(value).toUpperCase().substring(0, 3);
          }
          break;
        }

        case 'account_number': {
          const accountStr = String(value).replace(/\s/g, '');
          if (!/^\d{10,30}$/.test(accountStr)) {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'format_inconsistency',
              field: schema.field,
              rowNumber,
              expectedValue: '10-30 digit account number',
              actualValue: String(value),
              severity: 'medium',
              autoFixable: false,
            });
          }
          break;
        }

        case 'bin_iin': {
          const binStr = String(value).replace(/\s/g, '');
          if (!/^\d{12}$/.test(binStr)) {
            state.isValid = false;
            state.inconsistencies.push({
              type: 'format_inconsistency',
              field: schema.field,
              rowNumber,
              expectedValue: '12 digit BIN/IIN',
              actualValue: String(value),
              severity: 'medium',
              autoFixable: false,
            });
          }
          break;
        }
      }
    }

    return state;
  }

  private async validateFinancialLogic(
    transaction: ParsedTransaction,
    rowNumber: number,
  ): Promise<{
    inconsistencies: ColumnInconsistency[];
    correctedTransaction?: Partial<ParsedTransaction>;
  }> {
    const inconsistencies: ColumnInconsistency[] = [];
    const corrections: Partial<ParsedTransaction> = {};

    // Check that either debit or credit is set, not both
    const hasDebit = transaction.debit !== undefined && transaction.debit > 0;
    const hasCredit = transaction.credit !== undefined && transaction.credit > 0;

    if (hasDebit && hasCredit) {
      inconsistencies.push({
        type: 'format_inconsistency',
        field: 'debit/credit',
        rowNumber,
        expectedValue: 'Either debit OR credit, not both',
        actualValue: 'Both values present',
        severity: 'high',
        autoFixable: true,
      });

      // Keep the larger value as it's more likely correct
      if ((transaction.debit ?? 0) > (transaction.credit ?? 0)) {
        corrections.credit = undefined;
      } else {
        corrections.debit = undefined;
      }
    } else if (!(hasDebit || hasCredit)) {
      inconsistencies.push({
        type: 'missing_column',
        field: 'debit/credit',
        rowNumber,
        expectedValue: 'Either debit OR credit',
        actualValue: 'Neither value present',
        severity: 'high',
        autoFixable: false,
      });
    }

    // Validate foreign currency consistency
    if (transaction.amountForeign && !transaction.exchangeRate) {
      inconsistencies.push({
        type: 'missing_column',
        field: 'exchangeRate',
        rowNumber,
        expectedValue: 'Exchange rate required for foreign currency amount',
        actualValue: 'Missing exchange rate',
        severity: 'medium',
        autoFixable: false,
      });
    }

    // Validate date consistency
    if (transaction.transactionDate) {
      const now = new Date();
      if (transaction.transactionDate > now) {
        inconsistencies.push({
          type: 'format_inconsistency',
          field: 'transactionDate',
          rowNumber,
          expectedValue: 'Date should not be in the future',
          actualValue: transaction.transactionDate,
          severity: 'medium',
          autoFixable: false,
        });
      }

      // Check if date is too far in the past (older than 10 years)
      const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
      if (transaction.transactionDate < tenYearsAgo) {
        inconsistencies.push({
          type: 'format_inconsistency',
          field: 'transactionDate',
          rowNumber,
          expectedValue: 'Date should not be older than 10 years',
          actualValue: transaction.transactionDate,
          severity: 'low',
          autoFixable: false,
        });
      }
    }

    return {
      inconsistencies,
      correctedTransaction: Object.keys(corrections).length > 0 ? corrections : undefined,
    };
  }

  private async validateCrossTransactionConsistency(transactions: ParsedTransaction[]): Promise<{
    inconsistencies: ColumnInconsistency[];
    correctedTransactions: ParsedTransaction[];
  }> {
    const inconsistencies: ColumnInconsistency[] = [];
    const correctedTransactions = [...transactions];

    // Check for consistent currency usage
    const currencies = new Set<string>();
    transactions.forEach(tx => {
      if (tx.currency) {
        currencies.add(tx.currency);
      }
    });

    if (currencies.size > 1) {
      inconsistencies.push({
        type: 'format_inconsistency',
        field: 'currency',
        expectedValue: 'Consistent currency across all transactions',
        actualValue: `Multiple currencies: ${Array.from(currencies).join(', ')}`,
        severity: 'medium',
        autoFixable: false,
      });
    }

    // Check for duplicate document numbers
    const docNumbers = new Map<string, number[]>();
    transactions.forEach((tx, index) => {
      if (tx.documentNumber) {
        const indices = docNumbers.get(tx.documentNumber) || [];
        indices.push(index);
        docNumbers.set(tx.documentNumber, indices);
      }
    });

    for (const [docNumber, indices] of docNumbers.entries()) {
      if (indices.length > 1) {
        inconsistencies.push({
          type: 'format_inconsistency',
          field: 'documentNumber',
          expectedValue: 'Unique document numbers',
          actualValue: `Duplicate document number: ${docNumber} in rows ${indices.join(', ')}`,
          severity: 'medium',
          autoFixable: false,
        });
      }
    }

    return { inconsistencies, correctedTransactions };
  }

  private getDefaultValue(schema: ColumnSchema): FieldValue {
    switch (schema.type) {
      case 'string':
        return '';
      case 'number':
        return 0;
      case 'date':
        return new Date();
      case 'boolean':
        return false;
      default:
        return null;
    }
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    const strValue = String(value).toLowerCase().trim();

    if (['true', '1', 'yes', 'on', 'да', 'yes'].includes(strValue)) {
      return true;
    }

    if (['false', '0', 'no', 'off', 'нет', 'no'].includes(strValue)) {
      return false;
    }

    return undefined;
  }

  // Method to add custom schema for different transaction types
  addCustomSchema(name: string, schema: ColumnSchema[]): void {
    this.logger.log(`Custom schema ${name} added with ${schema.length} fields`);
    // Store custom schemas for future use
  }

  // Method to get schema information
  getSchema(): ColumnSchema[] {
    return [...this.transactionSchema];
  }
}
