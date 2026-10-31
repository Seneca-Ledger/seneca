import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Transaction, TransactionType } from '../../../../src/entities/transaction.entity';
import { TransactionFingerprintService } from '../../../../src/modules/transactions/services/transaction-fingerprint.service';

describe('TransactionFingerprintService', () => {
  let service: TransactionFingerprintService;
  let repository: Repository<Transaction>;

  const mockRepository = {
    findOne: vi.fn(),
    find: vi.fn(),
    update: vi.fn(),
    save: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const createMockTransaction = (
    id: string,
    date: Date,
    amount: number,
    counterparty: string,
    workspaceId = 'workspace-123',
    currency = 'KZT',
  ): Partial<Transaction> => ({
    id,
    transactionDate: date,
    debit: amount > 0 ? amount : null,
    credit: amount < 0 ? Math.abs(amount) : null,
    amount,
    counterpartyName: counterparty,
    paymentPurpose: 'Payment',
    workspaceId,
    currency,
    transactionType: amount > 0 ? TransactionType.EXPENSE : TransactionType.INCOME,
    fingerprint: null,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionFingerprintService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TransactionFingerprintService>(TransactionFingerprintService);
    repository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFingerprint', () => {
    it('ignores the payment type', () => {
      const base = createMockTransaction('tx-a', new Date('2026-01-15'), 100, 'ACME Store');
      const input = (paymentType: Transaction['paymentType']) => ({
        ...base,
        paymentType,
        workspaceId: 'workspace-123',
        transactionDate: new Date('2026-01-15'),
        amount: 100,
        currency: 'KZT',
        counterpartyName: 'ACME Store',
      });

      expect(service.generateFingerprint(input('card'), 'ACC-1')).toBe(
        service.generateFingerprint(input(null), 'ACC-1'),
      );
    });

    it('should generate a 32-character hex fingerprint', () => {
      const transaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const fingerprint = service.generateFingerprint(transaction, 'KZ123456789012345678');

      expect(fingerprint).toHaveLength(32);
      expect(fingerprint).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate same fingerprint for identical transactions', () => {
      const transaction1 = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const transaction2 = createMockTransaction(
        'tx2',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const fingerprint1 = service.generateFingerprint(transaction1, 'KZ123456789012345678');
      const fingerprint2 = service.generateFingerprint(transaction2, 'KZ123456789012345678');

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different amounts', () => {
      const transaction1 = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const transaction2 = createMockTransaction(
        'tx2',
        new Date('2024-01-15'),
        20000,
        'Company A',
      ) as any;

      const fingerprint1 = service.generateFingerprint(transaction1, 'KZ123456789012345678');
      const fingerprint2 = service.generateFingerprint(transaction2, 'KZ123456789012345678');

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different dates', () => {
      const transaction1 = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const transaction2 = createMockTransaction(
        'tx2',
        new Date('2024-01-16'),
        10000,
        'Company A',
      ) as any;

      const fingerprint1 = service.generateFingerprint(transaction1, 'KZ123456789012345678');
      const fingerprint2 = service.generateFingerprint(transaction2, 'KZ123456789012345678');

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different merchants', () => {
      const transaction1 = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const transaction2 = createMockTransaction(
        'tx2',
        new Date('2024-01-15'),
        10000,
        'Company B',
      ) as any;

      const fingerprint1 = service.generateFingerprint(transaction1, 'KZ123456789012345678');
      const fingerprint2 = service.generateFingerprint(transaction2, 'KZ123456789012345678');

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different workspaces', () => {
      const transaction1 = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
        'workspace-1',
      ) as any;

      const transaction2 = createMockTransaction(
        'tx2',
        new Date('2024-01-15'),
        10000,
        'Company A',
        'workspace-2',
      ) as any;

      const fingerprint1 = service.generateFingerprint(transaction1, 'KZ123456789012345678');
      const fingerprint2 = service.generateFingerprint(transaction2, 'KZ123456789012345678');

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different account numbers', () => {
      const transaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const fingerprint1 = service.generateFingerprint(transaction, 'KZ123456789012345678');
      const fingerprint2 = service.generateFingerprint(transaction, 'KZ987654321098765432');

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should handle credit transactions (negative amounts)', () => {
      const transaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        -10000,
        'Company A',
      ) as any;

      const fingerprint = service.generateFingerprint(transaction, 'KZ123456789012345678');

      expect(fingerprint).toHaveLength(32);
      expect(fingerprint).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should use debit value for direction when debit is set', () => {
      const transaction = {
        workspaceId: 'workspace-123',
        transactionDate: new Date('2024-01-15'),
        amount: 10000,
        debit: 10000,
        credit: null,
        currency: 'KZT',
        counterpartyName: 'Company A',
      } as any;

      const fingerprint = service.generateFingerprint(transaction, 'KZ123456789012345678');

      expect(fingerprint).toHaveLength(32);
    });

    it('should use credit value for direction when credit is set', () => {
      const transaction = {
        workspaceId: 'workspace-123',
        transactionDate: new Date('2024-01-15'),
        amount: 10000,
        debit: null,
        credit: 10000,
        currency: 'KZT',
        counterpartyName: 'Company A',
      } as any;

      const fingerprint = service.generateFingerprint(transaction, 'KZ123456789012345678');

      expect(fingerprint).toHaveLength(32);
    });

    it('should handle transactions without account number', () => {
      const transaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;

      const fingerprint = service.generateFingerprint(transaction);

      expect(fingerprint).toHaveLength(32);
      expect(fingerprint).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('findByFingerprint', () => {
    it('should find a transaction by fingerprint', async () => {
      const mockTransaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      );
      mockRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.findByFingerprint('workspace-123', 'abc123fingerprint');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-123',
          fingerprint: 'abc123fingerprint',
        },
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if no transaction found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByFingerprint('workspace-123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('bulkGenerateFingerprints', () => {
    it('should generate fingerprints for multiple transactions', () => {
      const transactions = [
        createMockTransaction('tx1', new Date('2024-01-15'), 10000, 'Company A'),
        createMockTransaction('tx2', new Date('2024-01-16'), 20000, 'Company B'),
        createMockTransaction('tx3', new Date('2024-01-17'), 30000, 'Company C'),
      ] as any[];

      const result = service.bulkGenerateFingerprints(transactions, 'KZ123456789012345678');

      expect(result.size).toBe(3);
      expect(result.get('tx1')).toHaveLength(32);
      expect(result.get('tx2')).toHaveLength(32);
      expect(result.get('tx3')).toHaveLength(32);
      expect(result.get('tx1')).not.toBe(result.get('tx2'));
    });

    it('should use transaction ID as map key when available', () => {
      const transactions = [
        { ...createMockTransaction('tx1', new Date('2024-01-15'), 10000, 'Company A'), id: 'tx1' },
      ] as any[];

      const result = service.bulkGenerateFingerprints(transactions, 'KZ123456789012345678');

      expect(result.has('tx1')).toBe(true);
    });

    it('should generate composite key when ID is not available', () => {
      const transactions = [
        {
          workspaceId: 'workspace-123',
          transactionDate: new Date('2024-01-15T10:00:00Z'),
          amount: 10000,
          debit: 10000,
          credit: null,
          currency: 'KZT',
          counterpartyName: 'Company A',
        },
      ] as any[];

      const result = service.bulkGenerateFingerprints(transactions, 'KZ123456789012345678');

      expect(result.size).toBe(1);
      const keys = Array.from(result.keys());
      expect(keys[0]).toContain('2024-01-15');
      expect(keys[0]).toContain('10000');
      expect(keys[0]).toContain('Company A');
    });

    it('should handle empty array', () => {
      const result = service.bulkGenerateFingerprints([], 'KZ123456789012345678');

      expect(result.size).toBe(0);
    });
  });

  describe('findByFingerprints', () => {
    it('should find multiple transactions by fingerprints', async () => {
      const mockTransactions = [
        createMockTransaction('tx1', new Date('2024-01-15'), 10000, 'Company A'),
        createMockTransaction('tx2', new Date('2024-01-16'), 20000, 'Company B'),
      ];

      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockTransactions),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findByFingerprints('workspace-123', [
        'fingerprint1',
        'fingerprint2',
      ]);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'transaction.workspaceId = :workspaceId',
        {
          workspaceId: 'workspace-123',
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.fingerprint IN (:...fingerprints)',
        { fingerprints: ['fingerprint1', 'fingerprint2'] },
      );
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array for empty fingerprints', async () => {
      const result = await service.findByFingerprints('workspace-123', []);

      expect(result).toEqual([]);
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('updateFingerprint', () => {
    it('should update fingerprint for a transaction with workspace isolation', async () => {
      const mockTransaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      );
      mockTransaction.fingerprint = 'new-fingerprint';

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(mockTransaction);

      const result = await service.updateFingerprint('workspace-123', 'tx1', 'new-fingerprint');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'tx1', workspaceId: 'workspace-123' },
        { fingerprint: 'new-fingerprint' },
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx1', workspaceId: 'workspace-123' },
      });
      expect(result.fingerprint).toBe('new-fingerprint');
    });

    it('should throw NotFoundException if no rows affected', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updateFingerprint('workspace-123', 'nonexistent', 'fingerprint'),
      ).rejects.toThrow('Transaction not found: nonexistent');
    });

    it('should throw NotFoundException if transaction not found after update', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateFingerprint('workspace-123', 'tx1', 'fingerprint'),
      ).rejects.toThrow('Transaction not found: tx1');
    });

    it('should prevent cross-workspace access', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 });

      await expect(
        service.updateFingerprint('workspace-999', 'tx1', 'fingerprint'),
      ).rejects.toThrow('Transaction not found: tx1');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'tx1', workspaceId: 'workspace-999' },
        { fingerprint: 'fingerprint' },
      );
    });
  });

  describe('backfillFingerprints', () => {
    it('should backfill fingerprints for transactions without them', async () => {
      const transactions = [
        createMockTransaction('tx1', new Date('2024-01-15'), 10000, 'Company A'),
        createMockTransaction('tx2', new Date('2024-01-16'), 20000, 'Company B'),
      ] as Transaction[];

      mockRepository.find.mockResolvedValue(transactions);
      mockRepository.save.mockResolvedValue(transactions);

      const count = await service.backfillFingerprints('workspace-123', 'KZ123456789012345678');

      expect(count).toBe(2);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-123',
          fingerprint: IsNull(),
        },
        take: 1000,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(transactions);
      expect(transactions[0].fingerprint).toBeTruthy();
      expect(transactions[1].fingerprint).toBeTruthy();
    });

    it('should return 0 if no transactions need backfilling', async () => {
      mockRepository.find.mockResolvedValue([]);

      const count = await service.backfillFingerprints('workspace-123', 'KZ123456789012345678');

      expect(count).toBe(0);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should respect custom limit', async () => {
      const transactions = [
        createMockTransaction('tx1', new Date('2024-01-15'), 10000, 'Company A'),
      ] as Transaction[];

      mockRepository.find.mockResolvedValue(transactions);
      mockRepository.save.mockResolvedValue(transactions);

      await service.backfillFingerprints('workspace-123', 'KZ123456789012345678', 500);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: {
          workspaceId: 'workspace-123',
          fingerprint: IsNull(),
        },
        take: 500,
      });
    });
  });

  describe('integration scenarios', () => {
    it('should generate consistent fingerprints across generate and bulk methods', () => {
      const transaction = createMockTransaction(
        'tx1',
        new Date('2024-01-15'),
        10000,
        'Company A',
      ) as any;
      const accountNumber = 'KZ123456789012345678';

      const singleFingerprint = service.generateFingerprint(transaction, accountNumber);
      const bulkResult = service.bulkGenerateFingerprints([transaction], accountNumber);
      const bulkFingerprint = bulkResult.get('tx1');

      expect(singleFingerprint).toBe(bulkFingerprint);
    });

    it('should handle mixed transaction types in bulk generation', () => {
      const transactions = [
        createMockTransaction('tx1', new Date('2024-01-15'), 10000, 'Company A'), // debit
        createMockTransaction('tx2', new Date('2024-01-16'), -5000, 'Company B'), // credit
        {
          id: 'tx3',
          workspaceId: 'workspace-123',
          transactionDate: new Date('2024-01-17'),
          amount: 7500,
          debit: null,
          credit: 7500,
          currency: 'USD',
          counterpartyName: 'Company C',
        },
      ] as any[];

      const result = service.bulkGenerateFingerprints(transactions, 'KZ123456789012345678');

      expect(result.size).toBe(3);
      expect(result.get('tx1')).toBeTruthy();
      expect(result.get('tx2')).toBeTruthy();
      expect(result.get('tx3')).toBeTruthy();
    });
  });
});
