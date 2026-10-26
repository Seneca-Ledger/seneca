import { StatementsService } from '../../src/modules/statements/statements.service';

const createService = (rows: unknown[] = []) => {
  const queryBuilder = {
    leftJoin: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rows),
  };

  const transactionRepository = {
    createQueryBuilder: vi.fn(() => queryBuilder),
  };

  const service = new StatementsService(
    {} as never,
    transactionRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  return { service, transactionRepository, queryBuilder };
};

describe('StatementsService transaction summaries', () => {
  it('skips the aggregate query when there are no statements', async () => {
    const { service, transactionRepository } = createService();

    const result = await (
      service as unknown as {
        loadTransactionSummaries: (
          workspaceId: string,
          statementIds: string[],
          viewerMemberId: string | null,
        ) => Promise<Map<string, unknown>>;
      }
    ).loadTransactionSummaries('workspace-1', [], null);

    expect(result.size).toBe(0);
    expect(transactionRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('maps single and mixed exchange-rate summaries', async () => {
    const { service } = createService([
      {
        statementId: 'statement-1',
        description: 'Cloud subscription',
        exchangeRate: '4.5500',
        exchangeRateCount: '1',
        cardLabel: 'Corporate card',
      },
      {
        statementId: 'statement-2',
        description: null,
        exchangeRate: '4.1000',
        exchangeRateCount: '2',
        cardLabel: null,
      },
    ]);

    const result = await (
      service as unknown as {
        loadTransactionSummaries: (
          workspaceId: string,
          statementIds: string[],
          viewerMemberId: string | null,
        ) => Promise<
          Map<
            string,
            {
              description: string | null;
              exchangeRate: string | null;
              exchangeRateMixed: boolean;
              cardLabel: string | null;
            }
          >
        >;
      }
    ).loadTransactionSummaries('workspace-1', ['statement-1', 'statement-2'], null);

    expect(result.get('statement-1')).toEqual({
      description: 'Cloud subscription',
      exchangeRate: '4.5500',
      exchangeRateMixed: false,
      cardLabel: 'Corporate card',
    });
    expect(result.get('statement-2')).toEqual({
      description: null,
      exchangeRate: '4.1000',
      exchangeRateMixed: true,
      cardLabel: null,
    });
  });
});
