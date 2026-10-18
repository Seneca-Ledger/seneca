import { InsightType } from '@/entities/insight.entity';
import { OperationalAnalyzer } from '@/modules/insights/analyzers/operational.analyzer';

function createCountQueryBuilder(count: number) {
  const builder = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
  };

  return builder;
}

describe('OperationalAnalyzer', () => {
  const transactionRepository = {
    createQueryBuilder: jest.fn(),
  } as any;

  let analyzer: OperationalAnalyzer;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new OperationalAnalyzer(transactionRepository);
  });

  it('returns operational insight candidates when thresholds are exceeded', async () => {
    transactionRepository.createQueryBuilder
      .mockReturnValueOnce(createCountQueryBuilder(64))
      .mockReturnValueOnce(createCountQueryBuilder(12))
      .mockReturnValueOnce(createCountQueryBuilder(3));

    const results = await analyzer.analyze({
      userId: 'user-1',
      workspaceId: 'workspace-1',
    });

    expect(results).toHaveLength(3);
    expect(results.map(item => item.type)).toEqual([
      InsightType.UNAPPROVED_COUNT,
      InsightType.UNCATEGORIZED_COUNT,
      InsightType.DUPLICATE_DETECTED,
    ]);
    expect(results.map(item => 'messageParams' in item && item.messageParams.count)).toEqual([
      64, 12, 3,
    ]);
  });

  it("counts with the Review queue's own queries, so the number matches what Review lists", async () => {
    const builders = [64, 12, 3].map(createCountQueryBuilder);
    for (const builder of builders) {
      transactionRepository.createQueryBuilder.mockReturnValueOnce(builder);
    }

    await analyzer.analyze({ userId: 'user-1', workspaceId: 'workspace-1' });

    // Rows of a trashed statement are not waiting for anyone (unconfirmed, duplicates)…
    for (const builder of [builders[0], builders[2]]) {
      expect(builder.andWhere).toHaveBeenCalledWith('(t.statementId IS NULL OR s.deletedAt IS NULL)');
    }
    // …and a transfer has no category to give (uncategorized).
    expect(builders[1].andWhere).toHaveBeenCalledWith('t.transferPairId IS NULL');
  });

  it('returns no candidates when counts do not pass thresholds', async () => {
    transactionRepository.createQueryBuilder
      .mockReturnValueOnce(createCountQueryBuilder(0))
      .mockReturnValueOnce(createCountQueryBuilder(5))
      .mockReturnValueOnce(createCountQueryBuilder(0));

    const results = await analyzer.analyze({
      userId: 'user-1',
      workspaceId: null,
    });

    expect(results).toHaveLength(0);
  });
});
