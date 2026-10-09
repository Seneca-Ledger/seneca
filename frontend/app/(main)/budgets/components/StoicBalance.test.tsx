import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoicBalance as StoicBalanceData } from '../hooks/useStoicBalance';
import { StoicBalance } from './StoicBalance';

const apiMocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));

vi.mock('@/app/lib/api', () => ({ default: apiMocks }));
vi.mock('next/navigation', () => ({ useSearchParams: () => searchParams.current }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
// Every dictionary entry renders as its own key, so the test reads the keys.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
  // The month above the classes is formatted, not translated.
  useLocale: () => ({ locale: 'en' }),
}));

const totals = (partial: Partial<StoicBalanceData['months'][number]['actual']>) => ({
  necessity: 0,
  work: 0,
  virtue: 0,
  leisure: 0,
  unclassified: 0,
  ...partial,
});

const balance: StoicBalanceData = {
  months: [
    {
      month: '2026-09',
      monthsAgo: 0,
      intended: totals({ necessity: 500, leisure: 100 }),
      actual: totals({ necessity: 300, leisure: 300, unclassified: 50 }),
      overBudgetCategoryIds: [],
    },
    {
      month: '2026-08',
      monthsAgo: 1,
      intended: totals({ necessity: 500, leisure: 100 }),
      actual: totals({ necessity: 900, leisure: 100 }),
      overBudgetCategoryIds: [],
    },
  ],
  categories: [
    {
      id: 'rent',
      name: 'Rent',
      parentId: null,
      stoicClass: 'necessity',
      source: 'suggested',
      spent: 300,
      budgeted: true,
      active: true,
      helpsOthers: false,
      helpsOthersSource: 'suggested',
    },
    {
      id: 'misc',
      name: 'Misc',
      parentId: null,
      stoicClass: null,
      source: null,
      spent: 50,
      budgeted: false,
      active: true,
      helpsOthers: false,
      helpsOthersSource: 'suggested',
    },
    {
      id: 'gifts',
      name: 'Gifts',
      parentId: null,
      stoicClass: 'virtue',
      source: 'user',
      spent: 20,
      budgeted: false,
      active: true,
      helpsOthers: false,
      helpsOthersSource: 'suggested',
    },
    {
      id: 'old',
      name: 'Old category',
      parentId: null,
      stoicClass: null,
      source: null,
      spent: 0,
      budgeted: false,
      active: false,
      helpsOthers: false,
      helpsOthersSource: 'suggested',
    },
  ],
};

describe('StoicBalance', () => {
  beforeEach(() => {
    apiMocks.get.mockReset().mockResolvedValue({ data: balance });
    apiMocks.put.mockReset().mockResolvedValue({ data: {} });
    searchParams.current = new URLSearchParams();
  });

  it('shows plan and reality as shares, and asks about unjudged categories first', async () => {
    renderWithQuery(<StoicBalance />);

    expect(await screen.findByRole('img', { name: /planned: classNecessity 83%, classLeisure 17%/ }))
      .toBeTruthy();
    expect(screen.getByRole('img', { name: /actual: .*classLeisure 46%/ })).toBeTruthy();

    const rows = screen.getAllByRole('combobox');
    expect(rows[0].getAttribute('aria-label')).toBe('classLabel: Misc');
    expect(screen.getByText('suggested')).toBeTruthy();
    // Categories with no spending in the window stay hidden until asked for.
    expect(screen.queryByText('Old category')).toBeNull();
  });

  it('saves a judgment on the category and reloads the balance', async () => {
    renderWithQuery(<StoicBalance />);

    const misc = await screen.findByRole('combobox', { name: 'classLabel: Misc' });
    selectOption(misc, 'classVirtue');

    await waitFor(() =>
      expect(apiMocks.put).toHaveBeenCalledWith('/categories/misc', { stoicClass: 'virtue' }),
    );
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalledTimes(2));
  });

  it('reads the month an advice link names, not the running one', async () => {
    // In the first days of a month the advice judges the month that ended;
    // showing September here would ring a card the advice never weighed.
    searchParams.current = new URLSearchParams('month=2026-08');
    renderWithQuery(<StoicBalance />);

    expect(await screen.findByRole('img', { name: /actual: classNecessity 90%/ })).toBeTruthy();
  });

  it('walks back to the month before it and forward again', async () => {
    renderWithQuery(<StoicBalance />);

    fireEvent.click(await screen.findByRole('button', { name: 'previousMonth' }));
    expect(await screen.findByRole('img', { name: /actual: classNecessity 90%/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'nextMonth' }));
    expect(await screen.findByRole('img', { name: /actual: .*classLeisure 46%/ })).toBeTruthy();
  });

  it('lets a virtue category be marked as help given to others', async () => {
    renderWithQuery(<StoicBalance />);

    const toggle = await screen.findByRole('switch', { name: 'helpsOthers: Gifts' });
    // Only virtue categories can be generosity.
    expect(screen.queryByRole('switch', { name: 'helpsOthers: Rent' })).toBeNull();
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(apiMocks.put).toHaveBeenCalledWith('/categories/gifts', { helpsOthers: true }),
    );
  });
});
