// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payee, PayeePeers, PayeeSummary } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import PayeePage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
const offers = vi.hoisted(() => ({ offerAction: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: 'http://api.test' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/payees/offer-action-toast', () => offers);
vi.mock('../components/PayeeTransactions', () => ({ PayeeTransactions: () => null }));
vi.mock('@/app/components/payees/PayeeDrawer', () => ({ PayeeDrawer: () => null }));
vi.mock('@/app/components/charts/lazy-charts', () => ({
  LazyPayeeLines: ({ lines }: { lines: Array<{ name: string }> }) => (
    <div data-testid="peer-lines">{lines.map(line => line.name).join(', ')}</div>
  ),
}));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({
  ReadOnlyHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'p-store' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        rename: value('Rename'),
        comparisonTitle: value('Against others in {{category}}'),
        comparisonEmpty: value('No other payees in this category yet.'),
        save: value('Save'),
        applyToPast: value('Apply to past transactions ({{count}})'),
        splitAlias: value('This is someone else'),
        nameTaken: value('Another payee has this name'),
      }),
  };
});

const store = 'ACME Store';
const payee: Payee = {
  id: 'p-store',
  name: store,
  mode: 'always',
  category: { id: 'c-1', name: 'Groceries' },
  defaultCategory: { id: 'c-1', name: 'Groceries', source: 'learned' },
  countryCode: null,
  vatId: null,
  vatIdStatus: null,
  vatIdName: null,
  vatIdCheckedAt: null,
  supplyType: null,
  transactionCount: 3,
  lastSeen: '2026-05-10',
};
const summary: PayeeSummary = {
  currency: 'EUR',
  months: Array.from({ length: 12 }, (_, index) => ({
    month: `2025-${String(index + 1).padStart(2, '0')}`,
    spent: index === 4 ? 50 : 0,
    received: 0,
  })),
  spentLastYear: 50,
  receivedLastYear: 0,
  count: 3,
  averageSpent: 25,
  firstSeen: '2026-05-01',
  lastSeen: '2026-05-10',
  aliases: [
    { key: 'acme store', example: store },
    { key: 'acme store berlin', example: 'ACME Store Berlin' },
  ],
  subscriptions: [],
  undecidedCount: 4,
  missingRates: [],
};

const months = summary.months.map(month => month.month);
const peers = (lines: PayeePeers['series']): PayeePeers => ({
  currency: 'EUR',
  direction: 'expense',
  category: { id: 'c-1', name: 'Groceries' },
  months,
  series: lines,
  missingRates: [],
});
const line = (payeeId: string, name: string, isSelf = false) => ({
  payeeId,
  name,
  isSelf,
  values: months.map(() => 10),
});
let peersAnswer = peers([line('p-store', store, true), line('p-bakery', 'Example Bakery')]);

describe('PayeePage', () => {
  beforeEach(() => {
    peersAnswer = peers([line('p-store', store, true), line('p-bakery', 'Example Bakery')]);
    api.get.mockReset().mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/payees/p-store'
            ? payee
            : url.endsWith('/summary')
              ? summary
              : url.endsWith('/peers')
                ? peersAnswer
                : [],
      }),
    );
    api.post.mockReset().mockResolvedValue({ data: { updated: 4 } });
    api.delete.mockReset().mockResolvedValue({ data: { updated: 1 } });
    api.patch.mockReset();
    offers.offerAction.mockReset();
  });

  it('draws the payee against the others of its category', async () => {
    renderWithQuery(<PayeePage />);
    expect(await screen.findByText('Against others in Groceries')).toBeInTheDocument();
    expect(screen.getByTestId('peer-lines')).toHaveTextContent(`${store}, Example Bakery`);
  });

  it('says so when its category has nobody else', async () => {
    peersAnswer = peers([line('p-store', store, true)]);
    renderWithQuery(<PayeePage />);
    expect(await screen.findByText('No other payees in this category yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('peer-lines')).not.toBeInTheDocument();
  });

  it('applies the pinned category to the past rows nobody categorised', async () => {
    renderWithQuery(<PayeePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Apply to past transactions (4)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/payees/p-store/apply-category', {}));
  });

  it('turns one of its statement names into a payee of its own', async () => {
    renderWithQuery(<PayeePage />);
    await screen.findByText('ACME Store Berlin');
    fireEvent.click(screen.getAllByRole('button', { name: 'This is someone else' })[1]);
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/payees/p-store/aliases/acme%20store%20berlin'),
    );
  });

  it('offers a merge, not a silent one, when the new name is taken', async () => {
    api.patch.mockRejectedValue({
      response: { status: 409, data: { error: { payeeId: '11111111-1111-1111-1111-111111111111' } } },
    });
    renderWithQuery(<PayeePage />);
    // The loading page already shows a (disabled) Rename; wait for the payee itself.
    await screen.findByRole('heading', { name: store });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename' }), {
      target: { value: 'ACME' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(offers.offerAction).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Another payee has this name' }),
      ),
    );
    expect(api.post).not.toHaveBeenCalled();
  });
});
