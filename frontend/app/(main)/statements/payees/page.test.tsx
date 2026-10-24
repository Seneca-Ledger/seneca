// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PayeeDuplicateGroups, PayeesOverview } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import PayeesPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), params: new URLSearchParams('month=2026-05') }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: 'http://api.test' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/ui/page-title', () => ({
  PageTitle: ({ summary }: { summary?: string }) => <h1>Payees {summary}</h1>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => '/statements/payees',
  useSearchParams: () => nav.params,
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
}));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        spentTab: value('Spent'),
        receivedTab: value('Received'),
        total: value('Total: {{amount}}'),
        payeeCount: value('Payees: {{count}}'),
        duplicatesTitle: value('Payees that look alike: {{count}}'),
        duplicatesAction: value('Review'),
        mergeGroup: value('Merge'),
        columnPayee: value('Payee'),
      }),
  };
});

const store = 'ACME Store';
const bakery = 'Example Bakery';

const overview: PayeesOverview = {
  currency: 'EUR',
  rows: [
    { id: 'p-store', name: store, mode: 'auto', category: { id: 'c-1', name: 'Groceries' }, count: 2, amount: 50, lastSeen: '2026-05-10' },
    { id: 'p-bakery', name: bakery, mode: 'auto', category: null, count: 1, amount: 5, lastSeen: '2026-05-09' },
  ],
  totalPayees: 2,
  totalAmount: 55,
  months: [{ month: '2026-05', count: 3 }],
  missingRates: [],
};
const duplicates: PayeeDuplicateGroups = [
  {
    payees: [
      { id: 'p-bakery', name: bakery, count: 3 },
      { id: 'p-bakery-gmbh', name: 'Example Bakery GmbH', count: 1 },
    ],
  },
];

describe('PayeesPage', () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/payees/overview' ? overview : duplicates }),
    );
    api.post.mockReset().mockResolvedValue({ data: {} });
    nav.replace.mockReset();
  });

  it('lists who was paid in the month, biggest first, each opening its card', async () => {
    renderWithQuery(<PayeesPage />);

    const storeLink = await screen.findByRole('link', { name: store });
    expect(storeLink).toHaveAttribute('href', '/statements/payees/p-store');
    expect(screen.getByText(/Payees: 2/)).toHaveTextContent('Total: €55.00 · Payees: 2');
    const firstRow = screen.getAllByRole('row')[1];
    expect(within(firstRow).getByText('€50.00')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      '/payees/overview',
      expect.objectContaining({ params: expect.objectContaining({ month: '2026-05', direction: 'expense' }) }),
    );
  });

  it('switches to money received through the address', async () => {
    renderWithQuery(<PayeesPage />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Received' }));
    expect(nav.replace).toHaveBeenCalledWith(
      '/statements/payees?month=2026-05&direction=income',
      { scroll: false },
    );
  });

  it('offers payees that look alike and merges a group into the name kept', async () => {
    renderWithQuery(<PayeesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }));
    expect(screen.getByText('Payees that look alike: 1')).toBeInTheDocument();

    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Merge' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/payees/p-bakery/merge', {
        sourceIds: ['p-bakery-gmbh'],
      }),
    );
  });
});
