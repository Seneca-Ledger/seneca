import { describe, expect, it } from 'vitest';
import type { Insight } from '@/app/hooks/useInsights';
import { insightHref } from './insight-href';

const makeInsight = (overrides: Partial<Insight>): Insight => ({
  id: 'insight-1',
  type: 'trend.spending_up',
  category: 'trend',
  severity: 'warn',
  title: 'Category is rising',
  message: 'Spending is above the average',
  messageKey: null,
  messageParams: null,
  data: null,
  createdAt: '2026-09-23T00:00:00.000Z',
  ...overrides,
});

describe('insightHref', () => {
  it('sends a rising category to its row on the leaderboard, by name', () => {
    const href = insightHref(
      makeInsight({
        type: 'trend.spending_up',
        data: { categoryId: 'cat-1', categoryName: '  Marketing and Advertising ' },
      }),
    );

    expect(href).toBe(
      '/reports?tab=cash-flow&focus=category%3Amarketing%20and%20advertising',
    );
  });

  it('opens the leaderboard on the month the rise was measured in', () => {
    // Without it the page aggregates every month it has, and the ringed row
    // would show a total the advice never mentioned.
    expect(
      insightHref(
        makeInsight({
          type: 'trend.spending_up',
          data: { month: '2026-09', categoryName: 'Travel' },
        }),
      ),
    ).toBe('/reports?tab=cash-flow&month=2026-09&focus=category%3Atravel');
  });

  it('ignores a month that is not one', () => {
    expect(
      insightHref(
        makeInsight({ type: 'trend.spending_up', data: { month: 'none', categoryName: 'Travel' } }),
      ),
    ).toBe('/reports?tab=cash-flow&focus=category%3Atravel');
  });

  it('leaves a rising category unlinked when the name is missing', () => {
    expect(
      insightHref(makeInsight({ type: 'trend.spending_up', data: { categoryId: 'cat-1' } })),
    ).toBeNull();
    expect(insightHref(makeInsight({ type: 'trend.spending_up', data: { categoryName: '  ' } }))).toBeNull();
    expect(insightHref(makeInsight({ type: 'trend.spending_up', data: null }))).toBeNull();
  });

  it('opens the budget form on the category that has none', () => {
    expect(
      insightHref(
        makeInsight({ type: 'category.dominance', data: { categoryId: 'cat-7', amount: 780 } }),
      ),
    ).toBe('/budgets?newBudgetCategory=cat-7');
  });

  it('still reaches the budgets page when the insight carries no category', () => {
    // Several showcase insights were written by hand and have no `data` at all.
    expect(insightHref(makeInsight({ type: 'category.dominance', data: null }))).toBe('/budgets');
  });

  it('points the savings rate at the tab that actually shows it', () => {
    // The KPI lives on Overview; the Trends tab has no savings-rate widget.
    expect(insightHref(makeInsight({ type: 'trend.savings_rate' }))).toBe(
      '/dashboard?tab=overview&focus=kpi%3Asavings-rate',
    );
    expect(insightHref(makeInsight({ type: 'trend.savings_rate', data: { month: '2026-09' } }))).toBe(
      '/dashboard?tab=overview&month=2026-09&focus=kpi%3Asavings-rate',
    );
  });

  it('sends an AI summary to the month it was written about', () => {
    expect(
      insightHref(
        makeInsight({ type: 'ai.summary', data: { periodKey: '2026-08', modelId: 'local' } }),
      ),
    ).toBe('/dashboard?tab=overview&month=2026-08');
    expect(insightHref(makeInsight({ type: 'ai.summary', data: null }))).toBeNull();
  });

  it('sends the operational backlogs to the queue that clears them', () => {
    expect(insightHref(makeInsight({ type: 'operational.unapproved_count' }))).toBe(
      '/review',
    );
    expect(insightHref(makeInsight({ type: 'operational.uncategorized_count' }))).toBe(
      '/statements/submit?missingCategory=true',
    );
    expect(insightHref(makeInsight({ type: 'operational.duplicate_detected' }))).toBe(
      '/review',
    );
  });

  it('sends the remaining signals to the page that shows the same number', () => {
    expect(insightHref(makeInsight({ type: 'pattern.risky_allocation' }))).toBe(
      '/net-worth?focus=card:risk',
    );
    expect(insightHref(makeInsight({ type: 'forecast.monthly' }))).toBe('/dashboard?tab=overview');
    expect(insightHref(makeInsight({ type: 'pattern.detected' }))).toBe('/subscriptions');
  });

  it('leaves types with nowhere useful to go unlinked', () => {
    expect(insightHref(makeInsight({ type: 'workflow.tip' }))).toBeNull();
    expect(insightHref(makeInsight({ type: 'rule.suggestion' }))).toBeNull();
  });

  it('sends Stoic advice about a class to that class in Budgets', () => {
    expect(
      insightHref(makeInsight({ type: 'stoic.intent_gap', data: { stoicClass: 'leisure' } })),
    ).toBe('/budgets?focus=stoic%3Aleisure');
    expect(
      insightHref(makeInsight({ type: 'stoic.virtue_neglected', data: { stoicClass: 'virtue' } })),
    ).toBe('/budgets?focus=stoic%3Avirtue');
    expect(insightHref(makeInsight({ type: 'stoic.praise', data: {} }))).toBe('/budgets');
  });

  it('carries the judged month to Budgets, which otherwise shows the running one', () => {
    // Early in a month the advice is about the month that just ended.
    expect(
      insightHref(
        makeInsight({ type: 'stoic.intent_gap', data: { month: '2026-08', stoicClass: 'leisure' } }),
      ),
    ).toBe('/budgets?month=2026-08&focus=stoic%3Aleisure');
    expect(
      insightHref(
        makeInsight({ type: 'stoic.repeated', data: { month: '2026-08', categoryId: 'cat-1' } }),
      ),
    ).toBe('/budgets?month=2026-08&focus=budget%3Acat-1');
  });

  it('sends a repeated overrun to its budget card, and a leisure habit to leisure', () => {
    expect(
      insightHref(makeInsight({ type: 'stoic.repeated', data: { categoryId: 'cat-1' } })),
    ).toBe('/budgets?focus=budget%3Acat-1');
    expect(
      insightHref(makeInsight({ type: 'stoic.repeated', data: { stoicClass: 'leisure' } })),
    ).toBe('/budgets?focus=stoic%3Aleisure');
  });

  it('sends unjudged categories to the list where they are judged', () => {
    expect(insightHref(makeInsight({ type: 'stoic.unclassified' }))).toBe(
      '/budgets?focus=stoic:unclassified',
    );
  });

  it('sends plan advice to the budget it is about, or to its class', () => {
    expect(insightHref(makeInsight({ type: 'stoic.plan', data: { categoryId: 'c1' } }))).toBe(
      '/budgets?focus=budget%3Ac1',
    );
    expect(insightHref(makeInsight({ type: 'stoic.plan', data: { stoicClass: 'virtue' } }))).toBe(
      '/budgets?focus=stoic%3Avirtue',
    );
  });

  it('sends the generosity hint to the virtue class', () => {
    expect(
      insightHref(makeInsight({ type: 'stoic.generosity', data: { stoicClass: 'virtue' } })),
    ).toBe('/budgets?focus=stoic%3Avirtue');
  });

  it('sends goal advice and goal praise to the goal', () => {
    expect(insightHref(makeInsight({ type: 'stoic.goal', data: { goalId: 'g1' } }))).toBe('/goals/g1');
    expect(insightHref(makeInsight({ type: 'stoic.goal', data: null }))).toBe('/goals');
    expect(insightHref(makeInsight({ type: 'stoic.praise', data: { goalId: 'g1' } }))).toBe(
      '/goals/g1',
    );
  });

  it('sends habits, fortune, commitments and subscriptions to where they are seen', () => {
    expect(insightHref(makeInsight({ type: 'stoic.habit' }))).toBe('/reports?tab=cash-flow');
    expect(insightHref(makeInsight({ type: 'stoic.fortune' }))).toBe('/dashboard?tab=overview');
    expect(insightHref(makeInsight({ type: 'stoic.commitments' }))).toBe('/dashboard?tab=overview');
    expect(insightHref(makeInsight({ type: 'stoic.subscriptions' }))).toBe('/subscriptions');
  });

  it('rings the merchant a habit is about, in the month it counted visits', () => {
    expect(
      insightHref(
        makeInsight({ type: 'stoic.habit', data: { month: '2026-09', merchant: ' Café Einstein ' } }),
      ),
    ).toBe('/reports?tab=cash-flow&month=2026-09&focus=merchant%3Acaf%C3%A9%20einstein');
  });

  it('sends the weekend habit, which names no merchant, to its class', () => {
    expect(
      insightHref(
        makeInsight({ type: 'stoic.habit', data: { month: '2026-09', stoicClass: 'leisure' } }),
      ),
    ).toBe('/budgets?month=2026-09&focus=stoic%3Aleisure');
  });

  it('pins the dashboard to the judged month for fortune and commitments', () => {
    // With no month the dashboard shows the latest one that has data.
    expect(insightHref(makeInsight({ type: 'stoic.fortune', data: { month: '2026-08' } }))).toBe(
      '/dashboard?tab=overview&month=2026-08',
    );
    expect(
      insightHref(makeInsight({ type: 'stoic.commitments', data: { month: '2026-08' } })),
    ).toBe('/dashboard?tab=overview&month=2026-08');
  });

  it('sends an expert principle to where its numbers live', () => {
    expect(
      insightHref(makeInsight({ type: 'expert.principle', data: { target: 'budgets' } })),
    ).toBe('/budgets');
    expect(
      insightHref(makeInsight({ type: 'expert.principle', data: { target: 'merchants' } })),
    ).toBe('/reports?tab=cash-flow');
  });
});
