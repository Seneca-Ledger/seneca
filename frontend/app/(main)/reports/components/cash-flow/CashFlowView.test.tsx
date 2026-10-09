import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashFlowView } from './CashFlowView';
import type { CashFlowMapData } from './useCashFlowMap';

const hookMock = vi.hoisted(() => ({ state: {} as Record<string, unknown>, update: vi.fn() }));
vi.mock('./useCashFlowMap', () => ({ useCashFlowMap: () => hookMock.state }));
vi.mock('@/app/components/ui/lazy-echarts', () => ({
  LazyECharts: () => <div data-testid="sankey" />,
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
// The owner control reads the household; a workspace of one renders none of it.
vi.mock('@/app/components/transactions/hooks/useWorkspaceMembers', () => ({
  useWorkspaceMembers: () => [],
}));
vi.mock('@/app/components/CustomDatePicker', () => ({
  default: ({ label }: { label: string }) => <input aria-label={label} readOnly />,
}));

const data: CashFlowMapData = {
  currency: 'USD',
  period: { from: '2026-09-01', to: '2026-09-30' },
  previousPeriod: { from: '2026-08-02', to: '2026-08-31' },
  includeTransfers: false,
  availableCategories: [
    { id: 'food', name: 'Food', parentId: null },
    { id: 'groceries', name: 'Groceries', parentId: 'food' },
    { id: 'rent', name: 'Rent', parentId: null },
  ],
  income: { total: 3000, sources: [{ name: 'ACME', amount: 3000 }] },
  expense: {
    total: 1400,
    categories: [
      { id: 'rent', name: 'Rent', amount: 1000, previousAmount: 1000, children: [] },
      {
        id: 'food',
        name: 'Food',
        amount: 400,
        previousAmount: 300,
        children: [{ id: 'groceries', name: 'Groceries', amount: 400, previousAmount: 300 }],
      },
    ],
  },
  transfers: 0,
  net: 1600,
  previous: { income: 2800, expense: 1300, net: 1500 },
  sankey: {
    nodes: [
      { id: 'total', name: 'Income', kind: 'total' },
      { id: 'cat:rent', name: 'Rent', kind: 'category' },
    ],
    links: [{ source: 'total', target: 'cat:rent', value: 1000 }],
  },
  treemap: [
    { id: 'rent', name: 'Rent', value: 1000, children: [] },
    { id: 'food', name: 'Food', value: 400, children: [{ id: 'groceries', name: 'Groceries', value: 400 }] },
  ],
};

describe('CashFlowView', () => {
  beforeEach(() => {
    hookMock.update.mockReset();
    hookMock.state = {
      data,
      isPending: false,
      isFetching: false,
      error: null,
      filters: { from: '2026-09-01', to: '2026-09-30', compare: true, includeTransfers: false, categories: [] },
      update: hookMock.update,
      exportUrl: '/reports/cash-flow-map?format=csv',
    };
  });

  it('shows totals, the sankey, the treemap and a comparison with deltas', () => {
    render(<CashFlowView />);

    expect(screen.getByText('Where the money went')).toBeInTheDocument();
    expect(screen.getByTestId('sankey')).toBeInTheDocument();
    expect(screen.getByTestId('treemap-tile-rent')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    // Food went from 300 to 400: more spending, shown as +100.
    expect(screen.getAllByText(/\+.*100/).length).toBeGreaterThan(0);
  });

  it('filters categories from a dropdown list applied on Apply, and toggles transfers', () => {
    render(<CashFlowView />);
    const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /Filters/ }));

    // Untick Rent: nothing changes until Apply.
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Rent' }));
    expect(hookMock.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(hookMock.update).toHaveBeenCalledWith({ categories: ['food'] });

    // Untick everything: nothing passes the filter.
    openFilters();
    fireEvent.click(screen.getByRole('button', { name: 'Rent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(hookMock.update).toHaveBeenCalledWith({ categories: ['__none__'] });

    fireEvent.click(screen.getByLabelText('Include transfers and investments'));
    expect(hookMock.update).toHaveBeenCalledWith({ includeTransfers: true });
  });
});
