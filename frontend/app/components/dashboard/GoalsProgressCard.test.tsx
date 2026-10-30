// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonthGoal } from '@/app/(main)/goals/hooks/useMonthGoals';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { GoalsProgressCard } from './GoalsProgressCard';
import { SectionSpanProvider } from './section-span';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: { get: apiGet },
  apiBaseUrl: 'http://api.test/api/v1',
}));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'ws-1' } }),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import('./__tests__/intlayer-mock');
  return {
    useIntlayer: (key: string) =>
      autoDictionary(
        key === 'goalsPage'
          ? { title: value('Savings goals'), remaining: value('to go'), reached: value('Reached') }
          : {
              goalsViewAll: value('View all goals'),
              goalsSavedInMonth: value('saved this month'),
              goalsEmptyInMonth: value('No goal moved forward this month'),
            },
      ),
    useLocale: () => ({ locale: 'en' }),
  };
});
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function goal(overrides: Partial<MonthGoal> = {}): MonthGoal {
  return {
    id: 'goal-1',
    name: 'Studio camera',
    targetAmount: 2400,
    currency: 'EUR',
    targetDate: '2026-12-01',
    currentAmount: 2100,
    remaining: 300,
    percent: 87.5,
    isReached: false,
    createdAt: '2026-01-10T09:00:00.000Z',
    cover: null,
    contributedInMonth: 450,
    ...overrides,
  };
}

describe('GoalsProgressCard', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('asks for the shown month and reports what each goal got in it', async () => {
    apiGet.mockResolvedValue({ data: [goal()] });

    renderWithQuery(<GoalsProgressCard month="2026-09" monthLabel="September 2026" />);

    await waitFor(() => expect(screen.getByText('Studio camera')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith('/goals?month=2026-09', expect.anything());
    // The amount is an element of its own (privacy mode); the line is around it.
    expect(screen.getByText(/saved this month/).textContent).toMatch(/€450\.00 saved this month/);
    expect(screen.getByRole('link', { name: /view all goals/i }).getAttribute('href')).toBe(
      '/goals',
    );
  });

  it('leaves the editing buttons to the goals page', async () => {
    apiGet.mockResolvedValue({ data: [goal()] });

    renderWithQuery(<GoalsProgressCard month="2026-09" monthLabel="September 2026" />);

    await waitFor(() => expect(screen.getByText('Studio camera')).toBeInTheDocument());
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('keeps the section on a month with no goal activity and says so', async () => {
    apiGet.mockResolvedValue({ data: [] });

    renderWithQuery(<GoalsProgressCard month="2026-09" monthLabel="September 2026" />);

    await waitFor(() =>
      expect(screen.getByText('No goal moved forward this month')).toBeInTheDocument(),
    );
    expect(screen.getByRole('link', { name: /view all goals/i })).toBeInTheDocument();
  });

  it('holds its place while the month is still loading, but never claims a quiet month', () => {
    apiGet.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<GoalsProgressCard month="2026-09" monthLabel="September 2026" />);

    expect(screen.getByText('Savings goals')).toBeInTheDocument();
    expect(screen.queryByText('No goal moved forward this month')).not.toBeInTheDocument();
  });

  it('puts goals side by side with the row to itself, in one column at half width', async () => {
    apiGet.mockResolvedValue({ data: [goal()] });
    const card = <GoalsProgressCard month="2026-09" monthLabel="September 2026" />;

    const half = renderWithQuery(<SectionSpanProvider value={6}>{card}</SectionSpanProvider>);
    await screen.findByText('Studio camera');
    expect(getComputedStyle(screen.getByTestId('goals-list')).display).toBe('flex');
    half.unmount();

    renderWithQuery(<SectionSpanProvider value={12}>{card}</SectionSpanProvider>);
    await screen.findByText('Studio camera');
    expect(getComputedStyle(screen.getByTestId('goals-list')).display).toBe('grid');
  });
});
