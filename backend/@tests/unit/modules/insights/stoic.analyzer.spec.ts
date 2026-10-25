import { InsightCategory, InsightSeverity, InsightType } from '@/entities/insight.entity';
import type { StoicBalance } from '@/modules/budgets/stoic/stoic-ledger.service';
import { StoicAnalyzer } from '@/modules/insights/analyzers/stoic.analyzer';
import {
  balance,
  behavior,
  category,
  leisureHeavy,
  month,
  onPlan,
  SEPT_20,
} from './stoic-fixtures';

function analyzerWith(
  ledgerBalance: StoicBalance,
  options: { goalsFail?: boolean; shortfallDate?: string | null } = {},
) {
  const ledger = { monthlyBalance: vi.fn(async () => ledgerBalance) };
  const behaviorService = { load: vi.fn(async () => behavior()) };
  const goalsService = {
    findAll: vi.fn(async () => {
      if (options.goalsFail) {
        throw new Error('goals down');
      }
      return [];
    }),
  };
  const goalPlanService = { getPlan: vi.fn() };
  const dashboardService = {
    getCommitments: vi.fn(async () => ({
      openingBalance: 100000,
      shortfallDate: options.shortfallDate ?? null,
      lowestBalance: -250,
      totalCommitted: 1800,
    })),
  };
  const analyzer = new StoicAnalyzer(
    ledger as any,
    behaviorService as any,
    goalsService as any,
    goalPlanService as any,
    dashboardService as any,
  );
  return { analyzer, ledger, behaviorService };
}

const context = { userId: 'user-1', workspaceId: 'ws-1' };

describe('StoicAnalyzer', () => {
  it('stays silent without a workspace', async () => {
    const { analyzer, ledger } = analyzerWith(balance([]));
    expect(await analyzer.analyze({ userId: 'user-1', workspaceId: null }, SEPT_20)).toEqual([]);
    expect(ledger.monthlyBalance).not.toHaveBeenCalled();
  });

  it('writes reflection, not alarms, with a wording variant and the workspace currency', async () => {
    const { analyzer } = analyzerWith(balance([month(0, leisureHeavy), month(1, onPlan)]));

    const [insight] = await analyzer.analyze(context, SEPT_20);

    expect(insight).toMatchObject({
      type: InsightType.STOIC_INTENT_GAP,
      category: InsightCategory.STOIC,
      severity: InsightSeverity.INFO,
      messageKey: 'stoic.leisure_over_plan',
      messageParams: expect.objectContaining({ planned: 10, actual: 31, currency: 'EUR' }),
      deduplicationKey: 'stoic:leisure_over_plan:ws-1::2026-09',
    });
    const variant = (insight as { messageParams: { variant: number } }).messageParams.variant;
    expect(variant).toBeGreaterThanOrEqual(0);
    expect(variant).toBeLessThan(5);
  });

  it('rotates the wording from one month to the next', async () => {
    const variants = new Set<number>();
    for (const day of [new Date(2026, 5, 20), new Date(2026, 6, 20), new Date(2026, 7, 20)]) {
      const { analyzer } = analyzerWith(balance([month(0, leisureHeavy), month(1, onPlan)]));
      const [insight] = await analyzer.analyze(context, day);
      variants.add((insight as { messageParams: { variant: number } }).messageParams.variant);
    }
    expect(variants.size).toBe(3);
  });

  it('shows the most important first and never more than five', async () => {
    const lowVirtue = { necessity: 900, work: 400, virtue: 10, leisure: 400 };
    const { analyzer } = analyzerWith(
      balance(
        [
          month(0, lowVirtue, { overBudgetCategoryIds: ['cat-1'] }),
          month(1, lowVirtue, { overBudgetCategoryIds: ['cat-1'] }),
          month(2, lowVirtue, { overBudgetCategoryIds: ['cat-1'] }),
        ],
        [category(), category({ id: 'x', stoicClass: null, source: null })],
      ),
      { shortfallDate: '2026-10-05' },
    );

    const insights = await analyzer.analyze(context, SEPT_20);

    expect(insights.length).toBe(5);
    expect(insights.map(item => (item as { messageKey: string }).messageKey)).toEqual([
      'stoic.shortfall',
      'stoic.total_over_plan',
      'stoic.repeated_overrun',
      'stoic.leisure_habit',
      'stoic.virtue_neglected',
    ]);
  });

  it('praises a clean month once, and never next to a serious correction', async () => {
    const good = analyzerWith(balance([month(0, onPlan), month(1, onPlan), month(2, onPlan)]));
    const goodInsights = await good.analyzer.analyze(context, SEPT_20);
    expect(goodInsights.filter(item => item.type === InsightType.STOIC_PRAISE)).toHaveLength(1);
    expect(goodInsights[0].type).toBe(InsightType.STOIC_PRAISE);
    expect(goodInsights[0].deduplicationKey).toBe('stoic:praise:ws-1::2026-09');

    const bad = analyzerWith(balance([month(0, leisureHeavy), month(1, onPlan)]));
    const badInsights = await bad.analyzer.analyze(context, SEPT_20);
    expect(badInsights.map(item => item.type)).not.toContain(InsightType.STOIC_PRAISE);
  });

  it('keeps going when one data source fails', async () => {
    const { analyzer } = analyzerWith(balance([month(0, leisureHeavy)]), { goalsFail: true });

    const insights = await analyzer.analyze(context, SEPT_20);

    expect(insights.map(item => (item as { messageKey: string }).messageKey)).toContain(
      'stoic.leisure_over_plan',
    );
  });

  it('judges the previous month early in the month and expires on the 10th', async () => {
    const { analyzer, behaviorService } = analyzerWith(
      balance([month(0, { leisure: 50 }), month(1, leisureHeavy)]),
    );

    const [insight] = await analyzer.analyze(context, new Date(2026, 8, 3));

    expect(insight).toMatchObject({
      messageKey: 'stoic.leisure_over_plan',
      deduplicationKey: 'stoic:leisure_over_plan:ws-1::2026-08',
      expiresAt: new Date(2026, 8, 10),
    });
    expect(behaviorService.load).toHaveBeenCalledWith('ws-1', 'EUR', new Date(2026, 7, 1));
  });
});
