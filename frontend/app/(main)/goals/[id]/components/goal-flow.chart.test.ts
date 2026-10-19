import type { GoalFlowNode, GoalFlowResponse } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';
import { describe, expect, it } from 'vitest';
import { type GoalFlowChartLabels, buildGoalFlowSankey } from './goal-flow.chart';

const labels: GoalFlowChartLabels = {
  otherMerchants: '{{count}} more',
  planned: 'Planned',
  actual: 'Actual',
  overspent: 'Over',
  underspent: 'Under',
};

const money = (value: number) => `${value} KZT`;

function response(nodes: GoalFlowNode[]): GoalFlowResponse {
  return {
    goal: {
      id: 'g1',
      name: 'Renovation',
      targetAmount: 1000,
      currentAmount: 250,
      remaining: 750,
      targetDate: null,
    },
    month: '2026-05',
    currency: 'KZT',
    plannedTotal: 500,
    actualTotal: 620,
    variance: 120,
    nodes,
    links: [{ source: 'goal:g1', target: 'budget:b1', value: 620 }],
    budgets: [],
    excluded: { cashAmount: 0, cashEntryCount: 0 },
  };
}

const budgetNode = (planned: number, actual: number): GoalFlowNode => ({
  id: 'budget:b1',
  kind: 'budget',
  name: 'Materials',
  planned,
  actual,
  color: null,
});

function series(option: Record<string, unknown>) {
  return (option.series as Array<Record<string, unknown>>)[0];
}

describe('buildGoalFlowSankey', () => {
  it('names nodes by id so links resolve, and labels them by their human name', () => {
    const option = buildGoalFlowSankey(response([budgetNode(500, 620)]), 'light', labels, money);
    const data = series(option).data as Array<Record<string, unknown>>;

    expect(data[0].name).toBe('budget:b1');
    // Only name + itemStyle reach ECharts: extra keys (a null `color`, an `id`)
    // are read by the renderer and silently blank the series.
    expect(Object.keys(data[0]).sort()).toEqual(['itemStyle', 'name']);
    const formatter = (series(option).label as { formatter: (p: unknown) => string }).formatter;
    expect(formatter({ name: 'budget:b1' })).toBe('Materials');
  });

  it('marks a budget past its limit as danger and one within it as success', () => {
    const over = buildGoalFlowSankey(response([budgetNode(500, 620)]), 'light', labels, money);
    const under = buildGoalFlowSankey(response([budgetNode(500, 300)]), 'light', labels, money);

    const colorOf = (option: Record<string, unknown>) =>
      (series(option).data as Array<{ itemStyle: { color: string } }>)[0].itemStyle.color;

    expect(colorOf(over)).toBe(tokens.color.danger);
    expect(colorOf(under)).toBe(tokens.color.success);
  });

  it('takes its palette from the resolved theme', () => {
    const dark = buildGoalFlowSankey(response([budgetNode(500, 300)]), 'dark', labels, money);
    const colorOf = (option: Record<string, unknown>) =>
      (series(option).data as Array<{ itemStyle: { color: string } }>)[0].itemStyle.color;

    expect(colorOf(dark)).toBe(tokens.dark.color.success);
    expect((series(dark).label as { color: string }).color).toBe(tokens.dark.color.textPrimary);
  });

  it('labels the rolled-up tail with its count rather than an empty name', () => {
    const other: GoalFlowNode = {
      id: 'other:c1',
      kind: 'other',
      name: '',
      planned: null,
      actual: 40,
      color: null,
      mergedCount: 3,
    };
    const option = buildGoalFlowSankey(response([other]), 'light', labels, money);
    const formatter = (series(option).label as { formatter: (p: unknown) => string }).formatter;

    expect(formatter({ name: 'other:c1' })).toBe('3 more');
  });

  it('states the gap in the tooltip where intent was declared', () => {
    const option = buildGoalFlowSankey(response([budgetNode(500, 620)]), 'light', labels, money);
    const tooltip = option.tooltip as { formatter: (p: unknown) => string };

    expect(tooltip.formatter({ name: 'budget:b1' })).toBe(
      'Materials<br/>Planned: 500 KZT<br/>Actual: 620 KZT<br/>Over: 120 KZT',
    );
  });

  it('reports only the amount where nothing was declared', () => {
    const merchant: GoalFlowNode = {
      id: 'merchant:c1:shop',
      kind: 'merchant',
      name: 'shop',
      planned: null,
      actual: 60,
      color: null,
    };
    const option = buildGoalFlowSankey(response([merchant]), 'light', labels, money);
    const tooltip = option.tooltip as { formatter: (p: unknown) => string };

    expect(tooltip.formatter({ name: 'merchant:c1:shop' })).toBe('shop<br/>Actual: 60 KZT');
  });

  it('keeps the canvas transparent so the card background shows through', () => {
    const option = buildGoalFlowSankey(response([budgetNode(500, 620)]), 'light', labels, money);
    expect(option.backgroundColor).toBe('transparent');
  });
});
