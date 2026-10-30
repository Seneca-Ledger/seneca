// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const put = vi.fn();
const offers = vi.hoisted(() => ({ last: null as null | { message: string; onApply: () => void } }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => search.params,
  usePathname: () => '/rules/new',
  useRouter: () => router,
}));
vi.mock('@/app/components/payees/offer-action-toast', () => ({
  offerAction: (options: { message: string; onApply: () => void }) => {
    offers.last = options;
  },
}));

import type { CategorizationRule, CategorizationRuleTestResult } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { categoryItem, walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { RuleEditorView } from './RuleEditorView';

const STORE = 'ACME Store - Wireless Buds';
const ELECTRONICS = categoryItem({ id: '00000000-0000-4000-8000-000000000001', name: 'Electronics' });
const CARD = walletItem({ id: '00000000-0000-4000-8000-000000000002', name: 'Everyday card' });

const saved: CategorizationRule = {
  id: 'rule-1',
  name: 'ACME is electronics',
  description: null,
  conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'ACME Store' }],
  result: { categoryId: ELECTRONICS.id },
  priority: 2,
  isActive: true,
  matchCount: 0,
  lastMatchedAt: null,
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

function match(id: string, wonBy: { id: string; name: string } | null = null) {
  return {
    id,
    date: '2026-10-01',
    amount: '25.00',
    counterparty: STORE,
    purpose: 'Order 1001',
    matchReason: 'counterparty_name contains "acme store"',
    direction: 'expense' as const,
    currency: 'EUR',
    categoryId: null,
    decided: false,
    wonBy,
  };
}

let preview: CategorizationRuleTestResult;

beforeEach(() => {
  vi.clearAllMocks();
  offers.last = null;
  search.params = new URLSearchParams();
  preview = {
    totalTransactions: 40,
    matchedTransactions: 2,
    overridable: 2,
    shadowed: 0,
    truncated: false,
    matches: [match('tx-1'), match('tx-2')],
  };
  get.mockImplementation(async (url: string) => {
    if (url === '/categorization-rules/rule-1') return apiResponse(saved);
    if (url === '/categories') return apiResponse([ELECTRONICS]);
    if (url === '/wallets') return apiResponse([CARD]);
    if (url === '/tags') return apiResponse([]);
    if (url.startsWith('/workspaces/')) return apiResponse({ members: [] });
    throw new Error(`unexpected GET ${url}`);
  });
  post.mockImplementation(async (url: string, body: { name?: string }) => {
    if (url === '/categorization-rules/test') return apiResponse(preview);
    if (url === '/categorization-rules') return apiResponse({ ...saved, id: 'rule-new', ...body });
    if (url.endsWith('/apply')) return apiResponse({ applied: 2, skippedManual: 0, tagged: 0 });
    throw new Error(`unexpected POST ${url}`);
  });
  put.mockResolvedValue(apiResponse(saved));
});

describe('RuleEditorView', () => {
  it('starts a rule from a row: its payee, its direction and its category', async () => {
    search.params = new URLSearchParams({
      payee: STORE,
      categoryId: ELECTRONICS.id,
      direction: 'expense',
    });
    renderWithQuery(<RuleEditorView id="new" />);

    expect(await screen.findByRole('heading', { name: 'New rule' })).toBeTruthy();
    const values = screen.getAllByLabelText('Value');
    expect((values[0] as HTMLInputElement).value).toBe(STORE);
    // The rows it would match, as a table, money out with a typographic minus.
    const table = await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getAllByText('−€25.00')).toHaveLength(2);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        {
          conditions: [
            { field: 'counterparty_name', operator: 'contains', value: STORE },
            { field: 'direction', operator: 'equals', value: 'expense' },
          ],
        },
        expect.anything(),
      ),
    );
  });

  it('saves without a priority, so the server puts the new rule on top, then offers to refile', async () => {
    search.params = new URLSearchParams({ payee: STORE });
    renderWithQuery(<RuleEditorView id="new" />);
    await screen.findByRole('table');
    selectOption(screen.getByRole('combobox', { name: 'Account' }), CARD.name);

    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/categorization-rules', {
        name: `Payee contains “${STORE}”`,
        conditions: [{ field: 'counterparty_name', operator: 'contains', value: STORE }],
        result: { walletId: CARD.id },
      }),
    );
    expect(router.push).toHaveBeenCalledWith('/rules');
    // A rule that sets neither a category nor tags has nothing to apply to old rows.
    expect(offers.last).toBeNull();
  });

  it('edits a saved rule and offers to refile the matches nobody chose', async () => {
    renderWithQuery(<RuleEditorView id="rule-1" />);

    const name = await screen.findByLabelText('Name');
    await waitFor(() => expect((name as HTMLInputElement).value).toBe('ACME is electronics'));
    fireEvent.change(name, { target: { value: 'ACME gadgets' } });
    await screen.findByRole('table');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/categorization-rules/test',
        expect.objectContaining({ ruleId: 'rule-1' }),
        expect.anything(),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Save rule' }));

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/categorization-rules/rule-1', {
        name: 'ACME gadgets',
        conditions: saved.conditions,
        result: { categoryId: ELECTRONICS.id },
      }),
    );
    await waitFor(() => expect(offers.last?.message).toBe('Refile 2 existing rows with this rule?'));
    offers.last?.onApply();
    await waitFor(() => expect(post).toHaveBeenCalledWith('/categorization-rules/rule-1/apply'));
  });

  it('warns when a rule above takes every row this one matches', async () => {
    const above = { id: 'rule-top', name: 'Any store' };
    preview = { ...preview, shadowed: 2, matches: [match('tx-1', above), match('tx-2', above)] };
    renderWithQuery(<RuleEditorView id="rule-1" />);

    expect(await screen.findByText(/this rule never files them/)).toBeTruthy();
    expect(screen.getAllByText('goes to “Any store” first')).toHaveLength(2);
  });

  it('asks for a condition before it looks anything up', async () => {
    renderWithQuery(<RuleEditorView id="new" />);

    expect(await screen.findByText('Fill in at least one condition.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save rule' })).toHaveProperty('disabled', true);
    expect(post).not.toHaveBeenCalled();
  });
});
