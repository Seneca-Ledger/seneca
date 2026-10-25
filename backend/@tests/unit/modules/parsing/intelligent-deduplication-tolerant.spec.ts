import type { Mocked } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { Transaction, TransactionType } from '../../../../src/entities/transaction.entity';
import { ImportConfigService } from '../../../../src/modules/import/config/import.config';
import { ParsedTransaction } from '../../../../src/modules/parsing/interfaces/parsed-statement.interface';
import {
  ConflictAction,
  IntelligentDeduplicationService,
} from '../../../../src/modules/parsing/services/intelligent-deduplication.service';

describe('IntelligentDeduplicationService - Tolerant Matching', () => {
  let service: IntelligentDeduplicationService;
  let mockImportConfigService: Mocked<ImportConfigService>;

  beforeEach(async () => {
    // Create mock ImportConfigService with default values
    mockImportConfigService = {
      getDedupDateToleranceDays: vi.fn().mockReturnValue(3),
      getDedupAmountTolerancePercent: vi.fn().mockReturnValue(2),
      getDedupTextSimilarityThreshold: vi.fn().mockReturnValue(0.75),
      getConflictAutoResolveThreshold: vi.fn().mockReturnValue(0.95),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntelligentDeduplicationService,
        {
          provide: ImportConfigService,
          useValue: mockImportConfigService,
        },
      ],
    }).compile();

    service = module.get<IntelligentDeduplicationService>(IntelligentDeduplicationService);
  });

  describe('applyTolerantRules', () => {
    describe('exact matches', () => {
      it('should detect exact match with confidence 1.0', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.matchType).toBe('exact');
        expect(result.details.dateDiff).toBe(0);
        expect(result.details.amountDiff).toBe(0);
        expect(result.details.textSimilarity).toBe(1.0);
      });
    });

    describe('fuzzy date matching', () => {
      it('should match transactions within date tolerance (1 day)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-16'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('fuzzy_date');
        expect(result.details.dateDiff).toBe(1);
        expect(result.confidence).toBeGreaterThan(0.9);
        expect(result.confidence).toBeLessThan(1.0);
      });

      it('should match transactions at max date tolerance (3 days)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-18'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('fuzzy_date');
        expect(result.details.dateDiff).toBe(3);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThan(0.9);
      });

      it('should NOT match transactions beyond date tolerance (4 days)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-19'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(false);
        expect(result.details.dateDiff).toBe(4);
      });
    });

    describe('fuzzy amount matching', () => {
      it('should match transactions within amount tolerance (1%)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1010, // 1% difference
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('fuzzy_amount');
        expect(result.details.amountDiff).toBeCloseTo(0.99, 1);
        // Confidence formula: date(30%) + amount(40%) + text(30%)
        // date=1.0, amount=0.505, text=1.0 => 0.3 + 0.202 + 0.3 = 0.802
        expect(result.confidence).toBeGreaterThan(0.75);
        expect(result.confidence).toBeLessThan(0.85);
      });

      it('should match transactions at max amount tolerance (2%)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1020, // 2% difference
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('fuzzy_amount');
        expect(result.details.amountDiff).toBeCloseTo(1.96, 1);
        expect(result.confidence).toBeGreaterThan(0);
      });

      it('should NOT match transactions beyond amount tolerance (3%)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1030, // 3% difference
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(false);
        expect(result.details.amountDiff).toBeGreaterThan(2);
      });

      it('should handle credit vs debit amounts correctly', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          credit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          credit: 1010,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('fuzzy_amount');
      });
    });

    describe('fuzzy text matching', () => {
      it('should match similar counterparty names (typo correction)', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corporation',
          paymentPurpose: 'Invoice payment',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice payment',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('fuzzy_text');
        expect(result.details.textSimilarity).toBeGreaterThan(0.75);
        expect(result.details.textSimilarity).toBeLessThan(1.0);
      });

      it('should match similar payment purposes', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Payment for services rendered in December 2024',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Payment for services Dec 2024',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.details.textSimilarity).toBeGreaterThan(0);
      });

      it('should NOT match very different text below threshold', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Company A',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Completely Different Corp',
          paymentPurpose: 'Purchase order #99999',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(false);
        expect(result.details.textSimilarity).toBeLessThan(0.75);
      });
    });

    describe('combined fuzzy matching', () => {
      it('should handle multiple fuzzy dimensions', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corporation Inc',
          paymentPurpose: 'Invoice payment for services',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-16'), // 1 day diff
          counterpartyName: 'Acme Corporation Incorporated', // similar text
          paymentPurpose: 'Invoice payment for service',
          debit: 1010, // 1% diff
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.matchType).toBe('combined');
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.confidence).toBeLessThan(1.0);
      });
    });

    describe('edge cases', () => {
      it('should handle zero amounts correctly', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Zero amount test',
          debit: 0,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Zero amount test',
          debit: 0,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.details.amountDiff).toBe(0);
      });

      it('should handle empty strings in text fields', () => {
        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: '',
          paymentPurpose: '',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: '',
          paymentPurpose: '',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.details.textSimilarity).toBe(1.0);
      });

      it('should work with Transaction entity (not just ParsedTransaction)', () => {
        const parsedTx: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const entityTx: Partial<Transaction> = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          amount: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(parsedTx, entityTx as Transaction);

        expect(result.isMatch).toBe(true);
        expect(result.confidence).toBe(1.0);
      });
    });

    describe('configuration-driven behavior', () => {
      it('should respect custom date tolerance', () => {
        mockImportConfigService.getDedupDateToleranceDays.mockReturnValue(5);

        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-20'), // 5 days
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
        expect(result.details.dateDiff).toBe(5);
      });

      it('should respect custom amount tolerance', () => {
        mockImportConfigService.getDedupAmountTolerancePercent.mockReturnValue(5);

        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1050, // 5% difference
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        expect(result.isMatch).toBe(true);
      });

      it('should respect custom text similarity threshold', () => {
        mockImportConfigService.getDedupTextSimilarityThreshold.mockReturnValue(0.5);

        const tx1: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corporation Limited Partnership',
          paymentPurpose: 'Invoice payment for consulting services',
          debit: 1000,
          currency: 'KZT',
        };

        const tx2: ParsedTransaction = {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp Ltd Partnership',
          paymentPurpose: 'Invoice payment for services',
          debit: 1000,
          currency: 'KZT',
        };

        const result = service.applyTolerantRules(tx1, tx2);

        // With lower threshold (0.5), this should match
        expect(result.isMatch).toBe(true);
        expect(result.details.textSimilarity).toBeGreaterThan(0.5);
      });
    });
  });

  describe('detectConflicts', () => {
    it('should detect conflicts between new and existing transactions', async () => {
      const newTransactions: ParsedTransaction[] = [
        {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        },
        {
          transactionDate: new Date('2024-01-16'),
          counterpartyName: 'Beta Inc',
          paymentPurpose: 'Services',
          credit: 500,
          currency: 'KZT',
        },
      ];

      const existingTransactions: Transaction[] = [
        {
          id: 'tx-1',
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          amount: 1000,
          currency: 'KZT',
          workspaceId: 'ws-1',
        } as Transaction,
      ];

      const conflicts = await service.detectConflicts(newTransactions, existingTransactions);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].newTransaction).toEqual(newTransactions[0]);
      expect(conflicts[0].existingTransaction).toEqual(existingTransactions[0]);
      expect(conflicts[0].confidence).toBe(1.0);
      expect(conflicts[0].matchType).toBe('exact');
      expect(conflicts[0].recommendedAction).toBe(ConflictAction.KEEP_EXISTING);
    });

    it('should not create duplicate conflicts for same new transaction', async () => {
      const newTransactions: ParsedTransaction[] = [
        {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        },
      ];

      const existingTransactions: Transaction[] = [
        {
          id: 'tx-1',
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          amount: 1000,
          currency: 'KZT',
          workspaceId: 'ws-1',
        } as Transaction,
        {
          id: 'tx-2',
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          amount: 1000,
          currency: 'KZT',
          workspaceId: 'ws-1',
        } as Transaction,
      ];

      const conflicts = await service.detectConflicts(newTransactions, existingTransactions);

      // Should only match the first existing transaction, then break
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].existingTransaction.id).toBe('tx-1');
    });

    it('should return empty array when no conflicts found', async () => {
      const newTransactions: ParsedTransaction[] = [
        {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        },
      ];

      const existingTransactions: Transaction[] = [
        {
          id: 'tx-1',
          transactionDate: new Date('2024-02-15'), // Different date beyond tolerance
          counterpartyName: 'Different Corp',
          paymentPurpose: 'Different purpose',
          debit: 2000,
          amount: 2000,
          currency: 'KZT',
          workspaceId: 'ws-1',
        } as Transaction,
      ];

      const conflicts = await service.detectConflicts(newTransactions, existingTransactions);

      expect(conflicts).toHaveLength(0);
    });

    it('should handle fuzzy matches correctly', async () => {
      const newTransactions: ParsedTransaction[] = [
        {
          transactionDate: new Date('2024-01-16'), // 1 day later
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1010, // 1% difference
          currency: 'KZT',
        },
      ];

      const existingTransactions: Transaction[] = [
        {
          id: 'tx-1',
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          amount: 1000,
          currency: 'KZT',
          workspaceId: 'ws-1',
        } as Transaction,
      ];

      const conflicts = await service.detectConflicts(newTransactions, existingTransactions);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].matchType).toBe('combined');
      expect(conflicts[0].confidence).toBeLessThan(1.0);
      expect(conflicts[0].details.dateDiff).toBe(1);
      expect(conflicts[0].details.amountDiff).toBeGreaterThan(0);
    });

    it('should recommend appropriate actions based on match type', async () => {
      // Test fuzzy_date -> REPLACE
      mockImportConfigService.getConflictAutoResolveThreshold.mockReturnValue(0.9);

      const newTransactions: ParsedTransaction[] = [
        {
          transactionDate: new Date('2024-01-16'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        },
      ];

      const existingTransactions: Transaction[] = [
        {
          id: 'tx-1',
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          amount: 1000,
          currency: 'KZT',
          workspaceId: 'ws-1',
        } as Transaction,
      ];

      const conflicts = await service.detectConflicts(newTransactions, existingTransactions);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].matchType).toBe('fuzzy_date');
      expect(conflicts[0].recommendedAction).toBe(ConflictAction.REPLACE);
    });

    it('should handle empty arrays gracefully', async () => {
      const conflicts1 = await service.detectConflicts([], []);
      expect(conflicts1).toHaveLength(0);

      const newTransactions: ParsedTransaction[] = [
        {
          transactionDate: new Date('2024-01-15'),
          counterpartyName: 'Acme Corp',
          paymentPurpose: 'Invoice #12345',
          debit: 1000,
          currency: 'KZT',
        },
      ];

      const conflicts2 = await service.detectConflicts(newTransactions, []);
      expect(conflicts2).toHaveLength(0);

      const conflicts3 = await service.detectConflicts(
        [],
        [
          {
            id: 'tx-1',
            transactionDate: new Date('2024-01-15'),
            counterpartyName: 'Acme Corp',
            paymentPurpose: 'Invoice #12345',
            debit: 1000,
            amount: 1000,
            currency: 'KZT',
            workspaceId: 'ws-1',
          } as Transaction,
        ],
      );
      expect(conflicts3).toHaveLength(0);
    });
  });

  describe('recommended actions logic', () => {
    it('should recommend KEEP_EXISTING for exact matches', () => {
      const matchResult = {
        isMatch: true,
        confidence: 1.0,
        matchType: 'exact' as const,
        details: {
          dateDiff: 0,
          amountDiff: 0,
          textSimilarity: 1.0,
        },
      };

      const action = (service as any).determineRecommendedAction(matchResult);
      expect(action).toBe(ConflictAction.KEEP_EXISTING);
    });

    it('should recommend REPLACE for high-confidence fuzzy_date', () => {
      mockImportConfigService.getConflictAutoResolveThreshold.mockReturnValue(0.9);

      const matchResult = {
        isMatch: true,
        confidence: 0.95,
        matchType: 'fuzzy_date' as const,
        details: {
          dateDiff: 1,
          amountDiff: 0,
          textSimilarity: 1.0,
        },
      };

      const action = (service as any).determineRecommendedAction(matchResult);
      expect(action).toBe(ConflictAction.REPLACE);
    });

    it('should recommend MERGE for high-confidence fuzzy_amount', () => {
      mockImportConfigService.getConflictAutoResolveThreshold.mockReturnValue(0.9);

      const matchResult = {
        isMatch: true,
        confidence: 0.95,
        matchType: 'fuzzy_amount' as const,
        details: {
          dateDiff: 0,
          amountDiff: 1,
          textSimilarity: 1.0,
        },
      };

      const action = (service as any).determineRecommendedAction(matchResult);
      expect(action).toBe(ConflictAction.MERGE);
    });

    it('should recommend KEEP_EXISTING for high-confidence fuzzy_text', () => {
      mockImportConfigService.getConflictAutoResolveThreshold.mockReturnValue(0.9);

      const matchResult = {
        isMatch: true,
        confidence: 0.95,
        matchType: 'fuzzy_text' as const,
        details: {
          dateDiff: 0,
          amountDiff: 0,
          textSimilarity: 0.85,
        },
      };

      const action = (service as any).determineRecommendedAction(matchResult);
      expect(action).toBe(ConflictAction.KEEP_EXISTING);
    });

    it('should recommend MANUAL_REVIEW for high-confidence combined fuzzy', () => {
      mockImportConfigService.getConflictAutoResolveThreshold.mockReturnValue(0.9);

      const matchResult = {
        isMatch: true,
        confidence: 0.95,
        matchType: 'combined' as const,
        details: {
          dateDiff: 1,
          amountDiff: 1,
          textSimilarity: 0.85,
        },
      };

      const action = (service as any).determineRecommendedAction(matchResult);
      expect(action).toBe(ConflictAction.MANUAL_REVIEW);
    });

    it('should recommend MANUAL_REVIEW for medium confidence', () => {
      const matchResult = {
        isMatch: true,
        confidence: 0.8,
        matchType: 'fuzzy_date' as const,
        details: {
          dateDiff: 2,
          amountDiff: 0,
          textSimilarity: 1.0,
        },
      };

      const action = (service as any).determineRecommendedAction(matchResult);
      expect(action).toBe(ConflictAction.MANUAL_REVIEW);
    });
  });
});
