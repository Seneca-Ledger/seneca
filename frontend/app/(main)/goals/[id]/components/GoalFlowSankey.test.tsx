// @vitest-environment jsdom
import type { GoalFlowResponse } from '@/app/lib/goals-api';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/app/components/dashboard/test-setup';
import { GoalFlowSankey } from './GoalFlowSankey';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
const appLocale = vi.hoisted(() => ({ current: 'en' }));
vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));
// The option the card hands ECharts, so its labels can be read.
const chartOption = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('next/dynamic', () => ({
  default: () => (props: { option: Record<string, unknown> }) => {
    chartOption.current = props.option;
    return <div data-testid="mock-echarts" />;
  },
}));

const labels = {
  otherMerchants: '{{count}} more',
  planned: 'Planned',
  actual: 'Actual',
  overspent: 'Over',
  underspent: 'Under',
};

function response(overrides: Partial<GoalFlowResponse> = {}): GoalFlowResponse {
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
    nodes: [
      {
        id: 'goal:g1',
        kind: 'goal',
        name: 'Renovation',
        planned: 500,
        actual: 620,
        color: null,
      },
      {
        id: 'budget:b1',
        kind: 'budget',
        name: 'Materials',
        planned: 500,
        actual: 620,
        color: null,
      },
    ],
    links: [{ source: 'goal:g1', target: 'budget:b1', value: 620 }],
    budgets: [],
    excluded: { cashAmount: 0, cashEntryCount: 0 },
    ...overrides,
  };
}

describe('GoalFlowSankey', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('renders the chart when the goal has a flow to draw', () => {
    render(
      <GoalFlowSankey
        data={response()}
        title="Plan versus actual"
        emptyLabel="No budget linked"
        labels={labels}
        formatAmount={value => String(value)}
      />,
    );

    expect(screen.getByTestId('mock-echarts')).toBeInTheDocument();
    expect(screen.queryByText('No budget linked')).not.toBeInTheDocument();
  });

  it('shows the empty state instead of a one-node chart', () => {
    render(
      <GoalFlowSankey
        data={response({ links: [] })}
        title="Plan versus actual"
        emptyLabel="No budget linked"
        labels={labels}
        formatAmount={value => String(value)}
      />,
    );

    expect(screen.getByText('No budget linked')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-echarts')).not.toBeInTheDocument();
  });

  it('gives the chart a definite height so ECharts never caches a 0x0 box', () => {
    const { container } = render(
      <GoalFlowSankey
        data={response()}
        title="Plan versus actual"
        emptyLabel="No budget linked"
        labels={labels}
        formatAmount={value => String(value)}
      />,
    );

    const chart = container.querySelector('[data-testid="mock-echarts"]');
    expect(chart).not.toBeNull();
    expect(container.querySelector('.lumio-dashboard__chart')).toBeNull();
  });

  it("labels a system category node in the reader's language, keyed by its id", () => {
    appLocale.current = 'ru';
    const category = {
      id: 'category:c1',
      kind: 'category' as const,
      name: 'Advertising',
      planned: null,
      actual: 620,
      color: null,
    };
    const base = response();
    render(
      <GoalFlowSankey
        data={{ ...base, nodes: [...base.nodes, category] }}
        title="Plan versus actual"
        emptyLabel="No budget linked"
        labels={labels}
        formatAmount={value => String(value)}
      />,
    );

    const series = (chartOption.current?.series as Array<Record<string, unknown>>)[0];
    const label = (series.label as { formatter: (p: unknown) => string }).formatter;
    const tooltip = (chartOption.current?.tooltip as { formatter: (p: unknown) => string })
      .formatter;
    expect(label({ name: 'category:c1' })).toBe('Реклама');
    expect(tooltip({ name: 'category:c1' })).toBe('Реклама<br/>Actual: 620');
    // A budget is named by its owner, not translated.
    expect(label({ name: 'budget:b1' })).toBe('Materials');
    expect((series.data as Array<{ name: string }>).map(node => node.name)).toContain(
      'category:c1',
    );
  });
});
