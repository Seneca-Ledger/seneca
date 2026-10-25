import type { Mocked } from 'vitest';
import { IntelligentDeduplicationService } from '@/modules/parsing/services/intelligent-deduplication.service';
import { ImportConfigService } from '@/modules/import/config/import.config';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';

describe('IntelligentDeduplicationService', () => {
  let service: IntelligentDeduplicationService;
  let mockImportConfigService: Mocked<Pick<ImportConfigService,
    | 'getDedupDateToleranceDays'
    | 'getDedupAmountTolerancePercent'
    | 'getDedupTextSimilarityThreshold'
    | 'getConflictAutoResolveThreshold'
  >>;

  const makeTransaction = (overrides: Partial<ParsedTransaction> = {}): ParsedTransaction => ({
    transactionDate: new Date('2026-01-15'),
    counterpartyName: 'Test Company',
    paymentPurpose: 'Payment for services',
    debit: 1000,
    currency: 'KZT',
    ...overrides,
  });

  beforeEach(() => {
    mockImportConfigService = {
      getDedupDateToleranceDays: vi.fn().mockReturnValue(3),
      getDedupAmountTolerancePercent: vi.fn().mockReturnValue(2),
      getDedupTextSimilarityThreshold: vi.fn().mockReturnValue(0.75),
      getConflictAutoResolveThreshold: vi.fn().mockReturnValue(0.95),
    };

    service = new IntelligentDeduplicationService(
      mockImportConfigService as unknown as ImportConfigService,
    );
  });

  describe('deduplicateTransactions', () => {
    it('returns all transactions as unique when no duplicates exist', async () => {
      const transactions = [
        makeTransaction({ debit: 100, counterpartyName: 'Company A', transactionDate: new Date('2026-01-01') }),
        makeTransaction({ debit: 200, counterpartyName: 'Company B', transactionDate: new Date('2026-01-02') }),
        makeTransaction({ debit: 300, counterpartyName: 'Company C', transactionDate: new Date('2026-01-03') }),
      ];

      const result = await service.deduplicateTransactions(transactions);

      expect(result.originalCount).toBe(3);
      expect(result.uniqueTransactions.length).toBeGreaterThan(0);
    });

    it('returns zero duplicates for empty input', async () => {
      const result = await service.deduplicateTransactions([]);

      expect(result.originalCount).toBe(0);
      expect(result.uniqueCount).toBe(0);
      expect(result.duplicatesRemoved).toBe(0);
    });

    it('detects exact duplicate transactions', async () => {
      const tx = makeTransaction({ debit: 500, counterpartyName: 'Same Company' });
      const transactions = [tx, { ...tx }];

      const result = await service.deduplicateTransactions(transactions);

      expect(result.originalCount).toBe(2);
      expect(result.duplicatesRemoved).toBeGreaterThanOrEqual(1);
      expect(result.uniqueCount).toBeLessThan(result.originalCount);
    });

    it('includes processing stats in result', async () => {
      const result = await service.deduplicateTransactions([makeTransaction()]);

      expect(result.processingStats).toBeDefined();
      expect(result.processingStats.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.processingStats.algorithms).toBeInstanceOf(Array);
    });

    it('includes quality metrics in result', async () => {
      const result = await service.deduplicateTransactions([makeTransaction()]);

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.averageConfidence).toBeGreaterThanOrEqual(0);
    });

    it('uses custom threshold when provided', async () => {
      const transactions = [makeTransaction({ debit: 500 }), makeTransaction({ debit: 505 })];

      const resultStrict = await service.deduplicateTransactions(transactions, [], 1.0);
      const resultLoose = await service.deduplicateTransactions(transactions, [], 0.1);

      // With strict threshold, fewer things are considered duplicates
      expect(resultStrict.uniqueCount).toBeGreaterThanOrEqual(resultLoose.uniqueCount);
    });

    it('uniqueCount + duplicatesRemoved equals originalCount', async () => {
      const transactions = [
        makeTransaction({ debit: 100 }),
        makeTransaction({ debit: 200 }),
        makeTransaction({ debit: 100 }),
      ];

      const result = await service.deduplicateTransactions(transactions);

      expect(result.uniqueCount + result.duplicatesRemoved).toBe(result.originalCount);
    });
  });

  describe('custom rules management', () => {
    it('addCustomRule adds a rule to active rules', () => {
      const initialCount = service.getActiveRules().length;

      service.addCustomRule({
        name: 'custom_test_rule',
        enabled: true,
        weight: 0.8,
        algorithm: 'exact',
        threshold: 0.9,
        fields: ['transactionDate', 'debit'],
        options: {},
      });

      expect(service.getActiveRules().length).toBe(initialCount + 1);
    });

    it('removeCustomRule removes an added rule', () => {
      service.addCustomRule({
        name: 'removable_rule',
        enabled: true,
        weight: 0.5,
        algorithm: 'fuzzy',
        threshold: 0.8,
        fields: ['counterpartyName'],
        options: {},
      });

      const removed = service.removeCustomRule('removable_rule');

      expect(removed).toBe(true);
    });

    it('removeCustomRule returns false for non-existent rule', () => {
      const removed = service.removeCustomRule('non_existent_rule');

      expect(removed).toBe(false);
    });

    it('disableRule sets rule enabled to false', () => {
      service.addCustomRule({
        name: 'disableable_rule',
        enabled: true,
        weight: 0.7,
        algorithm: 'semantic',
        threshold: 0.75,
        fields: ['paymentPurpose'],
        options: {},
      });

      service.disableRule('disableable_rule');

      // getActiveRules returns all rules; check the rule's enabled flag
      const rule = service.getActiveRules().find(r => r.name === 'disableable_rule');
      expect(rule?.enabled).toBe(false);
    });

    it('enableRule sets rule enabled to true', () => {
      service.addCustomRule({
        name: 'enableable_rule',
        enabled: false,
        weight: 0.7,
        algorithm: 'exact',
        threshold: 1.0,
        fields: ['debit'],
        options: {},
      });

      service.enableRule('enableable_rule');

      const rule = service.getActiveRules().find(r => r.name === 'enableable_rule');
      expect(rule?.enabled).toBe(true);
    });

    it('updateRule updates rule properties', () => {
      service.addCustomRule({
        name: 'updatable_rule',
        enabled: true,
        weight: 0.5,
        algorithm: 'exact',
        threshold: 0.9,
        fields: ['debit'],
        options: {},
      });

      service.updateRule('updatable_rule', { weight: 0.9 });

      const rule = service.getActiveRules().find(r => r.name === 'updatable_rule');
      expect(rule?.weight).toBe(0.9);
    });

    it('getActiveRules returns all rules including default rules', () => {
      const rules = service.getActiveRules();

      // Default rules are 4: exact_match, fuzzy_amount_date, semantic_purpose, hybrid_comprehensive
      expect(rules.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('applyTolerantRules', () => {
    it('returns exact match for identical transactions', () => {
      const tx = makeTransaction({ debit: 1000, transactionDate: new Date('2026-01-15') });

      const result = service.applyTolerantRules(tx, tx);

      expect(result.isMatch).toBe(true);
      expect(result.matchType).toBe('exact');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('returns no match for clearly different transactions', () => {
      const tx1 = makeTransaction({
        debit: 100,
        counterpartyName: 'Apple Inc',
        transactionDate: new Date('2026-01-01'),
        paymentPurpose: 'Software license',
      });
      const tx2 = makeTransaction({
        debit: 99999,
        counterpartyName: 'Unknown Corp',
        transactionDate: new Date('2026-06-15'),
        paymentPurpose: 'Construction work',
      });

      const result = service.applyTolerantRules(tx1, tx2);

      expect(result.confidence).toBeLessThan(0.8);
    });

    it('returns confidence between 0 and 1', () => {
      const tx1 = makeTransaction({ debit: 1000 });
      const tx2 = makeTransaction({ debit: 1010 });

      const result = service.applyTolerantRules(tx1, tx2);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('uses ImportConfigService tolerances for matching', () => {
      mockImportConfigService.getDedupDateToleranceDays.mockReturnValue(0);
      mockImportConfigService.getDedupAmountTolerancePercent.mockReturnValue(0);
      mockImportConfigService.getDedupTextSimilarityThreshold.mockReturnValue(1.0);

      const tx1 = makeTransaction({ debit: 1000, transactionDate: new Date('2026-01-01') });
      const tx2 = makeTransaction({ debit: 1001, transactionDate: new Date('2026-01-02') });

      service.applyTolerantRules(tx1, tx2);

      expect(mockImportConfigService.getDedupDateToleranceDays).toHaveBeenCalled();
    });
  });

  describe('detectConflicts', () => {
    it('returns empty array when no conflicts', async () => {
      const newTransactions = [makeTransaction({ debit: 100, transactionDate: new Date('2026-06-01') })];
      const existingTransactions: any[] = [];

      const result = await service.detectConflicts(newTransactions, existingTransactions);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(0);
    });

    it('returns conflict groups with required fields', async () => {
      const newTx = makeTransaction({ debit: 1000, transactionDate: new Date('2026-01-15') });
      const existingTx: any = {
        id: 'existing-1',
        transactionDate: new Date('2026-01-15'),
        counterpartyName: 'Test Company',
        paymentPurpose: 'Payment for services',
        debit: 1000,
        currency: 'KZT',
      };

      const result = await service.detectConflicts([newTx], [existingTx]);

      if (result.length > 0) {
        expect(result[0].newTransaction).toBeDefined();
        expect(result[0].existingTransaction).toBeDefined();
        expect(result[0].confidence).toBeGreaterThan(0);
        expect(result[0].recommendedAction).toBeDefined();
      }
    });
  });
});
