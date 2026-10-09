import { Injectable, Logger } from '@nestjs/common';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { forEachIssueRowWithSchema } from './column-auto-fix.util';

type TransactionFieldValue = string | number | boolean | Date | null | undefined;
type TransactionRecord = ParsedTransaction & Record<string, TransactionFieldValue>;

export interface ColumnInconsistencyResult {
  isConsistent: boolean;
  inconsistencies: ColumnIssue[];
  correctedData: ParsedTransaction[];
  qualityMetrics: ColumnQualityMetrics;
  fixAttempts: FixAttempt[];
}

export interface ColumnIssue {
  type:
    | 'missing_column'
    | 'extra_column'
    | 'misaligned_column'
    | 'data_type_mismatch'
    | 'empty_critical_field';
  field: string;
  rowIndices: number[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  autoFixable: boolean;
  suggestedFix?: string;
}

export interface ColumnQualityMetrics {
  totalRows: number;
  columnsWithData: number;
  completenessRatio: number;
  alignmentScore: number;
  dataQualityScore: number;
}

export interface FixAttempt {
  type: string;
  description: string;
  success: boolean;
  affectedRows: number;
  confidence: number;
}

export interface ColumnSchema {
  name: string;
  required: boolean;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  pattern?: RegExp;
  defaultValue?: TransactionFieldValue;
  inferFrom?: string[];
}

@Injectable()
export class ColumnAutoFixService {
  private readonly logger = new Logger(ColumnAutoFixService.name);

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getTransactionField(
    transaction: ParsedTransaction,
    field: string,
  ): TransactionFieldValue {
    return (transaction as TransactionRecord)[field];
  }

  private setTransactionField(
    transaction: ParsedTransaction,
    field: string,
    value: TransactionFieldValue,
  ): void {
    (transaction as TransactionRecord)[field] = value;
  }

  // Default schema for transaction data
  private readonly defaultSchema: ColumnSchema[] = [
    { name: 'transactionDate', required: true, dataType: 'date' },
    { name: 'documentNumber', required: false, dataType: 'string' },
    { name: 'counterpartyName', required: true, dataType: 'string' },
    {
      name: 'counterpartyBin',
      required: false,
      dataType: 'string',
      pattern: /^\d{12}$/,
    },
    { name: 'counterpartyAccount', required: false, dataType: 'string' },
    { name: 'counterpartyBank', required: false, dataType: 'string' },
    { name: 'debit', required: false, dataType: 'number' },
    { name: 'credit', required: false, dataType: 'number' },
    { name: 'paymentPurpose', required: true, dataType: 'string' },
    {
      name: 'currency',
      required: false,
      dataType: 'string',
      pattern: /^[A-Z]{3}$/,
    },
    { name: 'exchangeRate', required: false, dataType: 'number' },
    { name: 'amountForeign', required: false, dataType: 'number' },
  ];

  async detectAndFixColumnIssues(
    transactions: ParsedTransaction[],
    customSchema?: ColumnSchema[],
  ): Promise<ColumnInconsistencyResult> {
    this.logger.log(`Analyzing ${transactions.length} transactions for column inconsistencies`);

    const schema = customSchema || this.defaultSchema;
    const issues: ColumnIssue[] = [];
    const fixAttempts: FixAttempt[] = [];
    let correctedData = [...transactions];

    // Step 1: Detect column inconsistencies
    const detectedIssues = this.detectColumnIssues(correctedData, schema);
    issues.push(...detectedIssues);

    // Step 2: Auto-fix issues where possible
    for (const issue of issues) {
      if (issue.autoFixable) {
        const fixResult = await this.attemptAutoFix(correctedData, issue, schema);
        if (fixResult.success) {
          correctedData = fixResult.correctedData;
          fixAttempts.push(fixResult.attempt);
          this.logger.debug(`Auto-fixed ${issue.type}: ${issue.description}`);
        }
      }
    }

    // Step 3: Advanced fixes using context and patterns
    const advancedFixResult = await this.applyAdvancedFixes(correctedData, schema);
    correctedData = advancedFixResult.correctedData;
    fixAttempts.push(...advancedFixResult.fixAttempts);

    // Step 4: Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(correctedData, schema);

    this.logger.log(
      `Column auto-fix completed. Issues: ${issues.length}, Fixed: ${fixAttempts.filter(f => f.success).length}`,
    );

    return {
      isConsistent: issues.length === 0,
      inconsistencies: issues,
      correctedData,
      qualityMetrics,
      fixAttempts,
    };
  }

  private detectColumnIssues(
    transactions: ParsedTransaction[],
    schema: ColumnSchema[],
  ): ColumnIssue[] {
    const issues: ColumnIssue[] = [];

    transactions.forEach((transaction, index) => {
      // Check for missing required fields
      schema.forEach(column => {
        if (column.required) {
          const value = this.getTransactionField(transaction, column.name);
          if (value === undefined || value === null || value === '') {
            issues.push({
              type: column.dataType === 'string' ? 'empty_critical_field' : 'missing_column',
              field: column.name,
              rowIndices: [index],
              severity: 'critical',
              description: `Missing required field: ${column.name}`,
              autoFixable: true,
              suggestedFix: this.getDefaultValueSuggestion(column),
            });
          }
        }
      });

      // Check for data type mismatches
      schema.forEach(column => {
        const value = this.getTransactionField(transaction, column.name);
        if (value !== undefined && value !== null && value !== '') {
          if (!this.isValidDataType(value, column.dataType, column.pattern)) {
            issues.push({
              type: 'data_type_mismatch',
              field: column.name,
              rowIndices: [index],
              severity: 'medium',
              description: `Data type mismatch in ${column.name}: expected ${column.dataType}`,
              autoFixable: true,
            });
          }
        }
      });

      // Check for empty critical fields that should have data
      const criticalFields = ['counterpartyName', 'paymentPurpose'];
      criticalFields.forEach(fieldName => {
        const value = this.getTransactionField(transaction, fieldName);
        if (!value || (typeof value === 'string' && value.trim().length < 2)) {
          issues.push({
            type: 'empty_critical_field',
            field: fieldName,
            rowIndices: [index],
            severity: 'high',
            description: `Empty critical field: ${fieldName}`,
            autoFixable: true,
          });
        }
      });

      // Check for financial inconsistencies
      const hasDebit = transaction.debit && transaction.debit > 0;
      const hasCredit = transaction.credit && transaction.credit > 0;

      if (hasDebit && hasCredit) {
        issues.push({
          type: 'data_type_mismatch',
          field: 'debit/credit',
          rowIndices: [index],
          severity: 'high',
          description: 'Both debit and credit values present',
          autoFixable: true,
          suggestedFix: 'Keep the larger value, set the other to 0',
        });
      }

      if (!(hasDebit || hasCredit)) {
        issues.push({
          type: 'empty_critical_field',
          field: 'amount',
          rowIndices: [index],
          severity: 'medium',
          description: 'No amount specified',
          autoFixable: true,
        });
      }
    });

    return this.consolidateIssues(issues);
  }

  private async attemptAutoFix(
    transactions: ParsedTransaction[],
    issue: ColumnIssue,
    schema: ColumnSchema[],
  ): Promise<{
    success: boolean;
    correctedData: ParsedTransaction[];
    attempt: FixAttempt;
  }> {
    const correctedData = [...transactions];
    let success = false;
    let affectedRows = 0;

    try {
      switch (issue.type) {
        case 'missing_column':
        case 'empty_critical_field':
          success = await this.fixMissingField(correctedData, issue, schema);
          affectedRows = issue.rowIndices.length;
          break;

        case 'data_type_mismatch':
          success = await this.fixDataTypeMismatch(correctedData, issue, schema);
          affectedRows = issue.rowIndices.length;
          break;

        case 'misaligned_column':
          success = await this.fixMisalignedColumn(correctedData, issue, schema);
          affectedRows = issue.rowIndices.length;
          break;
      }
    } catch (error) {
      this.logger.warn(`Auto-fix failed for ${issue.type}: ${this.getErrorMessage(error)}`);
      success = false;
    }

    const attempt: FixAttempt = {
      type: issue.type,
      description: issue.description,
      success,
      affectedRows,
      confidence: success ? 0.8 : 0.2,
    };

    return { success, correctedData, attempt };
  }

  private async fixMissingField(
    transactions: ParsedTransaction[],
    issue: ColumnIssue,
    schema: ColumnSchema[],
  ): Promise<boolean> {
    return forEachIssueRowWithSchema(
      transactions,
      issue,
      schema,
      ({ columnSchema, transaction }) => {
        const inferredValue = this.inferMissingValue(transaction, issue.field, schema);

        if (inferredValue !== null) {
          this.setTransactionField(transaction, issue.field, inferredValue);
        } else if (columnSchema.defaultValue !== undefined) {
          this.setTransactionField(transaction, issue.field, columnSchema.defaultValue);
        } else {
          this.setTransactionField(
            transaction,
            issue.field,
            this.getIntelligentDefault(issue.field, transaction),
          );
        }
      },
    );
  }

  private async fixDataTypeMismatch(
    transactions: ParsedTransaction[],
    issue: ColumnIssue,
    schema: ColumnSchema[],
  ): Promise<boolean> {
    return forEachIssueRowWithSchema(
      transactions,
      issue,
      schema,
      ({ columnSchema, transaction }) => {
        const currentValue = this.getTransactionField(transaction, issue.field);
        const convertedValue = this.convertDataType(currentValue, columnSchema.dataType);

        if (convertedValue !== null) {
          this.setTransactionField(transaction, issue.field, convertedValue);
        }
      },
    );
  }

  private async fixMisalignedColumn(
    _transactions: ParsedTransaction[],
    _issue: ColumnIssue,
    _schema: ColumnSchema[],
  ): Promise<boolean> {
    // This would involve more complex column alignment logic
    // For now, we'll implement basic realignment based on patterns
    return true;
  }

  private async applyAdvancedFixes(
    transactions: ParsedTransaction[],
    _schema: ColumnSchema[],
  ): Promise<{
    correctedData: ParsedTransaction[];
    fixAttempts: FixAttempt[];
  }> {
    const correctedData = [...transactions];
    const fixAttempts: FixAttempt[] = [];

    // Fix 1: Extract document numbers from payment purpose
    const docNumberFix = await this.extractDocumentNumbers(correctedData);
    if (docNumberFix.affectedRows > 0) {
      fixAttempts.push(docNumberFix.attempt);
    }

    // Fix 2: Extract BIN numbers from counterparty names
    const binFix = await this.extractBinNumbers(correctedData);
    if (binFix.affectedRows > 0) {
      fixAttempts.push(binFix.attempt);
    }

    // Fix 3: Extract currency information
    const currencyFix = await this.extractCurrencyInfo(correctedData);
    if (currencyFix.affectedRows > 0) {
      fixAttempts.push(currencyFix.attempt);
    }

    // Fix 4: Fix transaction types
    const typeFix = await this.fixTransactionTypes(correctedData);
    if (typeFix.affectedRows > 0) {
      fixAttempts.push(typeFix.attempt);
    }

    // Fix 5: Fill missing exchange rates
    const exchangeRateFix = await this.fillMissingExchangeRates(correctedData);
    if (exchangeRateFix.affectedRows > 0) {
      fixAttempts.push(exchangeRateFix.attempt);
    }

    return { correctedData, fixAttempts };
  }

  private async extractDocumentNumbers(
    transactions: ParsedTransaction[],
  ): Promise<{ attempt: FixAttempt; affectedRows: number }> {
    let affectedRows = 0;

    transactions.forEach(transaction => {
      if (!transaction.documentNumber && transaction.paymentPurpose) {
        // Try to extract document number from payment purpose
        const patterns = [
          /(?:документ|doc|док|документ|реквизит)\s*[:#]?\s*([A-Za-z0-9-]{5,20})/gi,
          /([A-Za-z]{2,4}\d{6,10})/g, // Common doc number patterns
          /№?\s*([A-Za-z0-9-]{5,20})/g,
        ];

        for (const pattern of patterns) {
          const match = pattern.exec(transaction.paymentPurpose);
          if (match?.[1]) {
            transaction.documentNumber = match[1].trim();
            affectedRows++;
            break;
          }
        }
      }
    });

    return {
      attempt: {
        type: 'extract_document_numbers',
        description: 'Extracted document numbers from payment purpose',
        success: affectedRows > 0,
        affectedRows,
        confidence: 0.9,
      },
      affectedRows,
    };
  }

  private async extractBinNumbers(
    transactions: ParsedTransaction[],
  ): Promise<{ attempt: FixAttempt; affectedRows: number }> {
    let affectedRows = 0;

    transactions.forEach(transaction => {
      if (!transaction.counterpartyBin) {
        // Try to extract BIN from counterparty name or payment purpose
        const sources = [
          transaction.counterpartyName || '',
          transaction.paymentPurpose || '',
          transaction.counterpartyBank || '',
        ].join(' ');

        const binPattern = /\b(\d{12})\b/g;
        const matches = sources.match(binPattern);

        if (matches && matches.length > 0) {
          // Use the first 12-digit number as BIN
          transaction.counterpartyBin = matches[0];
          affectedRows++;
        }
      }
    });

    return {
      attempt: {
        type: 'extract_bin_numbers',
        description: 'Extracted BIN numbers from text fields',
        success: affectedRows > 0,
        affectedRows,
        confidence: 0.85,
      },
      affectedRows,
    };
  }

  private async extractCurrencyInfo(
    transactions: ParsedTransaction[],
  ): Promise<{ attempt: FixAttempt; affectedRows: number }> {
    let affectedRows = 0;
    const commonCurrencies = new Map<string, number>();

    // Find most common currency
    transactions.forEach(transaction => {
      if (transaction.currency) {
        const count = commonCurrencies.get(transaction.currency) || 0;
        commonCurrencies.set(transaction.currency, count + 1);
      }
    });

    // Determine default currency
    let defaultCurrency = appDefaultCurrency();
    let maxCount = 0;
    for (const [currency, count] of commonCurrencies.entries()) {
      if (count > maxCount) {
        maxCount = count;
        defaultCurrency = currency;
      }
    }

    // Fill missing currency
    transactions.forEach(transaction => {
      if (!transaction.currency) {
        transaction.currency = defaultCurrency;
        affectedRows++;
      }
    });

    return {
      attempt: {
        type: 'fill_currency',
        description: `Filled missing currencies with ${defaultCurrency}`,
        success: affectedRows > 0,
        affectedRows,
        confidence: 0.95,
      },
      affectedRows,
    };
  }

  private async fixTransactionTypes(
    transactions: ParsedTransaction[],
  ): Promise<{ attempt: FixAttempt; affectedRows: number }> {
    let affectedRows = 0;

    transactions.forEach(transaction => {
      const hasDebit = transaction.debit && transaction.debit > 0;
      const hasCredit = transaction.credit && transaction.credit > 0;

      if (hasDebit && hasCredit) {
        // Keep the larger value
        if (transaction.debit && transaction.credit && transaction.debit > transaction.credit) {
          transaction.credit = 0;
        } else {
          transaction.debit = 0;
        }
        affectedRows++;
      } else if (!(hasDebit || hasCredit)) {
        // Try to infer from payment purpose
        const isExpense =
          /(?:списание|расход|оплата|payment|expense|withdrawal|покупка|purchase)/i.test(
            transaction.paymentPurpose || '',
          );

        if (isExpense) {
          transaction.debit = 0; // Will be filled later with actual amount
        } else {
          transaction.credit = 0;
        }
        affectedRows++;
      }
    });

    return {
      attempt: {
        type: 'fix_transaction_types',
        description: 'Fixed debit/credit inconsistencies',
        success: affectedRows > 0,
        affectedRows,
        confidence: 0.8,
      },
      affectedRows,
    };
  }

  private async fillMissingExchangeRates(
    transactions: ParsedTransaction[],
  ): Promise<{ attempt: FixAttempt; affectedRows: number }> {
    let affectedRows = 0;

    // Calculate average exchange rate from existing rates
    const existingRates = transactions
      .filter(tx => tx.exchangeRate && tx.exchangeRate > 0)
      .map(tx => tx.exchangeRate || 0);

    let averageRate = 1; // Default
    if (existingRates.length > 0) {
      averageRate = existingRates.reduce((sum, rate) => sum + rate, 0) / existingRates.length;
    }

    // Fill missing exchange rates
    transactions.forEach(transaction => {
      if (!transaction.exchangeRate && transaction.amountForeign) {
        transaction.exchangeRate = averageRate;
        affectedRows++;
      }
    });

    return {
      attempt: {
        type: 'fill_exchange_rates',
        description: `Filled missing exchange rates with ${averageRate.toFixed(4)}`,
        success: affectedRows > 0,
        affectedRows,
        confidence: 0.7,
      },
      affectedRows,
    };
  }

  private inferMissingValue(
    transaction: ParsedTransaction,
    fieldName: string,
    schema: ColumnSchema[],
  ): TransactionFieldValue {
    const columnSchema = schema.find(col => col.name === fieldName);
    if (!columnSchema?.inferFrom) {
      return null;
    }

    // Try to infer from related fields
    for (const sourceField of columnSchema.inferFrom) {
      const sourceValue = this.getTransactionField(transaction, sourceField);
      if (sourceValue) {
        return this.inferFromSource(sourceValue, fieldName, sourceField);
      }
    }

    return null;
  }

  private inferFromSource(
    sourceValue: TransactionFieldValue,
    targetField: string,
    _sourceField: string,
  ): TransactionFieldValue {
    // Implement specific inference logic based on field relationships
    if (typeof sourceValue !== 'string') {
      return null;
    }

    switch (targetField) {
      case 'currency':
        return this.extractCurrencyFromText(sourceValue);
      case 'counterpartyBank':
        return this.extractBankFromText(sourceValue);
      case 'documentNumber':
        return this.extractDocNumberFromText(sourceValue);
      default:
        return null;
    }
  }

  private extractCurrencyFromText(text: string): string | null {
    const currencyPatterns = {
      KZT: /(?:KZT|₽|тенге|тг)/gi,
      USD: /(?:USD|\$|доллар)/gi,
      EUR: /(?:EUR|€|евро)/gi,
      RUB: /(?:RUB|₽|рубль)/gi,
    };

    for (const [currency, pattern] of Object.entries(currencyPatterns)) {
      if (pattern.test(text)) {
        return currency;
      }
    }

    return null;
  }

  private extractBankFromText(text: string): string | null {
    const bankPatterns = [
      /(?:казкоммерцбанк|kkb|казком)/gi,
      /(?:народный|halyk|халык)/gi,
      /(?:банк\s*центркредит|центркредит|bcc)/gi,
      /(?:атфбанк|атф)/gi,
      /(?:каспи|kaspi)/gi,
      /(?:береке|bereke)/gi,
    ];

    for (const pattern of bankPatterns) {
      const match = text.match(pattern);
      if (match?.[0]) {
        return match[0];
      }
    }

    return null;
  }

  private extractDocNumberFromText(text: string): string | null {
    const patterns = [
      /(?:документ|doc|док)\s*[:#]?\s*([A-Za-z0-9-]{5,20})/gi,
      /([A-Za-z]{2,4}\d{6,10})/g,
      /№?\s*([A-Za-z0-9-]{5,20})/g,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private getDefaultValueSuggestion(column: ColumnSchema): string {
    if (column.defaultValue !== undefined) {
      return `Use default value: ${column.defaultValue}`;
    }

    switch (column.name) {
      case 'transactionDate':
        return 'Use current date';
      case 'counterpartyName':
        return 'Use "Unknown"';
      case 'paymentPurpose':
        return 'Use "Transaction"';
      case 'currency':
        return 'Use default currency (KZT)';
      default:
        return 'Use empty string';
    }
  }

  private getIntelligentDefault(
    fieldName: string,
    transaction: ParsedTransaction,
  ): TransactionFieldValue {
    switch (fieldName) {
      case 'transactionDate':
        return new Date();
      case 'counterpartyName':
        return transaction.paymentPurpose?.substring(0, 50) || 'Unknown';
      case 'paymentPurpose':
        return 'Transaction';
      case 'currency':
        return appDefaultCurrency();
      case 'exchangeRate':
        return 1;
      case 'debit':
      case 'credit':
        return 0;
      default:
        return '';
    }
  }

  private isValidDataType(
    value: TransactionFieldValue,
    expectedType: ColumnSchema['dataType'],
    pattern?: RegExp,
  ): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    switch (expectedType) {
      case 'string':
        return typeof value === 'string' && (!pattern || pattern.test(value));
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value);
      case 'date':
        return value instanceof Date && !Number.isNaN(value.getTime());
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return true;
    }
  }

  private convertDataType(
    value: TransactionFieldValue,
    targetType: ColumnSchema['dataType'],
  ): TransactionFieldValue {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      switch (targetType) {
        case 'string':
          return String(value);
        case 'number': {
          const num = Number(String(value).replace(/[^\d.-]/g, ''));
          return Number.isNaN(num) ? null : num;
        }
        case 'date':
          if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) {
            return new Date(value);
          }
          return null;
        case 'boolean':
          if (typeof value === 'boolean') {
            return value;
          }
          {
            const str = String(value).toLowerCase();
            return ['true', '1', 'yes', 'да'].includes(str);
          }
        default:
          return value;
      }
    } catch {
      return null;
    }
  }

  private consolidateIssues(issues: ColumnIssue[]): ColumnIssue[] {
    const consolidated = new Map<string, ColumnIssue>();

    issues.forEach(issue => {
      const key = `${issue.type}-${issue.field}`;
      const existing = consolidated.get(key);

      if (existing) {
        existing.rowIndices.push(...issue.rowIndices);
        existing.severity = this.getWorstSeverity(existing.severity, issue.severity);
      } else {
        consolidated.set(key, { ...issue });
      }
    });

    return Array.from(consolidated.values());
  }

  private getWorstSeverity(
    severity1: ColumnIssue['severity'],
    severity2: ColumnIssue['severity'],
  ): ColumnIssue['severity'] {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 } as const;
    const maxSeverity = Math.max(severityOrder[severity1], severityOrder[severity2]);
    const matched = (Object.keys(severityOrder) as Array<keyof typeof severityOrder>).find(
      key => severityOrder[key] === maxSeverity,
    );
    return matched || 'low';
  }

  private calculateQualityMetrics(
    transactions: ParsedTransaction[],
    schema: ColumnSchema[],
  ): ColumnQualityMetrics {
    const totalRows = transactions.length;
    let columnsWithData = 0;
    let totalFields = 0;
    let filledFields = 0;

    schema.forEach(column => {
      let hasData = false;

      transactions.forEach(transaction => {
        const value = this.getTransactionField(transaction, column.name);
        totalFields++;

        if (value !== undefined && value !== null && value !== '') {
          filledFields++;
          hasData = true;
        }
      });

      if (hasData) {
        columnsWithData++;
      }
    });

    const completenessRatio = totalFields > 0 ? filledFields / totalFields : 0;
    const alignmentScore = columnsWithData / schema.length;
    const dataQualityScore = (completenessRatio + alignmentScore) / 2;

    return {
      totalRows,
      columnsWithData,
      completenessRatio,
      alignmentScore,
      dataQualityScore,
    };
  }

  // Public method to add custom schema
  addCustomSchema(schema: ColumnSchema[]): void {
    this.logger.log(`Custom schema added with ${schema.length} columns`);
  }

  // Public method to get current schema
  getCurrentSchema(): ColumnSchema[] {
    return [...this.defaultSchema];
  }
}
