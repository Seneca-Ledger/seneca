import type { DashboardData } from '@/app/hooks/useDashboard';
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
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
        title: value('Quick actions'),
        noActionsNeeded: value('No actions needed'),
        itemsToReview: value('{count} items to review'),
        parsingIssuesFound: value('Parsing issues found'),
        uploadDropTitle: value('Drop a statement here'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});

const historyProps = vi.hoisted(() => vi.fn<(props: Record<string, unknown>) => void>());

vi.mock('../MonthlyHistoryCard', async () => {
  const actual = await vi.importActual<typeof import('../MonthlyHistoryCard')>(
    '../MonthlyHistoryCard',
  );
  return {
    ...actual,
    MonthlyHistoryCard: (props: Record<string, unknown>) => {
      historyProps(props);
      return <div data-testid="monthly-history" />;
    },
  };
});

const onSelectMonth = vi.fn();
const displayMonth = new Date(2026, 6, 1);

const renderTab = () =>
  render(
    <FinanceOpsTab
      data={data}
      formatAmount={value => String(value)}
      displayMonth={displayMonth}
      onSelectMonth={onSelectMonth}
    />,
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
    uncategorizedTransactions: 0,
    statementsWithErrors: 0,
    statementsPendingReview: 0,
    statementsPendingSubmit: 0,
    receiptsPendingReview: 0,
    unapprovedCash: 0,
    lastUploadDate: '2026-02-01T00:00:00.000Z',
    parsingWarnings: 3,
  },
};

describe('FinanceOpsTab', () => {
  it('shows the by-month history for the picked month with the finance-ops queues', async () => {
    const { FINANCE_OPS_HISTORY_METRICS } = await import('../MonthlyHistoryCard');
    renderTab();

    expect(screen.getByTestId('monthly-history')).toBeInTheDocument();
    expect(historyProps).toHaveBeenLastCalledWith({
      displayMonth,
      metrics: FINANCE_OPS_HISTORY_METRICS,
      onSelectMonth,
    });
  });

  it('hosts the quick actions card with backend and parsing rows', () => {
    renderTab();

    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    const overdue = screen.getByRole('link', { name: /overdue payments/i });
    expect(overdue.getAttribute('href')).toBe('/statements/pay');
    expect(overdue.textContent).toContain('2 items to review');
    const parsing = screen.getByRole('link', { name: /parsing issues found/i });
    expect(parsing.getAttribute('href')).toBe('/statements?filter=has_errors');
  });

  it('hosts the upload drop zone linking to the scanner', () => {
    renderTab();

    const zone = screen.getByRole('link', { name: /drop a statement here/i });
    expect(zone.getAttribute('href')).toBe('/statements?openExpenseDrawer=scan');
  });

  it('renders the checklist rows as links, saved-view chips with counts and status pills', () => {
    renderTab();

    const checklist = screen.getByRole('link', { name: /checklist\.statementsImported/ });
    expect(checklist.getAttribute('href')).toBeTruthy();
    const savedView = screen.getByRole('link', { name: /savedViews\.uncategorized/ });
    expect(savedView.className).toContain('lumio-chip');
    expect(savedView.querySelector('.lumio-chip__count')).not.toBeNull();
    const pills = ['statusReady', 'statusReview', 'statusBlocked'].flatMap(label =>
      screen.queryAllByText(label),
    );
    expect(pills.length).toBeGreaterThan(0);
    expect(pills[0].className).toContain('lumio-chip--tone-');
    expect(screen.getByText('featuresTitle')).toBeInTheDocument();
  });
});
