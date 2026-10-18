// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '@/app/hooks/useDashboard';
import '../test-setup';
import { FinanceOpsTab } from '../FinanceOpsTab';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./intlayer-mock');
  return {
    useIntlayer: () =>
      autoDictionary({
        headline: value('{month}: {done} of {total} done'),
        headlineDone: value('{month} is ready to close'),
        leftToReview: value('To review: {count}'),
        leftUncategorized: value('Without a category: {count}'),
        overdue: value('Overdue payments: {count} · {amount}'),
        parsing: value('Parsing warnings: {count}'),
        unread: value('Statements that could not be read: {count}'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});

const displayMonth = new Date(2026, 9, 1);

const renderTab = (dashboard: DashboardData = data) =>
  render(
    <FinanceOpsTab data={dashboard} formatAmount={value => `$${value}`} displayMonth={displayMonth} />,
  );

const data: DashboardData = {
  snapshot: {
    totalBalance: 0,
    income30d: 0,
    expense30d: 0,
    netFlow30d: 0,
    totalPayable: 0,
    totalOverdue: 0,
    unapprovedCash: 0,
    currency: 'KZT',
    missingRates: [],
  },
  actions: [
    { type: 'payments_overdue', count: 2, label: 'Overdue payments', href: '/statements/pay' },
  ],
  cashFlow: [],
  topMerchants: [],
  topCategories: [],
  recentTransactions: [],
  role: 'owner',
  range: 'month',
  dataHealth: {
    uncategorizedTransactions: 6,
    statementsWithErrors: 0,
    statementsPendingReview: 2,
    statementsPendingSubmit: 1,
    receiptsPendingReview: 0,
    unapprovedCash: 0,
    lastUploadDate: '2026-02-01T00:00:00.000Z',
    parsingWarnings: 3,
  },
};

describe('FinanceOpsTab', () => {
  it('says how far the month is from closing', () => {
    renderTab();

    expect(screen.getByRole('heading', { name: 'October 2026: 1 of 3 done' })).toBeInTheDocument();
  });

  it('lists every step once, with what is left and a link to Review for the month', () => {
    renderTab();

    expect(screen.getByText('To review: 2')).toBeInTheDocument();
    expect(screen.getByText('Without a category: 6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /actionReview/ })).toHaveAttribute(
      'href',
      '/review?month=2026-10',
    );
    expect(screen.getByRole('link', { name: /actionCategorize/ })).toHaveAttribute(
      'href',
      '/review?uncategorized=true&month=2026-10',
    );
    // Done steps carry no action; there is no step for sending statements anywhere.
    expect(screen.queryByRole('link', { name: /actionMatch/ })).toBeNull();
    expect(screen.queryByText(/submitted/i)).toBeNull();
  });

  it('lists statements that could not be read as needing attention, not as review', () => {
    renderTab({ ...data, dataHealth: { ...data.dataHealth, statementsWithErrors: 1 } });

    expect(screen.getByText('To review: 2')).toBeInTheDocument();
    expect(screen.getByText('Statements that could not be read: 1')).toBeInTheDocument();
  });

  it('shows what else needs attention only when there is something', () => {
    const { unmount } = renderTab();
    expect(screen.getByText('Overdue payments: 2 · $0')).toBeInTheDocument();
    expect(screen.getByText('Parsing warnings: 3')).toBeInTheDocument();
    unmount();

    renderTab({
      ...data,
      actions: [],
      dataHealth: { ...data.dataHealth, parsingWarnings: 0 },
    });
    expect(screen.queryByText('attentionTitle')).toBeNull();
  });

  it('says the month is ready once every step is done', () => {
    renderTab({
      ...data,
      dataHealth: { ...data.dataHealth, statementsPendingReview: 0, uncategorizedTransactions: 0 },
    });

    expect(screen.getByRole('heading', { name: 'October 2026 is ready to close' })).toBeInTheDocument();
  });

  it('puts the statement upload in a quiet button', () => {
    renderTab();

    expect(screen.getByRole('link', { name: /upload/ })).toHaveAttribute(
      'href',
      '/statements?openExpenseDrawer=scan',
    );
  });
});
