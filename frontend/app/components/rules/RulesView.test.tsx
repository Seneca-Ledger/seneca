// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const del = vi.fn();
const offers = vi.hoisted(() => ({ last: null as null | { message: string; onApply: () => void } }));
const permissions = vi.hoisted(() => ({ allowed: true }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));

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
}));
vi.mock('@/app/components/payees/offer-action-toast', () => ({
  offerAction: (options: { message: string; onApply: () => void }) => {
    offers.last = options;
  },
}));

import type { CategorizationRule } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { categoryItem, walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { RulesView } from './RulesView';

const STORE = 'ACME Store';
const ELECTRONICS = categoryItem({ id: '00000000-0000-4000-8000-000000000001', name: 'Electronics' });
const CARD = walletItem({ id: '00000000-0000-4000-8000-000000000002', name: 'Everyday card' });

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

function mockApi(rules: CategorizationRule[]) {
  get.mockImplementation(async (url: string) => {
    if (url === '/categorization-rules') return apiResponse({ data: rules, total: rules.length });
    if (url === '/categories') return apiResponse([ELECTRONICS]);
    if (url === '/wallets') return apiResponse([CARD]);
    if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
    throw new Error(`unexpected GET ${url}`);
  });
}

const preview = {
  totalTransactions: 40,
  matchedTransactions: 6,
  overridable: 4,
  truncated: false,
  matches: [
    {
      id: 'tx-1',
      date: '2026-10-01',
      amount: '25.00',
      counterparty: `${STORE} - Wireless Buds`,
      purpose: null,
      matchReason: 'counterparty_name contains "acme store"',
    },
  ],
};

describe('RulesView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions.allowed = true;
    search.params = new URLSearchParams();
    offers.last = null;
    post.mockImplementation(async (url: string, body: { name?: string }) => {
      if (url === '/categorization-rules/test') return apiResponse(preview);
      if (url === '/categorization-rules') return apiResponse(rule({ id: 'rule-new', ...body }));
      if (url.endsWith('/apply')) return apiResponse({ applied: 4, skippedManual: 2 });
      throw new Error(`unexpected POST ${url}`);
    });
    put.mockResolvedValue(apiResponse(rule()));
    del.mockResolvedValue(apiResponse(null));
  });

  it('says what each rule matches, what it sets and how often it fired', async () => {
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    expect(await screen.findByText('ACME is electronics')).toBeTruthy();
    expect(screen.getByText(/Payee contains “ACME Store”/)).toBeTruthy();
    expect(screen.getByText(/file under Electronics/)).toBeTruthy();
    expect(screen.getByText(/Matched 3 times/)).toBeTruthy();
  });

  it('points to the quickest way in when there are no rules', async () => {
    mockApi([]);
    renderWithQuery(<RulesView />);

    expect(await screen.findByText('No rules yet')).toBeTruthy();
    expect(screen.getByText(/Always file rows like this/)).toBeTruthy();
  });

  it('pauses a rule with its switch', async () => {
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await userEvent.click(await screen.findByRole('switch', { name: /ACME is electronics/ }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/categorization-rules/rule-1', { isActive: false }),
    );
  });

  it('shows no editing controls to a member who may only look', async () => {
    permissions.allowed = false;
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await screen.findByText('ACME is electronics');
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New rule' })).toBeNull();
  });

  it('previews a new rule, saves it and only offers to refile what nobody chose', async () => {
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await userEvent.click(await screen.findByRole('button', { name: 'New rule' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Value'), { target: { value: STORE } });
    // The category is picked in the app's category drawer; here the rule names an account.
    selectOption(within(dialog).getByRole('combobox', { name: 'Account' }), CARD.name);

    expect(await within(dialog).findByText('Matches 6 existing rows')).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/categorization-rules', {
        name: 'Payee contains “ACME Store”',
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: STORE }],
        result: { walletId: CARD.id },
        priority: 0,
      }),
    );
    // A rule that sets no category has nothing to refile on old rows.
    expect(offers.last).toBeNull();
  });

  it('offers to refile the undecided matches of a rule that sets a category', async () => {
    mockApi([rule()]);
    renderWithQuery(<RulesView />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/4 of them/)).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save rule' }));

    await waitFor(() => expect(offers.last?.message).toBe('Refile 4 existing rows with this rule?'));
    expect(post).not.toHaveBeenCalledWith('/categorization-rules/rule-1/apply');
    offers.last?.onApply();
    await waitFor(() => expect(post).toHaveBeenCalledWith('/categorization-rules/rule-1/apply'));
  });
});
