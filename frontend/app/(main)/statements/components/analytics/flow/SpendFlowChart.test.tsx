import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpendFlowChart } from './SpendFlowChart';

const useSpendFlow = vi.fn();
vi.mock('./useSpendFlow', () => ({ useSpendFlow: (...args: unknown[]) => useSpendFlow(...args) }));
vi.mock('@/app/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));
vi.mock('@/app/components/ui/EmptyStateIllustration', () => ({ EmptyStateIllustration: () => null }));
// The stub stands in for the echarts instance: the card only ever reaches it
// through `onChartReady`.
const dispatchAction = vi.fn();
const setOption = vi.fn();
vi.mock('@/app/components/ui/lazy-echarts', () => ({
  LazyECharts: ({ onChartReady }: { onChartReady?: (instance: unknown) => void }) => {
    onChartReady?.({ dispatchAction, setOption });
    return <div data-testid="sankey" />;
  },
}));

const props = {
  groupBy: 'category-merchant' as const,
  type: 'expense' as const,
  month: new Date(2026, 8, 1),
  resolvedTheme: 'light',
  title: 'Where the money goes',
  subtitle: 'From categorized transactions',
  chartLabels: {
    total: 'Total',
    uncategorised: 'Uncategorised',
    unknownMerchant: 'Unnamed',
    otherMerchants: 'Other ({{count}})',
    otherCategories: 'Other categories ({{count}})',
    noSubcategory: 'No subcategory',
  },
  emptyLabels: {
    emptyMonthSpend: 'Nothing spent in {{month}} yet',
    emptyMonthIncome: 'No income in {{month}} yet',
    emptyMonthHint: 'Upload a statement',
  },
  errorLabel: 'Could not load',
};

const flow = {
  total: 10,
  currency: 'EUR',
  type: 'expense',
  dateFrom: '2026-09-01',
  nodes: [
    { id: 'total', kind: 'total', name: null, amount: 10, share: 1, color: null },
    { id: 'cat:a', kind: 'category', name: 'A', amount: 10, share: 1, color: null },
  ],
  links: [{ source: 'total', target: 'cat:a', value: 10 }],
};

describe('SpendFlowChart', () => {
  beforeEach(() => {
    useSpendFlow.mockReset();
    // jsdom has no ResizeObserver; the card only needs it to exist.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blinks only the band a deep link names, never dimming the others', () => {
    vi.useFakeTimers();
    useSpendFlow.mockReturnValue({ data: flow, isError: false });
    dispatchAction.mockReset();
    setOption.mockReset();

    render(<SpendFlowChart {...props} flashNodeName="a" />);
    // Dimming the rest made the largest band flicker, which read as the pick.
    expect(setOption).toHaveBeenLastCalledWith({ series: [{ emphasis: { focus: 'none' } }] });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const calls = dispatchAction.mock.calls.map(([payload]) => payload);
    expect(calls.map(payload => `${payload.type}:${payload.dataType}:${payload.dataIndex}`)).toEqual([
      'highlight:node:1',
      'highlight:edge:0',
      'showTip:node:1',
      'downplay:node:1',
      'downplay:edge:0',
      'highlight:node:1',
      'highlight:edge:0',
      'downplay:node:1',
      'downplay:edge:0',
      'hideTip:node:1',
    ]);
    // Hovering dims the rest again once the blinks are over.
    expect(setOption).toHaveBeenLastCalledWith({ series: [{ emphasis: { focus: 'adjacency' } }] });
  });

  it('does not blink for a category this month has no band for', () => {
    vi.useFakeTimers();
    useSpendFlow.mockReturnValue({ data: flow, isError: false });
    dispatchAction.mockReset();

    render(<SpendFlowChart {...props} flashNodeName="Travel" />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(dispatchAction).not.toHaveBeenCalled();
  });

  it('draws the sankey when there is a flow', () => {
    useSpendFlow.mockReturnValue({ data: flow, isError: false });
    render(<SpendFlowChart {...props} />);
    expect(screen.getByTestId('sankey')).toBeInTheDocument();
    expect(screen.getByText('From categorized transactions')).toBeInTheDocument();
  });

  it('says so when nothing matches the filters', () => {
    useSpendFlow.mockReturnValue({ data: { ...flow, nodes: [], links: [] }, isError: false });
    render(<SpendFlowChart {...props} />);
    expect(screen.getByText(/Nothing spent in .*2026 yet/)).toBeInTheDocument();
    expect(screen.getByText('Upload a statement')).toBeInTheDocument();
  });

  it('shows a sankey-shaped skeleton while loading', () => {
    useSpendFlow.mockReturnValue({ data: undefined, isError: false });
    render(<SpendFlowChart {...props} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('Where the money goes')).toBeInTheDocument();
  });

  it('keeps the skeleton while only the other flow is cached', () => {
    useSpendFlow.mockReturnValue({ data: flow, isError: false });
    render(<SpendFlowChart {...props} type="income" />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByTestId('sankey')).toBeNull();
  });

  it('shows the error instead of a skeleton forever', () => {
    useSpendFlow.mockReturnValue({ data: undefined, isError: true });
    render(<SpendFlowChart {...props} />);
    expect(screen.getByText('Could not load')).toBeInTheDocument();
  });
});
