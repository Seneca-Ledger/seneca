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

vi.mock('@/app/components/insights/AlertBanner', () => ({ AlertBanner: () => null }));
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

// The heading reads the whole sidebar config; it has tests of its own.
vi.mock('@/app/components/ui/page-title', () => ({ PageTitle: () => null }));

vi.mock('@/app/components/ui/spinner', () => ({
  Spinner: () => <div>spinner</div>,
}));

vi.mock('@/app/components/dashboard/OverviewTab', () => ({
  OverviewTab: () => <div>Overview tab</div>,
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

  it('is the Overview alone, with no tabs to switch', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Overview tab')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('opens the Overview from an old link to a tab that is gone', () => {
    searchParams.current = new URLSearchParams('tab=trends');
    render(<DashboardPage />);

    expect(screen.getByText('Overview tab')).toBeInTheDocument();
  });

  it('writes the picked month to the URL without scrolling, keeping the rest', () => {
    searchParams.current = new URLSearchParams('cf=5y');
    render(<DashboardPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Jan' }));

    const year = new Date().getFullYear();
    expect(replace).toHaveBeenCalledWith(`/dashboard?cf=5y&month=${year}-01`, {
      scroll: false,
    });
  });

  it('highlights the month from the URL', () => {
    searchParams.current = new URLSearchParams('month=2025-03');
    render(<DashboardPage />);

    expect(screen.getByRole('button', { name: 'Mar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2025')).toBeInTheDocument();
  });

  it('shows the effective period banner under the month strip', () => {
    effectivePeriod.current = '2025-05-01 - 2025-05-31';
    render(<DashboardPage />);

    expect(
      screen.getByText('Showing latest available period: 2025-05-01 - 2025-05-31'),
    ).toBeInTheDocument();
  });
});
