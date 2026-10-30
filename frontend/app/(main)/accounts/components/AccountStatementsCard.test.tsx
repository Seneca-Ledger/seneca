// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountStatement } from '@/app/lib/contracts';
import { walletItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { useAccountMutations } from '../hooks/useAccounts';
import { AccountStatementsCard } from './AccountStatementsCard';

const api = vi.hoisted(() => ({ get: vi.fn() }));
const importButton = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/versions/ReadOnlyHint', () => ({
  ReadOnlyHint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/app/components/import-wizard/ImportFromFileButton', () => ({
  ImportFromFileButton: (props: { account?: { id: string; currency: string } }) => {
    importButton(props);
    return <button type="button">Import from file</button>;
  },
}));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({
    isOpen,
    children,
    footer,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null,
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) => (
    <a href={href}>{children}</a>
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
        statementsTitle: value('Statements'),
        noStatements: value('No statements yet.'),
        linkStatements: value('Link statements'),
        linkSave: value('Link'),
        noAccountOption: value('Not now'),
        unlink: value('Unlink'),
      }),
  };
});

const account = walletItem({ id: 'w-online', name: 'Online', currency: 'USD' });

const statement = (overrides: Partial<AccountStatement> & Pick<AccountStatement, 'id'>) => ({
  fileName: `${overrides.id}.csv`,
  bankName: 'other',
  accountNumber: null,
  currency: 'USD',
  dateFrom: '2026-01-01',
  dateTo: '2026-01-31',
  balanceStart: null,
  balanceEnd: null,
  transactionCount: 2,
  suggestedWalletId: null,
  ...overrides,
});

function renderCard(unlinked: AccountStatement[]) {
  api.get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/wallets/unlinked-statements' ? unlinked : null }),
  );
  const mutations = {
    saving: false,
    attach: vi.fn().mockResolvedValue(true),
    detach: vi.fn().mockResolvedValue(true),
  } as unknown as ReturnType<typeof useAccountMutations>;
  renderWithQuery(
    <AccountStatementsCard
      account={account}
      statements={[]}
      mutations={mutations}
      money={value => String(value)}
    />,
  );
  return mutations;
}

describe('AccountStatementsCard', () => {
  beforeEach(() => {
    api.get.mockReset();
    importButton.mockReset();
  });

  it('imports a bank export straight into the account, in its currency', async () => {
    renderCard([]);

    expect(await screen.findByText('No statements yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from file' })).toBeInTheDocument();
    expect(importButton).toHaveBeenLastCalledWith(
      expect.objectContaining({ account: { id: account.id, currency: 'USD' } }),
    );
    expect(screen.queryByRole('button', { name: 'Link statements' })).toBeNull();
  });

  it('links only statements in its currency, the ones it most likely holds picked already', async () => {
    const mutations = renderCard([
      statement({ id: 'likely', suggestedWalletId: account.id }),
      statement({ id: 'unsure' }),
      statement({ id: 'elsewhere', suggestedWalletId: 'w-other' }),
      statement({ id: 'euro', currency: 'EUR' }),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: 'Link statements' }));
    const drawer = screen.getByRole('dialog');
    expect(within(drawer).getByText('likely.csv')).toBeInTheDocument();
    expect(within(drawer).getByText('unsure.csv')).toBeInTheDocument();
    expect(within(drawer).getByText('elsewhere.csv')).toBeInTheDocument();
    expect(within(drawer).queryByText('euro.csv')).toBeNull();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Link' }));
    expect(mutations.attach).toHaveBeenCalledWith(account.id, ['likely']);
  });
});
