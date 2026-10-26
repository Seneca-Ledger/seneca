import {
  type Insight,
  InsightCategory,
  InsightSeverity,
  InsightType,
} from '@/entities/insight.entity';
import type { User } from '@/entities/user.entity';
import type { InsightCandidate } from '@/modules/insights/analyzers/analyzer.interface';
import {
  INSIGHT_SNOOZE_MS,
  InsightsService,
  isStillSnoozed,
} from '@/modules/insights/insights.service';

function createRepoMock<T>() {
  return {
    findOne: vi.fn(),
    find: vi.fn(async () => []),
    create: vi.fn((data: Partial<T>) => data as T),
    save: vi.fn(async (data: Partial<T>) => data as T),
    createQueryBuilder: vi.fn(),
    update: vi.fn(async () => ({ affected: 1 })),
  } as any;
}

function createQueryBuilderMock() {
  const qb: any = {
    where: vi.fn(() => qb),
    andWhere: vi.fn(() => qb),
    orderBy: vi.fn(() => qb),
    take: vi.fn(() => qb),
    skip: vi.fn(() => qb),
    select: vi.fn(() => qb),
    addSelect: vi.fn(() => qb),
    groupBy: vi.fn(() => qb),
    update: vi.fn(() => qb),
    delete: vi.fn(() => qb),
    from: vi.fn(() => qb),
    set: vi.fn(() => qb),
    execute: vi.fn(async () => ({ affected: 1 })),
    getManyAndCount: vi.fn(async () => [[], 0]),
    getRawMany: vi.fn(async () => []),
  };
  return qb;
}

describe('InsightsService', () => {
  const insightRepository = createRepoMock<Insight>();
  const userRepository = createRepoMock<User>();
  const operationalAnalyzer = {
    analyze: vi.fn(),
  } as any;
  const financialAnalyzer = {
    analyze: vi.fn(async () => []),
  } as any;
  const stoicAnalyzer = {
    analyze: vi.fn(async () => []),
  } as any;

  let service: InsightsService;

  beforeEach(() => {
    vi.clearAllMocks();
    financialAnalyzer.analyze.mockResolvedValue([]);
    stoicAnalyzer.analyze.mockResolvedValue([]);
    insightRepository.find.mockResolvedValue([]);
    insightRepository.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    userRepository.findOne.mockResolvedValue({ id: 'user-1', locale: 'ru' });
    service = new InsightsService(
      insightRepository,
      userRepository,
      operationalAnalyzer,
      financialAnalyzer,
      stoicAnalyzer,
    );
  });

  it('creates a new insight when there is no active insight with same deduplication key', async () => {
    const candidate: InsightCandidate = {
      type: InsightType.UNAPPROVED_COUNT,
      category: InsightCategory.OPERATIONAL,
      severity: InsightSeverity.WARN,
      messageKey: 'operational.unapproved',
      messageParams: { count: 64 },
      deduplicationKey: 'operational:unapproved:workspace-1',
      data: { count: 64 },
      actions: [],
    };

    operationalAnalyzer.analyze.mockResolvedValue([candidate]);
    insightRepository.findOne.mockResolvedValue(null);

    const result = await service.refresh('user-1', 'workspace-1');

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(1);
    expect(result.newInsights).toHaveLength(1);
    expect(result.newInsights[0]).toMatchObject({
      deduplicationKey: 'operational:unapproved:workspace-1',
    });
    expect(insightRepository.create).toHaveBeenCalledTimes(1);
    expect(insightRepository.save).toHaveBeenCalledTimes(1);
  });

  it('renders keyed text in the recipient locale and keeps the key for re-rendering', async () => {
    const candidate: InsightCandidate = {
      type: InsightType.UNAPPROVED_COUNT,
      category: InsightCategory.OPERATIONAL,
      severity: InsightSeverity.WARN,
      messageKey: 'operational.unapproved',
      messageParams: { count: 64 },
      deduplicationKey: 'operational:unapproved:workspace-1',
    };

    operationalAnalyzer.analyze.mockResolvedValue([candidate]);
    insightRepository.findOne.mockResolvedValue(null);
    userRepository.findOne.mockResolvedValue({ id: 'user-1', locale: 'en' });

    await service.refresh('user-1', 'workspace-1');

    expect(insightRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Transactions await your judgment',
        message:
          '64 transactions are waiting for approval. Settle them today rather than carry them.',
        messageKey: 'operational.unapproved',
        messageParams: { count: 64, locale: 'en' },
      }),
    );
  });

  it('writes in the interface language when the client names one', async () => {
    operationalAnalyzer.analyze.mockResolvedValue([
      {
        type: InsightType.UNAPPROVED_COUNT,
        category: InsightCategory.OPERATIONAL,
        severity: InsightSeverity.WARN,
        messageKey: 'operational.unapproved',
        messageParams: { count: 3 },
        deduplicationKey: 'operational:unapproved:workspace-1',
      },
    ]);
    insightRepository.findOne.mockResolvedValue(null);
    userRepository.findOne.mockResolvedValue({ id: 'user-1', locale: 'en' });

    await service.refresh('user-1', 'workspace-1', { locale: 'ru' });
    await service.refresh('user-1', 'workspace-1', { locale: 'xx' });

    expect(insightRepository.create.mock.calls[0][0]).toMatchObject({
      title: 'Операции ждут вашего решения',
      messageParams: { count: 3, locale: 'ru' },
    });
    // An unknown language falls back to the profile's.
    expect(insightRepository.create.mock.calls[1][0].messageParams.locale).toBe('en');
  });

  it('merges candidates from every analyzer', async () => {
    operationalAnalyzer.analyze.mockResolvedValue([
      {
        type: InsightType.UNAPPROVED_COUNT,
        category: InsightCategory.OPERATIONAL,
        severity: InsightSeverity.WARN,
        messageKey: 'operational.unapproved',
        messageParams: { count: 3 },
        deduplicationKey: 'operational:unapproved:workspace-1',
      },
    ]);
    financialAnalyzer.analyze.mockResolvedValue([
      {
        type: InsightType.SAVINGS_RATE_TREND,
        category: InsightCategory.TREND,
        severity: InsightSeverity.WARN,
        messageKey: 'trend.savings_rate_down',
        messageParams: { rate: 12, diff: 9 },
        deduplicationKey: 'financial:savings_rate:workspace-1:2026-08',
      },
    ]);
    insightRepository.findOne.mockResolvedValue(null);

    const result = await service.refresh('user-1', 'workspace-1');

    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.total).toBe(2);
    expect(result.newInsights).toHaveLength(2);
  });

  it('updates the row a concurrent refresh created first instead of failing', async () => {
    const candidate: InsightCandidate = {
      type: InsightType.UNAPPROVED_COUNT,
      category: InsightCategory.OPERATIONAL,
      severity: InsightSeverity.WARN,
      messageKey: 'operational.unapproved',
      messageParams: { count: 3 },
      deduplicationKey: 'operational:unapproved:workspace-1',
      data: { count: 3 },
      actions: [],
    };
    operationalAnalyzer.analyze.mockResolvedValue([candidate]);
    const winner = { id: 'winner', isDismissed: false } as Insight;
    // No active row, nothing snoozed; the insert loses the race; the row is there now.
    insightRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    insightRepository.save
      .mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }))
      .mockImplementation(async (row: Insight) => row);

    const result = await service.refresh('user-1', 'workspace-1');

    expect(result).toMatchObject({ created: 0, updated: 1 });
    expect(insightRepository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'winner', messageParams: expect.objectContaining({ count: 3 }) }),
    );
  });

  describe('closing an insight means "not now"', () => {
    const candidate: InsightCandidate = {
      type: InsightType.UNAPPROVED_COUNT,
      category: InsightCategory.OPERATIONAL,
      severity: InsightSeverity.WARN,
      messageKey: 'operational.unapproved',
      messageParams: { count: 5 },
      deduplicationKey: 'operational:unapproved:workspace-1',
      data: { count: 5 },
      actions: [],
    };
    const closed = (daysAgo: number, count: number) =>
      ({
        id: 'closed-1',
        isDismissed: true,
        dismissedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        data: { count },
      }) as Insight;

    it('stays closed through a refresh within the week while the count does not grow', async () => {
      operationalAnalyzer.analyze.mockResolvedValue([candidate]);
      // No active row; the latest closed one, two days old, counted the same.
      insightRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(closed(2, 5));

      const result = await service.refresh('user-1', 'workspace-1');

      expect(result.created).toBe(0);
      expect(insightRepository.create).not.toHaveBeenCalled();
      expect(insightRepository.findOne).toHaveBeenLastCalledWith({
        where: {
          userId: 'user-1',
          deduplicationKey: 'operational:unapproved:workspace-1',
          isDismissed: true,
        },
        order: { dismissedAt: { direction: 'DESC', nulls: 'LAST' } },
      });
    });

    it('comes back when the count grows', async () => {
      operationalAnalyzer.analyze.mockResolvedValue([candidate]);
      insightRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(closed(2, 3));

      const result = await service.refresh('user-1', 'workspace-1');

      expect(result.created).toBe(1);
    });

    it('comes back a week after the close', async () => {
      operationalAnalyzer.analyze.mockResolvedValue([candidate]);
      insightRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(closed(8, 5));

      const result = await service.refresh('user-1', 'workspace-1');

      expect(result.created).toBe(1);
    });

    it('records when it was closed', async () => {
      await service.dismiss('user-1', 'workspace-1', 'insight-1');
      expect(insightRepository.update).toHaveBeenCalledWith(
        { id: 'insight-1', userId: 'user-1', workspaceId: 'workspace-1', isDismissed: false },
        { isDismissed: true, dismissedAt: expect.any(Date) },
      );
    });

    it('holds for insights without a count until the week is over, and ignores a close with no date', () => {
      const now = new Date('2026-10-18T12:00:00Z');
      const at = (ms: number) => new Date(now.getTime() - ms);
      expect(isStillSnoozed({ dismissedAt: at(1000), data: null }, { data: null }, now)).toBe(true);
      expect(
        isStillSnoozed({ dismissedAt: at(INSIGHT_SNOOZE_MS), data: null }, { data: null }, now),
      ).toBe(false);
      expect(isStillSnoozed({ dismissedAt: null, data: null }, { data: null }, now)).toBe(false);
      // A shrinking count keeps it closed.
      expect(
        isStillSnoozed({ dismissedAt: at(1000), data: { count: 9 } }, { data: { count: 4 } }, now),
      ).toBe(true);
    });
  });

  it('updates an existing active insight with same deduplication key', async () => {
    const candidate: InsightCandidate = {
      type: InsightType.UNCATEGORIZED_COUNT,
      category: InsightCategory.OPERATIONAL,
      severity: InsightSeverity.WARN,
      messageKey: 'operational.uncategorized',
      messageParams: { count: 12 },
      deduplicationKey: 'operational:uncategorized:workspace-1',
      data: { count: 12 },
      actions: [],
    };

    operationalAnalyzer.analyze.mockResolvedValue([candidate]);
    insightRepository.findOne.mockResolvedValue({
      id: 'insight-1',
      deduplicationKey: candidate.deduplicationKey,
      isDismissed: false,
    } as Insight);

    const result = await service.refresh('user-1', 'workspace-1');

    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.total).toBe(1);
    expect(result.newInsights).toHaveLength(0);
    expect(insightRepository.create).not.toHaveBeenCalled();
    expect(insightRepository.save).toHaveBeenCalledTimes(1);
    expect(insightRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'insight-1',
        message: 'Транзакций без категории: 12. То, что не названо, нельзя взвесить.',
      }),
    );
  });

  it('requires workspaceId in list and summary filtering', async () => {
    const listQb = createQueryBuilderMock();
    const summaryQb = createQueryBuilderMock();
    insightRepository.createQueryBuilder.mockReturnValueOnce(listQb).mockReturnValueOnce(summaryQb);

    await service.list({ userId: 'user-1', workspaceId: 'workspace-1' });
    await service.getSummary('user-1', 'workspace-1');

    expect(listQb.andWhere).toHaveBeenCalledWith('insight.workspaceId = :workspaceId', {
      workspaceId: 'workspace-1',
    });
    expect(summaryQb.andWhere).toHaveBeenCalledWith('insight.workspaceId = :workspaceId', {
      workspaceId: 'workspace-1',
    });
  });

  it('renders keyed advice into the reader language on every read', async () => {
    const listQb = createQueryBuilderMock();
    listQb.getManyAndCount.mockResolvedValueOnce([
      [
        {
          id: 'insight-1',
          messageKey: 'stoic.total_over_plan',
          messageParams: {
            locale: 'en',
            variant: 2,
            percent: 20,
            currency: 'EUR',
            spentAmount: 2662,
            plannedAmount: 2210,
          },
          title: 'Your plan and your month disagree',
          message: 'stale English body',
        },
        // Уже на языке читателя — там может стоять текст модели, он ценнее шаблона.
        {
          id: 'insight-2',
          messageKey: 'stoic.total_over_plan',
          messageParams: { locale: 'de', variant: 0 },
          title: 'Vom Modell geschrieben',
          message: 'Bleibt unverändert',
        },
        // Без ключа рендерить не из чего.
        { id: 'insight-3', messageKey: null, messageParams: null, title: 'Hand-written', message: 'As is' },
      ],
      3,
    ]);
    insightRepository.createQueryBuilder.mockReturnValueOnce(listQb);

    const { items } = await service.list({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      locale: 'de',
    });

    expect(items[0].title).toBe('Plan und Monat sind sich uneins');
    expect(items[0].message).toContain('2.662');
    expect(items[1].title).toBe('Vom Modell geschrieben');
    expect(items[2].title).toBe('Hand-written');
  });

  it('credits the expert by their name in the reader language', async () => {
    const listQb = createQueryBuilderMock();
    listQb.getManyAndCount.mockResolvedValueOnce([
      [
        {
          id: 'insight-1',
          messageKey: 'expert.rule_50_30_20',
          // Уже на языке читателя: текст не перерисовывается, а подпись обязана.
          messageParams: { locale: 'ru', variant: 0 },
          title: 'Формула сбалансированных денег',
          message: 'unchanged',
          data: {
            expert: 'Elizabeth Warren & Amelia Warren Tyagi',
            work: 'All Your Worth (2005)',
            target: 'budgets',
          },
        },
      ],
      1,
    ]);
    insightRepository.createQueryBuilder.mockReturnValueOnce(listQb);

    const { items } = await service.list({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      locale: 'ru',
    });

    expect(items[0].data).toEqual({
      expert: 'Элизабет Уоррен и Амелия Уоррен Тьяги',
      // Название книги остаётся как издано — так же цитирует источник баннер.
      work: 'All Your Worth (2005)',
      target: 'budgets',
    });
    expect(items[0].title).toBe('Формула сбалансированных денег');
  });

  it('leaves the stored text alone when no locale is asked for', async () => {
    const listQb = createQueryBuilderMock();
    listQb.getManyAndCount.mockResolvedValueOnce([
      [
        {
          id: 'insight-1',
          messageKey: 'stoic.total_over_plan',
          messageParams: { locale: 'en', variant: 2 },
          title: 'Your plan and your month disagree',
          message: 'unchanged',
        },
      ],
      1,
    ]);
    insightRepository.createQueryBuilder.mockReturnValueOnce(listQb);

    const { items } = await service.list({ userId: 'user-1', workspaceId: 'workspace-1' });

    expect(items[0].title).toBe('Your plan and your month disagree');
  });

  describe('Stoic advice', () => {
    const stoicCandidate: InsightCandidate = {
      type: InsightType.STOIC_INTENT_GAP,
      category: InsightCategory.STOIC,
      severity: InsightSeverity.INFO,
      messageKey: 'stoic.leisure_over_plan',
      messageParams: { planned: 10, actual: 31 },
      deduplicationKey: 'stoic:leisure_gap:workspace-1:2026-09',
      data: { planned: 10, actual: 31, stoicClass: 'leisure' },
    };

    beforeEach(() => {
      operationalAnalyzer.analyze.mockResolvedValue([]);
      stoicAnalyzer.analyze.mockResolvedValue([stoicCandidate]);
      insightRepository.findOne.mockResolvedValue(null);
      userRepository.findOne.mockResolvedValue({ id: 'user-1', locale: 'en' });
    });

    it("stores the template text in the reader's language", async () => {
      await service.refresh('user-1', 'workspace-1');

      expect(insightRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Leisure takes more than you planned',
        }),
      );
    });

    it('removes Stoic rows that no longer hold, keeping the current ones', async () => {
      const qb = createQueryBuilderMock();
      insightRepository.createQueryBuilder.mockReturnValue(qb);

      await service.refresh('user-1', 'workspace-1');

      expect(qb.delete).toHaveBeenCalled();
      expect(qb.where).toHaveBeenCalledWith('user_id = :userId', { userId: 'user-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('workspace_id = :workspaceId', {
        workspaceId: 'workspace-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('category IN (:...categories)', {
        categories: ['stoic', 'expert'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith('deduplication_key NOT IN (:...currentKeys)', {
        currentKeys: [stoicCandidate.deduplicationKey],
      });
    });
  });
});
