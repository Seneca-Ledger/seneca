import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsTable from './TransactionsTable';
import type { Category, FilterState, Transaction } from './types';

const viewportState = vi.hoisted(() => ({ isMobile: true }));

vi.mock('@/app/hooks/useIsMobile', () => ({
  useIsMobile: () => viewportState.isMobile,
}));

vi.mock('@/app/contexts/CurrencyDisplayContext', () => ({
  useCurrencyDisplay: () => ({
    showConverted: false,
    toggleShowConverted: () => undefined,
    workspaceCurrency: 'KZT',
  }),
}));

const token = (value: string) => ({ value });

vi.mock('next-intlayer', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    searchPlaceholder: token('Search'),
    filters: token('Filters'),
    statusFilter: token('Status'),
    statusAll: token('All'),
    statusWarnings: token('With Warnings'),
    statusErrors: token('With Errors'),
    statusUncategorized: token('Uncategorized'),
    categoryFilter: token('Category'),
    categoryAll: token('All Categories'),
    clearFilters: token('Clear'),
    columnDate: token('Date'),
    columnCounterparty: token('Counterparty'),
    columnBin: token('BIN'),
    columnPurpose: token('Purpose'),
    columnDebit: token('Debit'),
    columnCredit: token('Credit'),
    columnCategory: token('Category'),
    noResults: token('No transactions found'),
    rowsPerPage: token('Rows per page:'),
    of: token('of'),
    previous: token('Previous'),
    next: token('Next'),
  }),
}));

const transactions: Transaction[] = [
  {
    id: 'tx-1',
    transactionDate: '2026-02-01T00:00:00.000Z',
    counterpartyName: 'Coffee Shop',
    paymentPurpose: 'Morning coffee',
    debit: 450,
    credit: 0,
    amount: 450,
    transactionType: 'expense',
    currency: 'KZT',
    category: {
      id: 'food',
      name: 'Food',
      color: '#22c55e',
      isEnabled: true,
    },
  },
];

const categories: Category[] = [
  {
    id: 'food',
    name: 'Food',
    type: 'expense',
    color: '#22c55e',
    isEnabled: true,
  },
];

const filters: FilterState = {
  search: '',
  status: 'all',
  category: null,
};

describe('TransactionsTable mobile view', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    viewportState.isMobile = true;
  });

  it('renders mobile cards when viewport is mobile', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TransactionsTable
          transactions={transactions}
          categories={categories}
          selectedIds={[]}
          onSelectRows={() => undefined}
          onRowClick={() => undefined}
          filters={filters}
          onFilterChange={() => undefined}
        />,
      );
    });

    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('[data-testid="transaction-card-tx-1"]')).toBeTruthy();
  });

  it('renders desktop table when viewport is not mobile', async () => {
    viewportState.isMobile = false;
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TransactionsTable
          transactions={transactions}
          categories={categories}
          selectedIds={[]}
          onSelectRows={() => undefined}
          onRowClick={() => undefined}
          filters={filters}
          onFilterChange={() => undefined}
        />,
      );
    });

    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('[data-testid="transaction-card-tx-1"]')).toBeNull();
  });

  it('marks only the rows nobody confirmed yet, on desktop and mobile', async () => {
    const rows: Transaction[] = [
      { ...transactions[0], id: 'tx-open', isVerified: false },
      { ...transactions[0], id: 'tx-open-too', isVerified: false },
      { ...transactions[0], id: 'tx-done', isVerified: true },
    ];
    for (const isMobile of [false, true]) {
      viewportState.isMobile = isMobile;
      const container = document.createElement('div');
      const root = createRoot(container);

      await act(async () => {
        root.render(
          <TransactionsTable
            transactions={rows}
            categories={categories}
            selectedIds={[]}
            onSelectRows={() => undefined}
            onRowClick={() => undefined}
            filters={filters}
            onFilterChange={() => undefined}
          />,
        );
      });

      expect(container.querySelectorAll('[data-testid="unconfirmed-badge"]')).toHaveLength(2);
    }
  });
});
