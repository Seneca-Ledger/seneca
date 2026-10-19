import { fireEvent, render, screen } from '@testing-library/react';
// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/app/test/setup';
import DashboardPage from './page';

const replace = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const effectivePeriod = vi.hoisted(() => ({ current: null as string | null }));

const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));

// Reads the Review counts through React Query; its own test covers it.
vi.mock('@/app/components/review/UnconfirmedNotice', () => ({ UnconfirmedNotice: () => null }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard',
  useSearchParams: () => searchParams.current,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@mui/material', () => ({
  Tabs: ({
    children,
    value,
  }: {
    children?: React.ReactNode;
    value: string;
  }) => (
    <div data-testid="tabs" data-active={value}>
      {children}
    </div>
  ),
  Tab: ({ label, value }: { label: React.ReactNode; value: string }) => (
    <button type="button" data-value={value}>
      {label}
    </button>
  ),
}));

vi.mock('@/app/components/icons', () => ({
  CheckCircle2: () => <span data-testid="check-circle-icon" />,
  CircleAlert: () => <span data-testid="circle-alert-icon" />,
  ExternalLink: () => <span data-testid="external-link-icon" />,
  ListChecks: () => <span data-testid="list-checks-icon" />,
  RefreshCcw: () => <span data-testid="refresh-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
  ArrowRight: () => <span data-testid="arrow-right-icon" />,
  ChevronLeft: () => <span data-testid="chevron-left-icon" />,
  ChevronRight: () => <span data-testid="chevron-right-icon" />,
}));

vi.mock('@/app/components/ui/spinner', () => ({
  Spinner: () => <div>spinner</div>,
}));

vi.mock('@/app/components/dashboard/FinanceOpsTab', () => ({
  FinanceOpsTab: () => <div>Finance ops tab</div>,
}));

vi.mock('@/app/components/dashboard/OverviewTab', () => ({
  OverviewTab: () => <div>Overview tab</div>,
}));

vi.mock('@/app/components/dashboard/TrendsTab', () => ({
  TrendsTab: () => <div>Trends tab</div>,
}));

vi.mock('@/app/components/dashboard/DataHealthTab', () => ({
  DataHealthTab: () => <div>Data health tab</div>,
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: 'workspace-1' },
    loading: false,
  }),
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Symon',
      onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
    },
    loading: false,
  }),
}));

vi.mock('@/app/hooks/useDashboard', () => ({
  useDashboard: () => ({
    data: {
      snapshot: {
        currency: 'KZT',
      },
      dataHealth: {
        statementsPendingReview: 0,
        lastUploadDate: '2026-01-01T00:00:00.000Z',
      },
      effectiveSince: null,
      effectiveEndDate: null,
    },
    isPending: false,
    isFetching: false,
    error: null,
    refetch: refresh,
    range: '30d',
  }),
}));

vi.mock('@/app/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/app/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    handlers: {},
    pullDistance: 0,
    isRefreshing: false,
    isReadyToRefresh: false,
  }),
}));

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    greeting: {
      fallbackName: { value: 'User' },
      upToDate: {
        subtitle: { value: 'Hello {name}' },
      },
    },
    statusHeading: {
      allClear: { value: 'All good' },
    },
    refresh: {
      loading: { value: 'Loading' },
      ready: { value: 'Ready' },
      idle: { value: 'Idle' },
    },
    tabs: {
      financeOps: { value: 'Finance Ops' },
      overview: { value: 'Overview' },
      trends: { value: 'Trends' },
      dataHealth: { value: 'Data Health' },
    },
    periodBanner: { value: 'Showing latest available period: {period}' },
    monthStripLabel: { value: 'Select month' },
    previousYear: { value: 'Previous year' },
    nextYear: { value: 'Next year' },
  }),
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/app/lib/dashboard-effective-window', () => ({
  resolveDashboardEffectivePeriod: () => effectivePeriod.current,
}));

vi.mock('@/app/lib/dashboard-status-heading', () => ({
  resolveDashboardStatusHeading: () => 'allClear',
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    replace.mockClear();
    searchParams.current = new URLSearchParams();
    effectivePeriod.current = null;
  });

  it('orders tabs Overview, Trends, Finance Ops, Data Health and defaults to Overview', () => {
    render(<DashboardPage />);

    const tabs = screen.getByTestId('tabs');
    const order = Array.from(tabs.querySelectorAll('button')).map(b => b.textContent);
    expect(order).toEqual(['Overview', 'Trends', 'Finance Ops', 'Data Health']);
    expect(tabs).toHaveAttribute('data-active', 'overview');
    expect(screen.getByText('Overview tab')).toBeInTheDocument();
  });

  it('selects the tab from the ?tab query param', () => {
    searchParams.current = new URLSearchParams('tab=trends');
    render(<DashboardPage />);

    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'trends');
    expect(screen.getByText('Trends tab')).toBeInTheDocument();
  });

  it('writes the picked month to the URL without scrolling', () => {
    searchParams.current = new URLSearchParams('tab=trends');
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));

    const year = new Date().getFullYear();
    expect(replace).toHaveBeenCalledWith(`/dashboard?tab=trends&month=${year}-01`, {
      scroll: false,
    });
  });

  it('highlights the month from the URL', () => {
    searchParams.current = new URLSearchParams('month=2025-03');
    render(<DashboardPage />);

    expect(screen.getByRole('button', { name: 'Mar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2025')).toBeInTheDocument();
  });

  it('shows the effective period banner under the month strip on every tab', () => {
    effectivePeriod.current = '2025-05-01 - 2025-05-31';
    searchParams.current = new URLSearchParams('tab=data-health');
    render(<DashboardPage />);

    expect(
      screen.getByText('Showing latest available period: 2025-05-01 - 2025-05-31'),
    ).toBeInTheDocument();
  });
});
