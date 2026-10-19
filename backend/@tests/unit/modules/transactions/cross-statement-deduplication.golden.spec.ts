import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Transaction, TransactionType } from '../../../../src/entities/transaction.entity';
import { CrossStatementDeduplicationService } from '../../../../src/modules/transactions/services/cross-statement-deduplication.service';

/**
 * The duplicate cases people actually hit (2026 complaints): one Amazon order
 * charged per shipment, the same coffee on two cards, and the one true
 * duplicate — a re-imported statement that overlaps the previous one.
 */
describe('CrossStatementDeduplicationService golden cases', () => {
  let service: CrossStatementDeduplicationService;
  const statements = new Map<string, string | null>();
  const repository = {
    find: jest.fn(),
    update: jest.fn(),
    manager: {
      getRepository: () => ({
        find: async ({ where }: { where: { id: { _value: string[] } } }) =>
          where.id._value.map(id => ({ id, accountNumber: statements.get(id) ?? null })),
      }),
    },
  };

  const row = (overrides: Partial<Transaction> & { id: string; statementId: string }): Transaction =>
    ({
      workspaceId: 'ws-1',
      transactionDate: new Date('2026-03-10'),
      transactionType: TransactionType.EXPENSE,
      counterpartyName: 'AMAZON',
      paymentPurpose: 'Order 123-4567',
      debit: 50,
      credit: null,
      amount: 50,
      currency: 'EUR',
      isDuplicate: false,
      splitGroupId: null,
      cryptoWalletId: null,
      ...overrides,
    }) as Transaction;

  beforeEach(async () => {
    jest.clearAllMocks();
    statements.clear();
    const module = await Test.createTestingModule({
      providers: [
        CrossStatementDeduplicationService,
        { provide: getRepositoryToken(Transaction), useValue: repository },
      ],
    }).compile();
    service = module.get(CrossStatementDeduplicationService);
  });

  it('keeps the three shipments of one Amazon order apart', async () => {
    statements.set('stmt-march', 'DE11');
    const shipments = [
      row({ id: 'a', statementId: 'stmt-march', debit: 50, amount: 50 }),
      row({ id: 'b', statementId: 'stmt-march', debit: 37, amount: 37 }),
      row({ id: 'c', statementId: 'stmt-march', debit: 12.99, amount: 12.99 }),
    ];
    repository.find.mockResolvedValueOnce(shipments).mockResolvedValueOnce(shipments);

    expect(await service.findDuplicates('ws-1', 'stmt-march')).toEqual([]);
  });

  it('keeps the same coffee on two cards apart', async () => {
    statements.set('stmt-visa', 'DE11');
    statements.set('stmt-master', 'DE22');
    const visa = row({ id: 'visa', statementId: 'stmt-visa', counterpartyName: 'COFFEE FELLOWS' });
    const master = row({
      id: 'master',
      statementId: 'stmt-master',
      counterpartyName: 'COFFEE FELLOWS',
    });
    repository.find.mockResolvedValueOnce([master]).mockResolvedValueOnce([visa, master]);

    expect(await service.findDuplicates('ws-1', 'stmt-master')).toEqual([]);
  });

  it('still flags the overlap when the same account is imported twice', async () => {
    statements.set('stmt-march', 'DE11');
    statements.set('stmt-march-again', 'DE11');
    const first = row({ id: 'first', statementId: 'stmt-march', counterpartyName: 'COFFEE FELLOWS' });
    const again = row({
      id: 'again',
      statementId: 'stmt-march-again',
      counterpartyName: 'COFFEE FELLOWS',
    });
    repository.find.mockResolvedValueOnce([again]).mockResolvedValueOnce([first, again]);

    const groups = await service.findDuplicates('ws-1', 'stmt-march-again');

    expect(groups).toHaveLength(1);
    expect(groups[0].duplicates[0].transaction.id).toBe('first');
    expect(groups[0].duplicates[0].matchType).toBe('exact');
  });

  it('still compares rows whose account is unknown', async () => {
    const first = row({ id: 'first', statementId: 'stmt-x', counterpartyName: 'COFFEE FELLOWS' });
    const again = row({ id: 'again', statementId: 'stmt-y', counterpartyName: 'COFFEE FELLOWS' });
    repository.find.mockResolvedValueOnce([again]).mockResolvedValueOnce([first, again]);

    expect(await service.findDuplicates('ws-1', 'stmt-y')).toHaveLength(1);
  });
});
