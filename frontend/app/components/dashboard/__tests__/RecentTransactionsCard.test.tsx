// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { RecentTransactionsCard } from '../RecentTransactionsCard';
import { SectionSpanProvider } from '../section-span';

// Mirrors react-intlayer's renderIntlayerNode: a Proxy over a rendered
// Fragment whose `.value` is intercepted to return the plain string, so the
// mock is usable both as a JSX child and via `.value` string access.
const value = (v: string) =>
  // biome-ignore lint/complexity/noUselessFragments: Proxy needs an object target — a bare string can't be proxied
  new Proxy(<>{v}</>, {
    get(target, prop, receiver) {
      if (prop === 'value') return v;
      return Reflect.get(target, prop, receiver);
    },
  });

const appLocale = vi.hoisted(() => ({ current: 'en' }));

// The item picture fetches on its own and has its own tests; here the category badge shows.
vi.mock('@/app/components/item-images/ItemImageBadge', () => ({
  ItemImageBadge: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    title: value('Recent transactions'),
    viewAll: value('All transactions'),
    empty: value('No transactions this period'),
    uncategorized: value('Uncategorized'),
  }),
  useLocale: () => ({ locale: appLocale.current }),
}));

describe('RecentTransactionsCard', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('shows the empty state and still renders the deep link when there are no transactions', () => {
    render(
      <RecentTransactionsCard
        transactions={[]}
        formatAmount={v => `$${v}`}
        viewAllHref="/statements/transactions?startDate=2026-03-01&endDate=2026-03-31"
      />,
    );

    expect(screen.getByText('No transactions this period')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /all transactions/i });
    expect(link.getAttribute('href')).toBe(
      '/statements/transactions?startDate=2026-03-01&endDate=2026-03-31',
    );
  });

  it('shows a signed amount and date/account line for each transaction', () => {
    // Half a row: the date and account share the line under the name.
    render(
      <SectionSpanProvider value={6}>
      <RecentTransactionsCard
        transactions={[
          {
            id: 'tx-1',
            description: 'Salary',
            amount: 150000,
            currency: 'KZT',
            date: '2026-03-10',
            account: 'Kaspi •••• 4821',
            categoryId: 'cat-1',
            categoryName: 'Salary',
            categoryColor: '#10b981',
            categoryIcon: null,
            href: '/statements/st-1/edit',
          },
          {
            id: 'tx-2',
            description: 'Grocery Store',
            amount: -5000,
            currency: 'KZT',
            date: '2026-03-09',
            account: 'Bank',
            categoryId: null,
            categoryName: null,
            categoryColor: '#898781',
            categoryIcon: null,
            href: '/storage/receipts/rc-1',
          },
        ]}
        formatAmount={v => (v < 0 ? `-$${Math.abs(v)}` : `$${v}`)}
        viewAllHref="/statements/transactions"
      />
      </SectionSpanProvider>,
    );

    expect(screen.getByText('Salary')).toBeInTheDocument();
    expect(screen.getByText('+$150000')).toBeInTheDocument();
    expect(screen.getByText('Grocery Store')).toBeInTheDocument();
    expect(screen.getByText('-$5000')).toBeInTheDocument();
    expect(screen.getByText(/Kaspi •••• 4821/)).toBeInTheDocument();
    // Each row opens the document its transaction lives in.
    expect(screen.getByText('Salary').closest('a')?.getAttribute('href')).toBe(
      '/statements/st-1/edit',
    );
    expect(screen.getByText('Grocery Store').closest('a')?.getAttribute('href')).toBe(
      '/storage/receipts/rc-1',
    );
  });

  it('leaves a transaction entered by hand unclickable: it has no document to open', () => {
    render(
      <SectionSpanProvider value={6}>
        <RecentTransactionsCard
          transactions={[
            {
              id: 'tx-manual',
              description: 'Sold Mac Mini M4',
              amount: 1132,
              currency: 'USD',
              date: '2026-10-16',
              account: 'Bank',
              categoryId: null,
              categoryName: null,
              categoryColor: '#898781',
              categoryIcon: null,
              href: null,
            },
          ]}
          formatAmount={v => `$${v}`}
          viewAllHref="/statements/transactions"
        />
      </SectionSpanProvider>,
    );

    expect(screen.getByText('Sold Mac Mini M4').closest('a')).toBeNull();
  });

  it('lists six at half width, and all with category and account columns at full width', () => {
    const transactions = Array.from({ length: 12 }, (_, index) => ({
      id: `tx-${index}`,
      description: `Shop ${index}`,
      amount: -10,
      currency: 'USD',
      date: '2026-03-09',
      account: 'Kaspi •••• 4821',
      categoryId: 'cat-1',
      categoryName: 'Groceries',
      categoryColor: '#10b981',
      categoryIcon: null,
      href: `/storage/receipts/rc-${index}`,
    }));
    const card = (
      <RecentTransactionsCard
        transactions={transactions}
        formatAmount={v => `$${v}`}
        viewAllHref="/statements/transactions"
      />
    );
    const { rerender } = render(<SectionSpanProvider value={6}>{card}</SectionSpanProvider>);
    expect(screen.getAllByText(/^Shop /)).toHaveLength(6);
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument();

    rerender(<SectionSpanProvider value={12}>{card}</SectionSpanProvider>);
    expect(screen.getAllByText(/^Shop /)).toHaveLength(12);
    expect(screen.getAllByText('Groceries')).toHaveLength(12);
  });

  it("names a system category in the reader's language in its column and tooltip", () => {
    appLocale.current = 'ru';
    const { container } = render(
      <SectionSpanProvider value={12}>
        <RecentTransactionsCard
          transactions={[
            {
              id: 'tx-1',
              description: 'Google Ads',
              amount: -40,
              currency: 'USD',
              date: '2026-03-09',
              account: 'Bank',
              categoryId: 'cat-1',
              categoryName: 'Advertising',
              categoryColor: '#10b981',
              categoryIcon: null,
              href: '/statements/st-1/edit',
            },
          ]}
          formatAmount={v => `$${v}`}
          viewAllHref="/statements/transactions"
        />
      </SectionSpanProvider>,
    );

    expect(screen.getByText('Реклама')).toBeInTheDocument();
    expect(container.querySelector('[title="Реклама"]')).not.toBeNull();
    expect(screen.queryByText('Advertising')).not.toBeInTheDocument();
  });
});
