import type { Mocked } from 'vitest';
import { TransactionNormalizer } from '@/modules/parsing/services/transaction-normalizer.service';
import { UniversalDateParser } from '@/modules/parsing/services/universal-date-parser.service';
import { UniversalAmountParser } from '@/modules/parsing/services/universal-amount-parser.service';
import { TextCleaningService } from '@/modules/parsing/services/text-cleaning.service';
import { ColumnValidationService } from '@/modules/parsing/services/column-validation.service';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';

describe('TransactionNormalizer', () => {
  let service: TransactionNormalizer;
  let mockDateParser: Mocked<Pick<UniversalDateParser, 'parseDate'>>;
  let mockAmountParser: Mocked<Pick<UniversalAmountParser, 'parseAmount'>>;
  let mockTextCleaning: Mocked<Pick<TextCleaningService, 'cleanCounterpartyName' | 'cleanPaymentPurpose'>>;
  let mockColumnValidation: Mocked<Pick<ColumnValidationService, 'validateTransactions'>>;

  const makeTransaction = (overrides: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
    transactionDate: new Date('2026-01-15'),
    counterpartyName: 'Test Company',
    paymentPurpose: 'Payment for services',
    debit: 1000,
    currency: 'KZT',
    ...overrides,
  });

  const makeDateResult = (date = new Date('2026-01-15')) => ({
    date,
    format: 'ALREADY_VALID',
    confidence: 0.95,
  });

  const makeAmountResult = (amount: number, currency = 'KZT') => ({
    amount,
    currency,
    isNegative: false,
    format: 'number',
    confidence: 0.99,
  });

  const makeTextResult = (text: string) => ({
    cleanedText: text,
    originalText: text,
    changes: [],
    confidence: 0.9,
  });

  const makeValidationResult = (transactions: ParsedTransaction[]) => ({
    isValid: true,
    inconsistencies: [],
    correctedTransactions: transactions,
    qualityScore: 1.0,
  });

  beforeEach(() => {
    mockDateParser = {
      parseDate: vi.fn().mockResolvedValue(makeDateResult()),
    };

    mockAmountParser = {
      parseAmount: vi.fn().mockResolvedValue(makeAmountResult(1000)),
    };

    mockTextCleaning = {
      cleanCounterpartyName: vi.fn().mockResolvedValue(makeTextResult('Test Company')),
      cleanPaymentPurpose: vi.fn().mockResolvedValue(makeTextResult('Payment for services')),
    };

    mockColumnValidation = {
      validateTransactions: vi.fn().mockResolvedValue(makeValidationResult([makeTransaction()])),
    };

    service = new TransactionNormalizer(
      mockDateParser as unknown as UniversalDateParser,
      mockAmountParser as unknown as UniversalAmountParser,
      mockTextCleaning as unknown as TextCleaningService,
      mockColumnValidation as unknown as ColumnValidationService,
    );
  });

  describe('normalizeTransaction', () => {
    it('returns a normalized transaction with _normalization metadata', async () => {
      const tx = makeTransaction();

      const result = await service.normalizeTransaction(tx);

      expect(result._normalization).toBeDefined();
      expect(result._normalization?.confidence).toBeGreaterThanOrEqual(0.1);
      expect(result._normalization?.confidence).toBeLessThanOrEqual(1.0);
    });

    it('calls dateParser.parseDate for non-Date transactionDate', async () => {
      const tx = makeTransaction({ transactionDate: '2026-01-15' as any });

      await service.normalizeTransaction(tx);

      expect(mockDateParser.parseDate).toHaveBeenCalled();
    });

    it('does not call dateParser.parseDate when transactionDate is a valid Date', async () => {
      const tx = makeTransaction({ transactionDate: new Date('2026-01-15') });

      await service.normalizeTransaction(tx);

      // Date is already valid, so parseDate is not called
      expect(mockDateParser.parseDate).not.toHaveBeenCalled();
    });

    it('calls amountParser.parseAmount for debit field', async () => {
      const tx = makeTransaction({ debit: 500 });

      await service.normalizeTransaction(tx);

      expect(mockAmountParser.parseAmount).toHaveBeenCalledWith('500');
    });

    it('calls amountParser.parseAmount for credit field', async () => {
      const tx = makeTransaction({ debit: undefined, credit: 300 });
      mockAmountParser.parseAmount.mockResolvedValue(makeAmountResult(300));

      await service.normalizeTransaction(tx);

      expect(mockAmountParser.parseAmount).toHaveBeenCalledWith('300');
    });

    it('calls textCleaning.cleanCounterpartyName', async () => {
      const tx = makeTransaction({ counterpartyName: 'ТОО Some Company' });

      await service.normalizeTransaction(tx);

      expect(mockTextCleaning.cleanCounterpartyName).toHaveBeenCalledWith('ТОО Some Company', 'en');
    });

    it('calls textCleaning.cleanPaymentPurpose', async () => {
      const tx = makeTransaction({ paymentPurpose: 'Payment for order' });

      await service.normalizeTransaction(tx);

      expect(mockTextCleaning.cleanPaymentPurpose).toHaveBeenCalledWith('Payment for order', 'en');
    });

    it('sets default currency when not set', async () => {
      const tx = makeTransaction({ currency: undefined });
      mockAmountParser.parseAmount.mockResolvedValue({
        amount: 1000,
        isNegative: false,
        format: 'number',
        confidence: 0.99,
      });

      const result = await service.normalizeTransaction(tx, { defaultCurrency: 'USD' });

      expect(result.currency).toBe('USD');
    });

    it('preserves existing currency', async () => {
      const tx = makeTransaction({ currency: 'EUR' });
      mockAmountParser.parseAmount.mockResolvedValue(makeAmountResult(1000, 'EUR'));

      const result = await service.normalizeTransaction(tx);

      expect(result.currency).toBe('EUR');
    });

    it('normalizes KZT BIN (removes spaces)', async () => {
      const tx = makeTransaction({ counterpartyBin: '123456 789012', currency: 'KZT' });

      const result = await service.normalizeTransaction(tx);

      expect(result.counterpartyBin).toBe('123456789012');
    });

    it('extracts document number from payment purpose when missing', async () => {
      const tx = makeTransaction({
        documentNumber: undefined,
        paymentPurpose: 'Transfer doc #ABC123 for services',
      });
      mockTextCleaning.cleanPaymentPurpose.mockResolvedValue(
        makeTextResult('Transfer doc #ABC123 for services'),
      );

      const result = await service.normalizeTransaction(tx);

      expect(result.documentNumber).toBe('ABC123');
    });

    it('sets exchangeRate to 1 when amountForeign present without rate', async () => {
      const tx = makeTransaction({ amountForeign: 100, exchangeRate: undefined });

      const result = await service.normalizeTransaction(tx);

      expect(result.exchangeRate).toBe(1);
    });

    it('does not set _normalization when preserveOriginalValues is true', async () => {
      const tx = makeTransaction();

      const result = await service.normalizeTransaction(tx, { preserveOriginalValues: true });

      expect(result._normalization).toBeUndefined();
    });

    it('skips column validation in strictMode', async () => {
      const tx = makeTransaction();

      await service.normalizeTransaction(tx, { strictMode: true });

      expect(mockColumnValidation.validateTransactions).not.toHaveBeenCalled();
    });

    it('runs column validation when not in strictMode', async () => {
      const tx = makeTransaction();

      await service.normalizeTransaction(tx, { strictMode: false });

      expect(mockColumnValidation.validateTransactions).toHaveBeenCalled();
    });

    it('reduces confidence when date normalization fails', async () => {
      const tx = makeTransaction({ transactionDate: null as any });

      const result = await service.normalizeTransaction(tx);

      // transactionDate is null, normalizeDate returns null, confidence *= 0.3
      expect(result._normalization?.confidence).toBeLessThan(0.8);
    });
  });

  describe('normalizeTransactions', () => {
    it('returns same number of transactions as input', async () => {
      const transactions = [
        makeTransaction({ debit: 100 }),
        makeTransaction({ credit: 200 }),
        makeTransaction({ debit: 300 }),
      ];

      const result = await service.normalizeTransactions(transactions);

      expect(result).toHaveLength(3);
    });

    it('returns empty array for empty input', async () => {
      const result = await service.normalizeTransactions([]);

      expect(result).toHaveLength(0);
    });

    it('adds fallback transaction with low confidence on normalization error', async () => {
      mockTextCleaning.cleanCounterpartyName.mockRejectedValueOnce(new Error('Parsing failed'));

      // The service catches errors internally and adds fallback
      const transactions = [makeTransaction()];
      const result = await service.normalizeTransactions(transactions);

      expect(result).toHaveLength(1);
    });

    it('applies options to each transaction', async () => {
      const transactions = [makeTransaction({ currency: undefined })];
      mockAmountParser.parseAmount.mockResolvedValue({
        amount: 1000,
        isNegative: false,
        format: 'number',
        confidence: 0.99,
      });

      const result = await service.normalizeTransactions(transactions, { defaultCurrency: 'EUR' });

      expect(result[0].currency).toBe('EUR');
    });
  });

  describe('getNormalizationStatistics', () => {
    it('returns correct totalTransactions count', async () => {
      const transactions = [makeTransaction(), makeTransaction()];
      const normalized = await service.normalizeTransactions(transactions);

      const stats = service.getNormalizationStatistics(normalized);

      expect(stats.totalTransactions).toBe(2);
    });

    it('returns averageConfidence between 0 and 1', async () => {
      const normalized = await service.normalizeTransactions([makeTransaction()]);

      const stats = service.getNormalizationStatistics(normalized);

      expect(stats.averageConfidence).toBeGreaterThanOrEqual(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('returns successRate as percentage', async () => {
      const normalized = await service.normalizeTransactions([makeTransaction()]);

      const stats = service.getNormalizationStatistics(normalized);

      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(100);
    });

    it('returns commonIssues array', async () => {
      const normalized = await service.normalizeTransactions([makeTransaction()]);

      const stats = service.getNormalizationStatistics(normalized);

      expect(stats.commonIssues).toBeInstanceOf(Array);
    });

    it('counts transactions with confidence > 0.7 as successful', async () => {
      // All mocks return high confidence values
      const normalized = await service.normalizeTransactions([
        makeTransaction(),
        makeTransaction(),
      ]);

      const stats = service.getNormalizationStatistics(normalized);

      expect(stats.successRate).toBeGreaterThan(0);
    });
  });
});
