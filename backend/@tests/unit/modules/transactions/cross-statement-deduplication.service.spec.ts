import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../../../src/entities/transaction.entity';
import { CrossStatementDeduplicationService } from '../../../../src/modules/transactions/services/cross-statement-deduplication.service';

describe('CrossStatementDeduplicationService', () => {
  let service: CrossStatementDeduplicationService;
  let repository: Repository<Transaction>;

  const mockRepository = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOneBy: jest.fn(),
    update: jest.fn(),
  };

  const createMockTransaction = (
    id: string,
    date: Date,
    amount: number,
    counterparty: string,
    purpose: string,
    statementId: string,
  ): Partial<Transaction> => ({
    id,
    transactionDate: date,
    debit: amount > 0 ? amount : null,
    credit: amount < 0 ? Math.abs(amount) : null,
    amount,
    counterpartyName: counterparty,
    paymentPurpose: purpose,
    statementId,
    workspaceId: 'workspace-123',
    isDuplicate: false,
    currency: 'KZT',
    transactionType: amount > 0 ? ('expense' as any) : ('income' as any),
    isVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossStatementDeduplicationService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<CrossStatementDeduplicationService>(CrossStatementDeduplicationService);
    repository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findDuplicates', () => {
    it('should find exact duplicates with same date, amount, and counterparty', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        createMockTransaction('tx1', date, 10000, 'Company A', 'Payment for services', 'stmt1'),
        createMockTransaction('tx2', date, 10000, 'Company A', 'Payment for services', 'stmt2'),
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1)); // To check
      mockRepository.find.mockResolvedValueOnce(transactions); // Potential duplicates

      const groups = await service.findDuplicates('workspace-123');

      expect(groups.length).toBe(1);
      expect(groups[0].master.id).toBe('tx1');
      expect(groups[0].duplicates.length).toBe(1);
      expect(groups[0].duplicates[0].transaction.id).toBe('tx2');
      expect(groups[0].duplicates[0].similarity).toBeGreaterThan(0.9);
      expect(groups[0].duplicates[0].matchType).toBe('exact');
    });

    it('does not flag a refund as a duplicate of the original charge with the same amount/counterparty/date', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        createMockTransaction('charge', date, 15000, 'Magnum Cash&Carry', 'Purchase, receipt #4521', 'stmt1'),
        createMockTransaction('refund', date, -15000, 'Magnum Cash&Carry', 'Refund, receipt #4521', 'stmt1'),
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups).toEqual([]);
    });

    it('does not treat same-amount transactions in different currencies as duplicates', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        { ...createMockTransaction('tx1', date, 10000, 'Company A', 'Payment', 'stmt1'), currency: 'KZT' },
        { ...createMockTransaction('tx2', date, 10000, 'Company A', 'Payment', 'stmt2'), currency: 'USD' },
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups).toEqual([]);
    });

    it('should not treat two parts of the same split as duplicates of each other', async () => {
      const date = new Date('2024-01-15');
      // An even split produces rows identical in date, amount, counterparty and
      // purpose — otherwise an exact (1.0) match.
      const transactions = [
        {
          ...createMockTransaction('tx1', date, 6000, 'Magnum', 'Groceries', 'stmt1'),
          splitGroupId: 'grp-1',
          splitIndex: 0,
        },
        {
          ...createMockTransaction('tx2', date, 6000, 'Magnum', 'Groceries', 'stmt1'),
          splitGroupId: 'grp-1',
          splitIndex: 1,
        },
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups).toEqual([]);
    });

    it('should still flag a split part against an unrelated identical transaction', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        {
          ...createMockTransaction('tx1', date, 6000, 'Magnum', 'Groceries', 'stmt1'),
          splitGroupId: 'grp-1',
          splitIndex: 0,
        },
        createMockTransaction('tx2', date, 6000, 'Magnum', 'Groceries', 'stmt2'),
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups.length).toBe(1);
      expect(groups[0].duplicates[0].transaction.id).toBe('tx2');
    });

    it('should find fuzzy duplicates with similar counterparty names', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        createMockTransaction('tx1', date, 10000, 'Company A Ltd', 'Payment', 'stmt1'),
        createMockTransaction('tx2', date, 10000, 'Company A Limited', 'Payment', 'stmt2'),
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups.length).toBe(1);
      expect(groups[0].duplicates[0].similarity).toBeGreaterThan(0.85);
    });

    it('should handle date tolerance (±7 days)', async () => {
      const baseDate = new Date('2024-01-15');
      const nearDate = new Date('2024-01-17'); // 2 days later
      const farDate = new Date('2024-01-25'); // 10 days later

      const transactions = [
        createMockTransaction('tx1', baseDate, 10000, 'Company A', 'Payment', 'stmt1'),
        createMockTransaction('tx2', nearDate, 10000, 'Company A', 'Payment', 'stmt2'),
        createMockTransaction('tx3', farDate, 10000, 'Company A', 'Payment', 'stmt3'),
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups.length).toBe(1);
      expect(groups[0].duplicates.some(d => d.transaction.id === 'tx2')).toBe(true);
      // tx3 should not be included (too far apart)
    });

    it('should respect threshold parameter', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        createMockTransaction('tx1', date, 10000, 'Company A', 'Payment for services', 'stmt1'),
        createMockTransaction('tx2', date, 10000, 'Company B', 'Different purpose', 'stmt2'),
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      // With high threshold, should not match
      const groupsHighThreshold = await service.findDuplicates('workspace-123', undefined, 0.95);
      expect(groupsHighThreshold.length).toBe(0);

      // With low threshold, might match
      const groupsLowThreshold = await service.findDuplicates('workspace-123', undefined, 0.5);
      // Result depends on similarity calculation
    });

    it('should filter by statement ID when provided', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        createMockTransaction('tx1', date, 10000, 'Company A', 'Payment', 'stmt1'),
      ];

      mockRepository.find
        .mockResolvedValueOnce(transactions) // Specific statement
        .mockResolvedValueOnce(transactions); // All potential duplicates

      await service.findDuplicates('workspace-123', 'stmt1');

      // Verify first call filters by statement
      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            statementId: 'stmt1',
          }),
        }),
      );
    });

    it('should not match transactions already marked as duplicates', async () => {
      const date = new Date('2024-01-15');
      const transactions = [
        createMockTransaction('tx1', date, 10000, 'Company A', 'Payment', 'stmt1'),
        {
          ...createMockTransaction('tx2', date, 10000, 'Company A', 'Payment', 'stmt2'),
          isDuplicate: true,
        },
      ];

      mockRepository.find.mockResolvedValueOnce(transactions.slice(0, 1));
      mockRepository.find.mockResolvedValueOnce(transactions);

      const groups = await service.findDuplicates('workspace-123');

      // tx2 should be excluded because isDuplicate = true
      expect(groups.length).toBe(0);
    });

    it('should return empty array when no duplicates found', async () => {
      mockRepository.find.mockResolvedValueOnce([]);

      const groups = await service.findDuplicates('workspace-123');

      expect(groups).toEqual([]);
    });
  });

  describe('markDuplicates', () => {
    it('should mark transactions as duplicates with correct metadata', async () => {
      const date = new Date('2024-01-15');
      const master = createMockTransaction('master', date, 10000, 'Company A', 'Payment', 'stmt1');
      const duplicate1 = createMockTransaction(
        'dup1',
        date,
        10000,
        'Company A',
        'Payment',
        'stmt2',
      );
      const duplicate2 = createMockTransaction(
        'dup2',
        date,
        10000,
        'Company A',
        'Payment',
        'stmt3',
      );

      const groups = [
        {
          master: master as Transaction,
          duplicates: [
            {
              transaction: duplicate1 as Transaction,
              similarity: 0.95,
              matchType: 'exact' as const,
              matchedFields: [],
            },
            {
              transaction: duplicate2 as Transaction,
              similarity: 0.92,
              matchType: 'fuzzy' as const,
              matchedFields: [],
            },
          ],
          confidence: 0.935,
        },
      ];

      mockRepository.update.mockResolvedValue({ affected: 1 });

      const markedCount = await service.markDuplicates(groups);

      expect(markedCount).toBe(2);
      expect(mockRepository.update).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith('dup1', {
        isDuplicate: true,
        duplicateOfId: 'master',
        duplicateConfidence: 0.95,
        duplicateMatchType: 'exact',
      });
      expect(mockRepository.update).toHaveBeenCalledWith('dup2', {
        isDuplicate: true,
        duplicateOfId: 'master',
        duplicateConfidence: 0.92,
        duplicateMatchType: 'fuzzy',
      });
    });
  });

  describe('mergeDuplicates', () => {
    it('should merge duplicates into master transaction', async () => {
      const transactions = [
        createMockTransaction('master', new Date(), 10000, 'Company A', 'Payment', 'stmt1'),
        createMockTransaction('dup1', new Date(), 10000, 'Company A', 'Payment', 'stmt2'),
      ];

      mockRepository.findBy.mockResolvedValue(transactions);
      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.mergeDuplicates(['master', 'dup1'], 'workspace1');

      expect(result.id).toBe('master');
      expect(mockRepository.findBy).toHaveBeenCalledWith({
        id: expect.anything(),
        workspaceId: 'workspace1',
      });
      expect(mockRepository.update).toHaveBeenCalledWith('dup1', {
        isDuplicate: true,
        duplicateOfId: 'master',
        duplicateConfidence: 1.0,
        duplicateMatchType: 'manual',
      });
    });

    it('should throw error if less than 2 transactions provided', async () => {
      await expect(service.mergeDuplicates(['tx1'], 'workspace1')).rejects.toThrow(
        'At least 2 transactions required for merge',
      );
    });

    it('should throw error if transactions not found', async () => {
      mockRepository.findBy.mockResolvedValue([]);

      await expect(service.mergeDuplicates(['tx1', 'tx2'], 'workspace1')).rejects.toThrow(
        'One or more transactions not found',
      );
    });

    it("does not merge another workspace's transaction even if its id is guessed", async () => {
      // Only the caller's own transaction ('master') belongs to 'workspace1';
      // 'foreign' belongs to another workspace and must not be returned by a
      // workspace-scoped findBy, so the length check below should fail closed.
      mockRepository.findBy.mockResolvedValue([
        createMockTransaction('master', new Date(), 10000, 'Company A', 'Payment', 'stmt1'),
      ]);

      await expect(service.mergeDuplicates(['master', 'foreign'], 'workspace1')).rejects.toThrow(
        'One or more transactions not found',
      );
    });
  });

  describe('unmarkDuplicate', () => {
    it('should unmark transaction as duplicate', async () => {
      const transaction = {
        ...createMockTransaction('tx1', new Date(), 10000, 'Company A', 'Payment', 'stmt1'),
        isDuplicate: false,
        duplicateOfId: null,
      };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOneBy.mockResolvedValue(transaction);

      const result = await service.unmarkDuplicate('tx1', 'workspace1');

      expect(mockRepository.findOneBy).toHaveBeenCalledWith({
        id: 'tx1',
        workspaceId: 'workspace1',
      });
      expect(mockRepository.update).toHaveBeenCalledWith('tx1', {
        isDuplicate: false,
        duplicateOfId: null,
        duplicateConfidence: null,
        duplicateMatchType: null,
      });
      expect(result.isDuplicate).toBe(false);
    });

    it('should throw error if transaction not found', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.unmarkDuplicate('nonexistent', 'workspace1')).rejects.toThrow(
        'Transaction not found',
      );
    });

    it("does not unmark another workspace's transaction even if its id is guessed", async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      await expect(service.unmarkDuplicate('foreign-tx', 'workspace1')).rejects.toThrow(
        'Transaction not found',
      );
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });
});
