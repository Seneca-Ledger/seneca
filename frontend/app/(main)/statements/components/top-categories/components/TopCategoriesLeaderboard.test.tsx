import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TopCategoryAggregateRow } from '@/app/(main)/statements/components/top-categories.utils';
import { TopCategoriesDrillDown } from './TopCategoriesDrillDown';
import { TopCategoriesLeaderboard } from './TopCategoriesLeaderboard';

const appLocale = vi.hoisted(() => ({ current: 'en' }));
vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

vi.mock('@/app/lib/user-format-store', () => ({
  formatStoredDate: (value: string) => value,
}));

function row(overrides: Partial<TopCategoryAggregateRow>): TopCategoryAggregateRow {
  return {
    id: 'spend:statement:EUR:marketing and advertising',
    category: 'Marketing and advertising',
    sourceType: 'statement',
    sourceChannel: 'statement',
    flowType: 'spend',
    count: 3,
    total: 210,
    average: 70,
    lastDate: '2026-09-20',
    currency: 'EUR',
    ...overrides,
  } as TopCategoryAggregateRow;
}

const sourceLabels = {
  sourceBank: 'Bank',
  sourceReceipt: 'Receipt',
  sourceCrypto: 'Crypto',
};

function renderLeaderboard(
  rows: TopCategoryAggregateRow[],
  onRowClick = vi.fn(),
  extra: { nameOf?: (name: string) => string; attentionPrefix?: string } = {},
) {
  return render(
    <TopCategoriesLeaderboard
      {...extra}
      rows={rows}
      sortKey="amount"
      onSortChange={vi.fn()}
      onRowClick={onRowClick}
      title="Top categories"
      currency="EUR"
      sourceLabels={sourceLabels}
      sortLabels={{ sortByAmount: 'Amount', sortByAverage: 'Average', sortByOperations: 'Ops' }}
      columnLabels={{
        category: 'Category',
        source: 'Source',
        operations: 'Operations',
        average: 'Average',
        amount: 'Amount',
        lastOperation: 'Last',
      }}
      emptyLabel="No data"
    />,
  );
}

describe('TopCategoriesLeaderboard', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('marks each row as a focus target keyed by category name', () => {
    // `?focus=category:<name>` from an insight has to find the row; aggregate
    // row ids carry no category id, so the name is the only shared handle.
    const { container } = renderLeaderboard([row({}), row({ id: 'b', category: 'Travel' })]);

    expect(
      container.querySelector('tr[data-attention="category:marketing and advertising"]'),
    ).not.toBeNull();
    expect(container.querySelector('tr[data-attention="category:travel"]')).not.toBeNull();
  });

  it('puts the larger row first so the deep link lands on it', () => {
    // The hook takes the first match in document order.
    const { container } = renderLeaderboard([
      row({ id: 'big', total: 900 }),
      row({ id: 'small', sourceChannel: 'receipt', total: 40 }),
    ]);

    const matches = container.querySelectorAll(
      'tr[data-attention="category:marketing and advertising"]',
    );
    expect(matches).toHaveLength(2);
    expect(matches[0]?.textContent).toContain('900');
  });
});

describe('top categories in the reader\'s language', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('shows a system category translated while the row stays keyed by its stored name', () => {
    appLocale.current = 'ru';
    const onRowClick = vi.fn();
    const advertising = row({ id: 'spend:statement:EUR:advertising', category: 'Advertising' });
    const { container } = renderLeaderboard([advertising], onRowClick);

    expect(screen.getByRole('button', { name: 'Реклама' })).toBeInTheDocument();
    expect(screen.queryByText('Advertising')).toBeNull();
    // Deep links and the drill-down still find the row by what is stored.
    expect(container.querySelector('tr[data-attention="category:advertising"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Реклама' }));
    expect(onRowClick).toHaveBeenCalledWith('spend:statement:EUR:advertising');
  });

  it('names the drill-down after the translated category', () => {
    appLocale.current = 'ru';
    render(
      <TopCategoriesDrillDown
        selectedRow={row({ category: 'Advertising' })}
        drillDownRecords={[]}
        onClose={vi.fn()}
        currency="EUR"
        sourceLabels={sourceLabels}
        labels={{
          drillDown: 'operations',
          close: 'Close',
          noOperations: 'None',
          lastOperation: 'Last',
          source: 'Source',
          workspace: 'Workspace',
          amount: 'Amount',
        }}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Реклама - operations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Реклама - operations' })).toBeInTheDocument();
  });

  it('shows tag rows as written and keys them by their own focus prefix', () => {
    appLocale.current = 'ru';
    // A tag that happens to share a system category's name stays the user's word.
    const tag = row({ id: 'spend:statement:EUR:advertising', category: 'Advertising' });
    const { container } = renderLeaderboard([tag], vi.fn(), {
      nameOf: name => name,
      attentionPrefix: 'tag:',
    });

    expect(screen.getByRole('button', { name: 'Advertising' })).toBeInTheDocument();
    expect(container.querySelector('tr[data-attention="tag:advertising"]')).not.toBeNull();
    expect(container.querySelector('tr[data-attention="category:advertising"]')).toBeNull();
  });
});
