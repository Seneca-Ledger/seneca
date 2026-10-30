import type { Repository } from 'typeorm';
import type { Transaction } from '../../src/entities/transaction.entity';
import { loadTransactionSummaries } from '../../src/modules/statements/statement-transaction-summary';

const createRepository = (rows: unknown[] = []) => {
  const queryBuilder = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    setParameters: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };

  const transactionRepository = {
    createQueryBuilder: vi.fn(() => queryBuilder),
  };

  return {
    repository: transactionRepository as unknown as Repository<Transaction>,
    transactionRepository,
  };
};

describe('statement transaction summaries', () => {
  it('skips the aggregate query when there are no statements', async () => {
    const { repository, transactionRepository } = createRepository();

    const result = await loadTransactionSummaries(repository, 'workspace-1', [], null);

    expect(result.size).toBe(0);
    expect(transactionRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('maps single and mixed exchange-rate summaries and the rows still uncategorized', async () => {
    const { repository } = createRepository([
      {
        statementId: 'statement-1',
        description: 'Cloud subscription',
        exchangeRate: '4.5500',
        exchangeRateCount: '1',
        cardLabel: 'Corporate card',
        uncategorizedCount: '3',
      },
      {
        statementId: 'statement-2',
        description: null,
        exchangeRate: '4.1000',
        exchangeRateCount: '2',
        cardLabel: null,
        uncategorizedCount: '0',
      },
    ]);

    const result = await loadTransactionSummaries(
      repository,
      'workspace-1',
      ['statement-1', 'statement-2'],
      null,
    );

    expect(result.get('statement-1')).toEqual({
      description: 'Cloud subscription',
      exchangeRate: '4.5500',
      exchangeRateMixed: false,
      cardLabel: 'Corporate card',
      uncategorizedCount: 3,
    });
    expect(result.get('statement-2')).toEqual({
      description: null,
      exchangeRate: '4.1000',
      exchangeRateMixed: true,
      cardLabel: null,
      uncategorizedCount: 0,
    });
  });
});
