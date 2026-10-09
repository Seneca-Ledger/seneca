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
        uploadParse: value('Upload / Parse'),
        reviewQueue: value('Review Queue ({count})'),
        dataQualityMetrics: value('Data quality metrics'),
        uncategorizedLabel: value('Uncategorized'),
        statementErrorsLabel: value('Statement errors'),
        pendingReviewLabel: value('Pending review'),
        receiptsPendingLabel: value('Receipts pending'),
        parsingWarningsLabel: value('Parsing warnings'),
        allGood: value('All good'),
        metricNeedsAttention: value('{value} need attention'),
        lastUpload: value('Last upload'),
        unapprovedCash: value('Unapproved cash'),
        allCashApproved: value('All cash approved'),
        reviewApproveCash: value('Review & approve cash'),
        actionRequired: value('Action required'),
        quickLinkUncategorized: value('Review {count} uncategorized transactions'),
        quickLinkStatementErrors: value('Fix {count} statement errors'),
        quickLinkPendingStatements: value('Review {count} pending statements'),
        quickLinkReceipts: value('Review {count} receipts'),
      }),
    useLocale: () => ({ locale: 'en' }),
  };
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
    renderTab({
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 0,
      unapprovedCash: 0,
      lastUploadDate: '2025-05-31T00:00:00.000Z',
      parsingWarnings: 0,
    });

    expect(screen.getByTestId('monthly-history')).toBeInTheDocument();
    expect(historyProps).toHaveBeenLastCalledWith({
      displayMonth,
      metrics: DATA_HEALTH_HISTORY_METRICS,
      onSelectMonth,
    });
  });

  it('renders each metric as a linked KPI card with a severity tone', () => {
    renderTab({
      uncategorizedTransactions: 2,
      statementsWithErrors: 1,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 0,
      unapprovedCash: 0,
      lastUploadDate: '2025-05-31T00:00:00.000Z',
      parsingWarnings: 0,
    });

    const uncategorized = screen.getByRole('link', { name: /Uncategorized/ });
    expect(uncategorized.getAttribute('href')).toBe('/statements/submit?categoryId=uncategorized');
    expect(uncategorized.querySelector('.lumio-dashboard__stat-value--warning')).not.toBeNull();

    const errors = screen.getByRole('link', { name: /Statement errors/ });
    expect(errors.querySelector('.lumio-dashboard__stat-value--negative')).not.toBeNull();

    const pending = screen.getByRole('link', { name: /Pending review/ });
    expect(pending.querySelector('.lumio-dashboard__stat-value--positive')).not.toBeNull();
    expect(pending.textContent).toContain('All good');

    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review Queue (0)' })).toBeInTheDocument();
  });

  it('renders receipts pending metric and action link', () => {
    renderTab({
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 2,
      unapprovedCash: 0,
      lastUploadDate: '2025-05-31T00:00:00.000Z',
      parsingWarnings: 0,
    });

    expect(screen.getByText(/receipts pending/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review 2 receipts/i })).toBeInTheDocument();
    expect(screen.getByText('May 31, 2025')).toBeInTheDocument();
  });

  it('shows unapproved cash as a warning with a review link, and the empty-upload CTA', () => {
    renderTab({
      uncategorizedTransactions: 0,
      statementsWithErrors: 0,
      statementsPendingReview: 0,
      statementsPendingSubmit: 0,
      receiptsPendingReview: 0,
      unapprovedCash: 1500,
      lastUploadDate: null,
      parsingWarnings: 0,
    });

    expect(screen.getByText('$1500').className).toContain('lumio-dashboard__stat-value--warning');
    expect(screen.getByRole('link', { name: /Review & approve cash/ })).toHaveAttribute(
      'href',
      '/review',
    );
    expect(screen.getByRole('link', { name: 'uploadFirstStatement' })).toHaveAttribute(
      'href',
      '/statements/submit',
    );
    expect(screen.queryByText('Action required')).not.toBeInTheDocument();
  });
});
