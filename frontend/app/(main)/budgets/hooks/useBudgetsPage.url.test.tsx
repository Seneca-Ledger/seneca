// @vitest-environment jsdom
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBudgetsPage } from './useBudgetsPage';

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  // Next's router is one stable object; a fresh one per render would re-run
  // every effect that depends on it.
  router: {} as { replace: (url: string) => void },
}));
navigation.router.replace = navigation.replace;

vi.mock('next/navigation', () => ({
  useSearchParams: () => navigation.params,
  useRouter: () => navigation.router,
  usePathname: () => '/budgets',
}));
vi.mock('@/app/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded: vi.fn(async () => []) }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { currency: 'EUR' } }),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => new Proxy({}, { get: (_, key: string) => ({ value: key }) }),
}));

describe('useBudgetsPage URL handoffs', () => {
  beforeEach(() => {
    navigation.replace.mockClear();
  });

  // The goal page's empty "plan versus actual" card links here to create the
  // goal's first budget, so the drawer opens with that goal already chosen.
  it('opens the create drawer with the goal from ?newBudgetGoal and strips it', async () => {
    navigation.params = new URLSearchParams('newBudgetGoal=goal-7&tab=list');

    const { result } = renderHookWithQuery(() => useBudgetsPage());

    await waitFor(() => expect(result.current.dialogOpen).toBe(true));
    expect(result.current.formData.goalId).toBe('goal-7');
    expect(result.current.formData.categoryId).toBe('');
    expect(navigation.replace).toHaveBeenCalledWith('/budgets?tab=list');
  });

  it('keeps the category handoff from insights working', async () => {
    navigation.params = new URLSearchParams('newBudgetCategory=cat-3');

    const { result } = renderHookWithQuery(() => useBudgetsPage());

    await waitFor(() => expect(result.current.dialogOpen).toBe(true));
    expect(result.current.formData.categoryId).toBe('cat-3');
    expect(result.current.formData.goalId).toBe('');
    expect(navigation.replace).toHaveBeenCalledWith('/budgets');
  });
});
