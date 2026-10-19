// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import '../test-setup';
import { DataHealthTab } from '../DataHealthTab';

type DataHealthTabData = React.ComponentProps<typeof DataHealthTab>['data'];

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/lib/user-format-store', () => ({
  formatStoredDateWithOptions: () => 'May 31, 2025',
}));

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

vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./intlayer-mock');
  return {
    useIntlayer: () =>
      autoDictionary({
        summaryAttention: value('{month}: {count} of {total} need attention'),
        summaryClear: value('{month}: all clear'),
        uncategorizedLabel: value('Uncategorized'),
        statementErrorsLabel: value('Statement errors'),
        pendingReviewLabel: value('Records to review'),
        receiptsPendingLabel: value('Receipts to check'),
        parsingWarningsLabel: value('Parsing warnings'),
        allGood: value('All clear'),
        notCountedHint: value('Income less spending in records still in review'),
        allConfirmed: value('Every record is confirmed'),
        actionReview: value('Review'),
        actionCategorize: value('Categorize'),
        actionMatch: value('Match'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
});

const health = (fields: Partial<DataHealthTabData['dataHealth']> = {}) => ({
  uncategorizedTransactions: 0,
  statementsWithErrors: 0,
  statementsPendingReview: 0,
  statementsPendingSubmit: 0,
  receiptsPendingReview: 0,
  unapprovedCash: 0,
  lastUploadDate: '2025-05-31T00:00:00.000Z',
  parsingWarnings: 0,
  ...fields,
});

function renderTab(dataHealth: DataHealthTabData['dataHealth']): void {
  render(
    <DataHealthTab
      data={{ dataHealth } as DataHealthTabData}
      formatAmount={v => `$${v}`}
      displayMonth={displayMonth}
      onSelectMonth={onSelectMonth}
    />,
  );
}

describe('DataHealthTab', () => {
  it('shows the by-month history for the picked month with the data-quality metrics', async () => {
    const { DATA_HEALTH_HISTORY_METRICS } = await import('../MonthlyHistoryCard');
    renderTab(health());

    expect(screen.getByTestId('monthly-history')).toBeInTheDocument();
    expect(historyProps).toHaveBeenLastCalledWith({
      displayMonth,
      metrics: DATA_HEALTH_HISTORY_METRICS,
      onSelectMonth,
    });
  });

  it('sums the month up in one line and names the checks that are clear', () => {
    renderTab(health({ uncategorizedTransactions: 6, statementsPendingReview: 2 }));

    expect(
      screen.getByRole('heading', { name: 'July 2026: 2 of 5 need attention' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('All clear: Statement errors · Receipts to check · Parsing warnings'),
    ).toBeInTheDocument();
  });

  it('lists each open check once, with where to do it', () => {
    renderTab(health({ uncategorizedTransactions: 6, receiptsPendingReview: 2 }));

    expect(screen.getByText('Uncategorized: 6')).toBeInTheDocument();
    // Each count is Review's list for the month, so each link opens that list.
    expect(screen.getByRole('link', { name: /Categorize/ })).toHaveAttribute(
      'href',
      '/review?uncategorized=true&month=2026-07',
    );
    expect(screen.getByRole('link', { name: /Match/ })).toHaveAttribute(
      'href',
      '/review?kind=receipt&month=2026-07',
    );
    expect(screen.queryByText('Statement errors: 0')).toBeNull();
    expect(screen.getByText('May 31, 2025')).toBeInTheDocument();
  });

  it('shows the money not counted yet while Review has rows, even when it is spending', () => {
    renderTab(health({ statementsPendingReview: 2, unapprovedCash: -19.63, lastUploadDate: null }));

    expect(screen.getByText('−$19.63')).toBeInTheDocument();
    expect(screen.getByText(/Income less spending in records still in review/)).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: /Review/ })
        .every(link => link.getAttribute('href') === '/review?month=2026-07'),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'uploadFirstStatement' })).toHaveAttribute(
      'href',
      '/statements/submit',
    );
  });

  it('says every record is confirmed and the month is clear when nothing waits', () => {
    renderTab(health());

    expect(screen.getByRole('heading', { name: 'July 2026: all clear' })).toBeInTheDocument();
    expect(screen.getByText('Every record is confirmed')).toBeInTheDocument();
    expect(screen.queryByText('actionRequired')).toBeNull();
  });
});
