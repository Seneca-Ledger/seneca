// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardData } from '@/app/hooks/useDashboard';
import '../test-setup';
import { MonthCloseCard } from '../MonthCloseCard';
import { wholeLine } from './whole-line';

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
        notCounted: value('Not counted yet: {amount}'),
        parsing: value('Parsing warnings: {count}'),
        unread: value('Statements that could not be read: {count}'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});

const displayMonth = new Date(2026, 9, 1);

const data: DashboardData = {
  snapshot: {
    totalBalance: 0,
    income30d: 100,
    expense30d: 250,
    netFlow30d: -150,
    totalPayable: 0,
    totalOverdue: 120,
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
    unapprovedCash: -40,
    lastUploadDate: '2026-02-01T00:00:00.000Z',
    parsingWarnings: 3,
  },
};

const renderCard = (dashboard: DashboardData = data) =>
  render(
    <MonthCloseCard
      data={dashboard}
      formatAmount={value => `$${value}`}
      displayMonth={displayMonth}
    />,
  );

describe('MonthCloseCard', () => {
  it('says how far the month in view is from closing', () => {
    renderCard();

    expect(screen.getByText('sections.monthClose')).toBeInTheDocument();
    expect(screen.getByText('October 2026: 1 of 3 done')).toBeInTheDocument();
  });

  it('lists every step once, with what is left and a link to Review for the month', () => {
    renderCard();

    expect(screen.getByText('Without a category: 6')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /actionReview/ })).toHaveAttribute(
      'href',
      '/review?month=2026-10',
    );
    expect(screen.getByRole('link', { name: /actionCategorize/ })).toHaveAttribute(
      'href',
      '/review?uncategorized=true&month=2026-10',
    );
    // A done step carries no action.
    expect(screen.queryByRole('link', { name: /actionMatch/ })).toBeNull();
  });

  it('tells the money still in Review on the review step, even when it is spending', () => {
    renderCard();

    expect(
      screen.getByText(wholeLine('To review: 2 · Not counted yet: −$40')),
    ).toBeInTheDocument();
  });

  it('lists statements worth a look after the steps, and nothing the Overview already shows', () => {
    renderCard({ ...data, dataHealth: { ...data.dataHealth, statementsWithErrors: 1 } });

    expect(screen.getByText('Statements that could not be read: 1')).toBeInTheDocument();
    expect(screen.getByText('Parsing warnings: 3')).toBeInTheDocument();
    // Overdue bills live in Money owed, spending above income in the Net KPI.
    expect(document.body.textContent).not.toMatch(/overdue|overspent/);
    expect(screen.queryByRole('link', { name: /upload/ })).toBeNull();
  });

  it('says the month is ready once every step is done', () => {
    renderCard({
      ...data,
      dataHealth: { ...data.dataHealth, statementsPendingReview: 0, uncategorizedTransactions: 0 },
    });

    expect(screen.getByText('October 2026 is ready to close')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Not counted yet/);
  });
});
