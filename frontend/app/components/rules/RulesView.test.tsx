// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const permissions = vi.hoisted(() => ({ allowed: true }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => permissions.allowed }),
}));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => search.params,
  usePathname: () => '/rules',
  useRouter: () => router,
}));

import type { CategorizationRule, CategorizationRuleSuggestionList } from '@/app/lib/contracts';
import { queryKeys } from '@/app/lib/query-keys';
import { apiResponse } from '@/app/test/api-response';
import { categoryItem, walletItem } from '@/app/test/fixtures/contracts';
import {
  createTestQueryClient,
  renderHookWithQuery,
  renderWithQuery,
} from '@/app/test/query-wrapper';
import { RulesView } from './RulesView';
import { useReorderRules } from './useRules';

const STORE = 'ACME Store';
const ELECTRONICS = categoryItem({ id: '00000000-0000-4000-8000-000000000001', name: 'Electronics' });
const CARD = walletItem({ id: '00000000-0000-4000-8000-000000000002', name: 'Everyday card' });
const GADGETS = { id: '00000000-0000-4000-8000-000000000003', name: 'Gadgets', color: null, usageCount: 2 };
const BAKERY_PAYEE = '00000000-0000-4000-8000-000000000004';

function rule(overrides: Partial<CategorizationRule> = {}): CategorizationRule {
  return {
    id: 'rule-1',
    name: 'ACME is electronics',
    description: null,
    conditions: [{ field: 'counterparty_name', operator: 'contains', value: STORE }],
    result: { categoryId: ELECTRONICS.id },
    priority: 0,
    isActive: true,
    matchCount: 3,
    lastMatchedAt: '2026-10-01T10:00:00.000Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

const suggestion: CategorizationRuleSuggestionList['data'][number] = {
  payeeId: BAKERY_PAYEE,
  payeeName: 'Corner Bakery',
  categoryId: ELECTRONICS.id,
  decidedCount: 4,
  conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'Corner Bakery' }],
};

function mockApi(
  rules: CategorizationRule[],
  options: { suggestions?: CategorizationRuleSuggestionList['data']; dismissed?: string[] } = {},
) {
  get.mockImplementation(async (url: string) => {
    if (url === '/categorization-rules') return apiResponse({ data: rules, total: rules.length });
    if (url === '/categorization-rules/suggestions')
      return apiResponse({ data: options.suggestions ?? [] });
    if (url === '/view-preferences/rules')
      return apiResponse({
        state: options.dismissed ? { dismissedSuggestions: options.dismissed } : null,
      });
    if (url === '/categories') return apiResponse([ELECTRONICS]);
    if (url === '/wallets') return apiResponse([CARD]);
    if (url === '/tags') return apiResponse([GADGETS]);
    if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
    throw new Error(`unexpected GET ${url}`);
  });
}

describe('RulesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.allowed = true;
    search.params = new URLSearchParams();
    put.mockResolvedValue(apiResponse(rule()));
    del.mockResolvedValue(apiResponse(null));
    post.mockResolvedValue(apiResponse({ applied: 2, skippedManual: 1, tagged: 3 }));
  });

  it('lays each rule out as a row: what it matches, what it sets, how often it fired', async () => {
    mockApi([
      rule({
        conditions: [
          { field: 'counterparty_name', operator: 'contains', value: STORE },
          { field: 'direction', operator: 'equals', value: 'expense' },
          { field: 'wallet', operator: 'equals', value: CARD.id },
        ],
        result: { categoryId: ELECTRONICS.id, tagIds: [GADGETS.id] },
      }),
    ]);
    renderWithQuery(<RulesView />);

    const row = (await screen.findByRole('link', { name: 'ACME is electronics' })).closest('tr');
    expect(row?.getAttribute('class')).toContain('seneca-rules-table__row');
    const cells = within(row as HTMLElement);
    expect(
      await cells.findByText(
        'Payee contains “ACME Store” and Direction is Money out and Account is Everyday card',
      ),
    ).toBeTruthy();
    expect(await cells.findByText('file under Electronics · tag Gadgets')).toBeTruthy();
    expect(cells.getByText(/Matched 3 times/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'ACME is electronics' }).getAttribute('href')).toBe(
      '/rules/rule-1',
    );
  });

  it('points to the quickest way in when there are no rules', async () => {
    mockApi([]);
    renderWithQuery(<RulesView />);

    expect(await screen.findByText('No rules yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New rule' }).getAttribute('href')).toBe('/rules/new');
  });

  it('pauses a rule with its switch', async () => {
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await userEvent.click(await screen.findByRole('switch', { name: /ACME is electronics/ }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/categorization-rules/rule-1', { isActive: false }),
    );
  });

  it('applies a rule to existing rows from its menu', async () => {
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await userEvent.click(await screen.findByRole('button', { name: /Rule actions: ACME/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Apply to existing rows' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/categorization-rules/rule-1/apply'));
  });

  it('shows no editing controls to a member who may only look', async () => {
    permissions.allowed = false;
    mockApi([rule()], { suggestions: [suggestion] });
    renderWithQuery(<RulesView />);

    await screen.findByRole('link', { name: 'ACME is electronics' });
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: /Move/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Rule actions/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New rule' })).toBeNull();
    expect(screen.queryByText('Rules worth adding')).toBeNull();
  });

  it('sends the old `?focus=` link to the rule’s own page', async () => {
    search.params = new URLSearchParams({ focus: 'rule-1' });
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/rules/rule-1'));
  });

  it('suggests a rule for a payee filed by hand again and again, and forgets a dismissed one', async () => {
    mockApi([rule()], { suggestions: [suggestion] });
    renderWithQuery(<RulesView />);

    expect(
      await screen.findByText('Corner Bakery: filed under Electronics by hand 4 times'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Make a rule' }).getAttribute('href')).toBe(
      `/rules/new?payee=Corner+Bakery&categoryId=${ELECTRONICS.id}`,
    );

    put.mockResolvedValue(apiResponse({ state: { dismissedSuggestions: [BAKERY_PAYEE] } }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => expect(screen.queryByText(/Corner Bakery:/)).toBeNull());
    expect(put).toHaveBeenCalledWith('/view-preferences/rules', {
      state: { dismissedSuggestions: [BAKERY_PAYEE] },
    });
  });

  it('never shows a suggestion this person dismissed before', async () => {
    mockApi([rule()], { suggestions: [suggestion], dismissed: [BAKERY_PAYEE] });
    renderWithQuery(<RulesView />);

    await screen.findByRole('link', { name: 'ACME is electronics' });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/categorization-rules/suggestions', expect.anything()));
    expect(screen.queryByText('Rules worth adding')).toBeNull();
  });
});

describe('reordering rules', () => {
  const first = rule({ id: 'rule-a', name: 'First' });
  const second = rule({ id: 'rule-b', name: 'Second' });

  function setup() {
    const queryClient = createTestQueryClient();
    const key = queryKeys.categorizationRules('workspace-1');
    queryClient.setQueryData(key, { data: [first, second], total: 2 });
    const { result } = renderHookWithQuery(() => useReorderRules(), { client: queryClient });
    return { queryClient, key, result };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi([first, second]);
  });

  it('moves the list at once and sends the whole order, first on top', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    put.mockReturnValue(new Promise(done => (resolve = done)));
    const { queryClient, key, result } = setup();

    act(() => {
      result.current.mutate([second, first]);
    });

    await waitFor(() =>
      expect(
        (queryClient.getQueryData(key) as { data: CategorizationRule[] }).data.map(r => r.id),
      ).toEqual(['rule-b', 'rule-a']),
    );
    expect(put).toHaveBeenCalledWith('/categorization-rules/order', { ids: ['rule-b', 'rule-a'] });
    resolve(apiResponse({ data: [second, first], total: 2 }));
  });

  it('puts the old order back when the server refuses', async () => {
    put.mockRejectedValue(new Error('The rules changed meanwhile'));
    get.mockImplementation(() => new Promise(() => undefined));
    const { queryClient, key, result } = setup();

    await act(async () => {
      await result.current.mutateAsync([second, first]).catch(() => undefined);
    });

    expect(
      (queryClient.getQueryData(key) as { data: CategorizationRule[] }).data.map(r => r.id),
    ).toEqual(['rule-a', 'rule-b']);
  });
});
