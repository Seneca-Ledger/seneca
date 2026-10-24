// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountStatement, WalletItem, WalletSummary } from '@/app/lib/contracts';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import AccountsPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/ui/page-title', () => ({ PageTitle: () => <h1>Accounts</h1> }));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({
  ReadOnlyHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/components/mobile/quick-actions-store', () => ({ useQuickActions: () => {} }));
vi.mock('@/app/components/transactions/hooks/useWorkspaceMembers', () => ({
  useWorkspaceMembers: () => [],
}));
vi.mock('@/app/components/receipts/components/CurrencyDrawer', () => ({
  CurrencyDrawer: () => null,
}));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, title, children }: { isOpen: boolean; title: React.ReactNode; children: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog">
        {title}
        {children}
      </div>
    ) : null,
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
        addAccount: value('Add account'),
        emptyTitle: value('Add your first account'),
        groupEveryday: value('Everyday'),
        groupDebts: value('Debts'),
        owed: value('{{amount}} owed'),
        mismatch: value('Differs from the statement by {{amount}}'),
        asOf: value('as of {{date}}'),
        foundTitle: value('Accounts found in your statements'),
        createFromFound: value('Create account'),
        unlinkedTitle: value('Statements without an account: {{count}}'),
        newAccount: value('New account'),
        nameLabel: value('Name'),
        accountWithNumber: value('Account {{number}}'),
      }),
  };
});

const statementNumber = 'DE00 0000 0000 0000 0001';

const statement = (overrides: Partial<AccountStatement> & Pick<AccountStatement, 'id'>) => ({
  fileName: 'everyday.csv',
  bankName: 'other',
  accountNumber: statementNumber,
  currency: 'EUR',
  dateFrom: '2026-01-01',
  dateTo: '2026-01-31',
  balanceStart: 100,
  balanceEnd: 150,
  transactionCount: 2,
  suggestedWalletId: null,
  ...overrides,
});

function serve(
  accounts: WalletItem[],
  unlinked: AccountStatement[] = [],
  summary: WalletSummary = { currency: 'EUR', assets: 0, debts: 0, unconverted: [] },
) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data:
        url === '/wallets'
          ? accounts
          : url === '/wallets/summary'
            ? summary
            : url === '/wallets/unlinked-statements'
              ? unlinked
              : null,
    }),
  );
}

describe('AccountsPage', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset().mockResolvedValue({ data: {} });
  });

  it('starts with one button when there is no account yet', async () => {
    serve([]);

    renderWithQuery(<AccountsPage />);

    expect(await screen.findByText('Add your first account')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Add account' })).toHaveLength(1);
  });

  it('lists accounts by group, a debt as owed, and colours only a statement that disagrees', async () => {
    serve(
      [
        walletItem({
          id: 'w-everyday',
          name: 'Everyday',
          currency: 'EUR',
          balance: 150,
          lastActivityAt: '2026-01-20',
          reconciliation: {
            statementId: 's-1',
            date: '2026-01-31',
            statementBalance: 150,
            computedBalance: 150,
            matches: true,
          },
        }),
        walletItem({
          id: 'w-card',
          name: 'ACME Card',
          type: 'credit_card',
          currency: 'EUR',
          balance: -40,
          reconciliation: {
            statementId: 's-2',
            date: '2026-01-31',
            statementBalance: -50,
            computedBalance: -40,
            matches: false,
          },
        }),
      ],
      [],
      { currency: 'EUR', assets: 150, debts: 40, unconverted: [] },
    );

    renderWithQuery(<AccountsPage />);

    const everyday = await screen.findByRole('region', { name: 'Everyday' });
    const everydayRow = within(everyday).getByRole('link', { name: /Everyday/ });
    expect(everydayRow).toHaveAttribute('href', '/accounts/w-everyday');
    expect(everydayRow).toHaveTextContent('€150.00');
    expect(everydayRow).not.toHaveTextContent(/Differs/);

    const debts = screen.getByRole('region', { name: 'Debts' });
    expect(within(debts).getByRole('link', { name: /ACME Card/ })).toHaveTextContent(
      '€40.00 owed',
    );
    expect(within(debts).getByText(/Differs from the statement by/)).toHaveTextContent('€10.00');
  });

  it('opens a new account filled in from statements found with an unknown number', async () => {
    serve(
      [walletItem({ id: 'w-other', name: 'Other', currency: 'EUR' })],
      [
        statement({ id: 's-jan' }),
        statement({ id: 's-feb', dateFrom: '2026-02-01', dateTo: '2026-02-28', balanceStart: 150 }),
      ],
    );

    renderWithQuery(<AccountsPage />);

    expect(await screen.findByText('Accounts found in your statements')).toBeInTheDocument();
    expect(screen.getByText('Statements without an account: 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const drawer = await screen.findByRole('dialog');
    expect(within(drawer).getByText('New account')).toBeInTheDocument();
    expect(within(drawer).getByLabelText('Name')).toHaveValue('Account ••0001');
    // The earliest statement's opening balance, so the account agrees with the bank.
    expect(within(drawer).getByDisplayValue('100')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'save' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/wallets',
        expect.objectContaining({
          name: 'Account ••0001',
          accountNumber: statementNumber,
          currency: 'EUR',
          initialBalance: 100,
          statementIds: ['s-jan', 's-feb'],
        }),
      ),
    );
  });
});
