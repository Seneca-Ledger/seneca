import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));
const route = vi.hoisted(() => ({ pathname: '/budgets' }));

vi.mock('@/app/lib/api', () => ({
  default: { get: apiMocks.get, post: apiMocks.post },
}));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'workspace-1' } }),
}));

const forms = (one: string, many: string) => ({
  One: { value: one },
  Few: { value: many },
  Many: { value: many },
});
const prefix = (key: string, set: ReturnType<typeof forms>) =>
  Object.fromEntries(Object.entries(set).map(([form, value]) => [`${key}${form}`, value]));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    ...prefix('summary', forms('{{count}} thing needs attention', '{{count}} things need attention')),
    ...prefix(
      'unapproved',
      forms('{{count}} transaction awaits confirmation', '{{count}} transactions await confirmation'),
    ),
    ...prefix(
      'uncategorized',
      forms('{{count}} transaction without a category', '{{count}} transactions without a category'),
    ),
    ...prefix('duplicates', forms('{{count}} possible duplicate', '{{count}} possible duplicates')),
    review: { value: 'Review' },
    check: { value: 'Check' },
    snooze: { value: 'Hide for a week' },
  }),
}));

import { renderWithQuery } from '../../test/query-wrapper';
import { AlertBanner } from './AlertBanner';
import type { Insight } from '@/app/lib/contracts';
import { insightPage } from '@/app/test/fixtures/contracts';

function work(type: string, count: number, overrides: Partial<Insight> = {}): Insight {
  return {
    id: type,
    type,
    category: 'operational',
    severity: 'warn',
    title: 'Stoic title',
    message: 'What is not named cannot be weighed.',
    messageKey: null,
    messageParams: { count },
    data: { count },
    createdAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

const unapproved = (count: number) => work('operational.unapproved_count', count);
const uncategorized = (count: number) => work('operational.uncategorized_count', count);
const duplicates = (count: number) => work('operational.duplicate_detected', count);
const rising: Insight = {
  ...work('trend.spending_up', 0),
  category: 'trend',
  messageParams: { category: 'Marketing', percent: 129 },
  data: { categoryId: 'cat-1' },
};

describe('AlertBanner', () => {
  beforeEach(() => {
    route.pathname = '/budgets';
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    apiMocks.post.mockResolvedValue({ data: {} });
  });

  it('shows one item as a quiet row of plain facts with a text action', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([uncategorized(91)]) });

    renderWithQuery(<AlertBanner />);

    const text = await screen.findByText('91 transactions without a category');
    // The Stoic wording is one hover away.
    expect(text).toHaveAttribute('title', 'What is not named cannot be weighed.');
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href',
      '/statements/submit?missingCategory=true',
    );
  });

  it('folds several items into one line that opens the list, most blocking first', async () => {
    apiMocks.get.mockResolvedValue({
      data: insightPage([duplicates(1), uncategorized(91), unapproved(2)]),
    });
    const user = userEvent.setup();

    renderWithQuery(<AlertBanner />);

    const summary = await screen.findByRole('button', { name: '3 things need attention' });
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('91 transactions without a category')).toBeNull();

    await user.click(summary);

    expect(summary).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('status').map(row => row.textContent)).toEqual([
      expect.stringContaining('2 transactions await confirmation'),
      expect.stringContaining('91 transactions without a category'),
      expect.stringContaining('1 possible duplicate'),
    ]);
    expect(screen.getByRole('link', { name: 'Check' })).toBeInTheDocument();
  });

  it('leaves observations to the Advice page', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([rising]) });

    const { container } = renderWithQuery(<AlertBanner />);

    await waitFor(() => expect(apiMocks.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('leaves the top of the dashboard to the copy under its month strip', async () => {
    route.pathname = '/dashboard';
    apiMocks.get.mockResolvedValue({ data: insightPage([unapproved(2)]) });

    const { container } = renderWithQuery(<AlertBanner />);

    await waitFor(() => expect(apiMocks.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows every item, unconfirmed ones too, where the dashboard places it', async () => {
    route.pathname = '/dashboard';
    apiMocks.get.mockResolvedValue({ data: insightPage([unapproved(2)]) });

    renderWithQuery(<AlertBanner placement="page" />);

    expect(await screen.findByText('2 transactions await confirmation')).toBeInTheDocument();
  });

  it('hides an item for a week without following its link', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([uncategorized(91)]) });
    const user = userEvent.setup();

    renderWithQuery(<AlertBanner />);
    const hide = await screen.findByRole('button', { name: 'Hide for a week' });
    // The server leaves a closed insight out of the list from now on.
    apiMocks.get.mockResolvedValue({ data: insightPage([]) });

    await user.click(hide);

    expect(apiMocks.post).toHaveBeenCalledWith('/insights/operational.uncategorized_count/dismiss');
    await waitFor(() => expect(screen.queryByText('91 transactions without a category')).toBeNull());
  });
});
