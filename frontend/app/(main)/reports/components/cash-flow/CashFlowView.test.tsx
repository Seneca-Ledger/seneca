import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashFlowView } from './CashFlowView';
import type { CashFlowMapData } from './useCashFlowMap';

const appLocale = vi.hoisted(() => ({ current: 'en' }));
vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));
const hookMock = vi.hoisted(() => ({ state: {} as Record<string, unknown>, update: vi.fn() }));
vi.mock('./useCashFlowMap', () => ({ useCashFlowMap: () => hookMock.state }));
const sankeyEvents = vi.hoisted(() => ({
  current: {} as Record<string, (params: Record<string, unknown>) => void>,
}));
vi.mock('@/app/components/ui/lazy-echarts', () => ({
  LazyECharts: ({ onEvents }: { onEvents?: typeof sankeyEvents.current }) => {
    sankeyEvents.current = onEvents ?? {};
    return <div data-testid="sankey" />;
  },
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const statementsList = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/query-fn-schema', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/lib/query-fn-schema')>()),
  apiQueryDecoded: statementsList,
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }));
// The owner control reads the household; a workspace of one renders none of it.
vi.mock('@/app/components/transactions/hooks/useWorkspaceMembers', () => ({
  useWorkspaceMembers: () => [],
}));
// The leaderboards under the view are their own components with their own tests.
vi.mock('./CashFlowTab', () => ({
  CashFlowTab: () => <div data-testid="leaderboards" />,
}));
vi.mock('@/app/components/CustomDatePicker', () => ({
  default: ({ label }: { label: string }) => <input aria-label={label} readOnly />,
}));

const data: CashFlowMapData = {
  currency: 'USD',
  period: { from: '2026-09-01', to: '2026-09-30' },
  previousPeriod: { from: '2026-08-02', to: '2026-08-31' },
  includeTransfers: false,
  netRefunds: false,
  missingRates: [],
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
    { id: 'rent', name: 'Rent', icon: null, value: 1000, children: [] },
    {
      id: 'food',
      name: 'Food',
      icon: null,
      value: 400,
      children: [{ id: 'groceries', name: 'Groceries', icon: null, value: 400 }],
    },
  ],
};

describe('CashFlowView', () => {
  beforeEach(() => {
    appLocale.current = 'en';
    hookMock.update.mockReset();
    router.push.mockReset();
    statementsList.mockReset();
    hookMock.state = {
      data,
      isPending: false,
      isFetching: false,
      error: null,
      filters: {
        from: '2026-09-01',
        to: '2026-09-30',
        compare: true,
        compareTo: 'previous',
        includeTransfers: false,
        netRefunds: false,
        categories: [],
      },
      update: hookMock.update,
      exportUrl: '/reports/cash-flow-map?format=csv',
    };
  });

  it('shows totals, the sankey, the categories as a map or a table, and the leaderboards', () => {
    render(<CashFlowView />);

    expect(screen.getByText('Where the money went')).toBeInTheDocument();
    expect(screen.getByTestId('sankey')).toBeInTheDocument();
    expect(screen.getByTestId('treemap-tile-rent')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboards')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    // Food went from 300 to 400: more spending, shown as +100, in grey.
    expect(screen.getAllByText(/\+.*100/).length).toBeGreaterThan(0);
  });

  it('opens the one document behind a sankey category, in the report period', async () => {
    statementsList.mockResolvedValue([{ id: 'statement-1', status: 'completed' }]);
    render(<CashFlowView />);

    sankeyEvents.current.click({ dataType: 'node', name: 'cat:rent' });

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/statements/statement-1/edit'));
    expect(statementsList.mock.calls[0][0].params).toMatchObject({
      categoryId: 'rent',
      transactionsFrom: '2026-09-01',
      transactionsTo: '2026-09-30',
    });
  });

  it('opens the filtered documents from a band, and ignores the income side', async () => {
    statementsList.mockResolvedValue([
      { id: 'statement-1', status: 'completed' },
      { id: 'statement-2', status: 'completed' },
    ]);
    render(<CashFlowView />);

    sankeyEvents.current.click({ dataType: 'node', name: 'total' });
    sankeyEvents.current.click({
      dataType: 'edge',
      data: { source: 'total', target: 'cat:__none__' },
    });

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        '/statements/submit?missingCategory=true&transactionsFrom=2026-09-01&transactionsTo=2026-09-30',
      ),
    );
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(statementsList.mock.calls[0][0].params.categoryId).toBe('uncategorized');
  });

  it("opens subcategories from the map, then a subcategory's documents", async () => {
    statementsList.mockResolvedValue([]);
    render(<CashFlowView />);

    fireEvent.click(screen.getByTestId('treemap-tile-food'));
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('treemap-tile-groceries'));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        '/statements/submit?categoryId=groceries&transactionsFrom=2026-09-01&transactionsTo=2026-09-30',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /All categories/ }));
    expect(screen.getByTestId('treemap-tile-rent')).toBeInTheDocument();
  });

  it('shows the savings rate beside the totals, with the period before', () => {
    render(<CashFlowView />);

    expect(screen.getByText('Savings rate')).toBeInTheDocument();
    // 3000 in, 1400 out: 53%. The period before, 2800 in and 1300 out: 54%.
    expect(screen.getByText('53%')).toBeInTheDocument();
    expect(screen.getByText(/54%/)).toBeInTheDocument();
  });

  it('names the currencies it could not convert, so the totals are not read as complete', () => {
    const missing = ['CHF', 'JPY'];
    hookMock.state = { ...hookMock.state, data: { ...data, missingRates: missing } };
    render(<CashFlowView />);

    expect(screen.getByText(new RegExp(missing.join(', ')))).toBeInTheDocument();
  });

  it('says nothing about rates when every amount converted', () => {
    render(<CashFlowView />);

    expect(screen.queryByText(/exchange rate/i)).toBeNull();
  });

  it('switches the comparison to last year, off, and refunds to netted, from Options', () => {
    render(<CashFlowView />);
    // The menu stays open while its switches are flipped.
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    const pick = (name: RegExp) => fireEvent.click(screen.getByRole('menuitem', { name }));

    pick(/same period last year/);
    expect(hookMock.update).toHaveBeenCalledWith({ compare: true, compareTo: 'year' });
    // The period before is the comparison already: ticking it again turns comparing off.
    pick(/period before/);
    expect(hookMock.update).toHaveBeenCalledWith({ compare: false });
    pick(/Refunds reduce their category/);
    expect(hookMock.update).toHaveBeenCalledWith({ netRefunds: true });
  });

  it('keeps the leaderboards away when nothing moved in the period', () => {
    hookMock.state = {
      ...hookMock.state,
      data: { ...data, income: { total: 0, sources: [] }, expense: { ...data.expense, total: 0 } },
    };
    render(<CashFlowView />);
    expect(screen.queryByTestId('leaderboards')).toBeNull();
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

    // The switches live in Options.
    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Include transfers and investments/ }));
    expect(hookMock.update).toHaveBeenCalledWith({ includeTransfers: true });
  });
});

describe('CashFlowView in the reader\'s language', () => {
  const withAdvertising: CashFlowMapData = {
    ...data,
    availableCategories: [
      { id: 'ads', name: 'Advertising', parentId: null },
      { id: 'rent', name: 'Rent', parentId: null },
    ],
    expense: {
      total: 1400,
      categories: [
        { id: 'rent', name: 'Rent', amount: 1000, previousAmount: 1000, children: [] },
        {
          id: 'ads',
          name: 'Advertising',
          amount: 400,
          previousAmount: 300,
          children: [{ id: 'ads-child', name: 'Advertising', amount: 400, previousAmount: 300 }],
        },
      ],
    },
    treemap: [
      { id: 'rent', name: 'Rent', icon: null, value: 1000, children: [] },
      { id: 'ads', name: 'Advertising', icon: null, value: 400, children: [] },
    ],
  };

  beforeEach(() => {
    appLocale.current = 'ru';
    hookMock.update.mockReset();
    hookMock.state = {
      data: withAdvertising,
      isPending: false,
      isFetching: false,
      error: null,
      filters: {
        from: '2026-09-01',
        to: '2026-09-30',
        compare: true,
        compareTo: 'previous',
        includeTransfers: false,
        netRefunds: false,
        categories: [],
      },
      update: hookMock.update,
      exportUrl: '/reports/cash-flow-map?format=csv',
    };
  });

  it('names system categories in the map and the table in the reader\'s language', () => {
    render(<CashFlowView />);

    const tile = screen.getByTestId('treemap-tile-ads');
    expect(tile).toHaveTextContent('Реклама');
    expect(tile.getAttribute('aria-label')).toMatch(/^Реклама /);

    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    const table = screen.getByRole('table');
    // The category row and its subcategory row.
    expect(within(table).getAllByText('Реклама')).toHaveLength(2);
    expect(within(table).queryByText('Advertising')).toBeNull();
  });

  it('lists the filter options translated and still filters by category id', () => {
    render(<CashFlowView />);

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Реклама' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(hookMock.update).toHaveBeenCalledWith({ categories: ['rent'] });
  });
});
