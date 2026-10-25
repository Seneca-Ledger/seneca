// @vitest-environment jsdom
import { act } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GoalsPage from './page';

const goalsState = vi.hoisted(() => ({ isPending: true, isFetching: false }));

vi.mock('./hooks/useGoals', () => ({
  EMPTY_GOAL_FORM: { name: '', targetAmount: 0, targetDate: '' },
  useGoals: () => ({
    goals: [],
    error: null,
    saving: false,
    createGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    addContribution: vi.fn(),
    ...goalsState,
  }),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => new Proxy({}, { get: (_, key: string) => ({ value: key }) }),
  useLocale: () => ({ locale: 'en' }),
}));
vi.mock('@/app/components/ui/page-title', () => ({ PageTitle: () => null }));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({ ReadOnlyHint: () => null }));
vi.mock('@/app/components/mobile/quick-actions-store', () => ({ useQuickActions: () => {} }));
vi.mock('./components/GoalFormDrawer', () => ({ GoalFormDrawer: () => null }));
vi.mock('./components/ContributionDrawer', () => ({ ContributionDrawer: () => null }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GoalsPage hydration', () => {
  it('renders the same list on the server and on the first client pass while goals load', async () => {
    // The server never fetches; the client already knows the workspace from
    // localStorage, so its first pass is a pending query that is fetching.
    goalsState.isFetching = false;
    const container = document.createElement('div');
    container.innerHTML = renderToString(<GoalsPage />);
    document.body.appendChild(container);

    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recoverable = vi.fn();
    goalsState.isFetching = true;
    await act(async () => {
      hydrateRoot(container, <GoalsPage />, { onRecoverableError: recoverable });
    });

    const mismatches = errors.mock.calls.filter(call => String(call[0]).includes('hydrat'));
    errors.mockRestore();
    expect(mismatches).toEqual([]);
    expect(recoverable).not.toHaveBeenCalled();
  });
});
