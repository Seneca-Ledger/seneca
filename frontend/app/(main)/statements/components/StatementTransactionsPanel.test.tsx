// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { categoryRef, transactionItem } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { StatementTransactionsPanel } from './StatementTransactionsPanel';

const { confirmedPayee } = vi.hoisted(() => ({ confirmedPayee: 'ACME Store' }));
const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: async ({ url }: { url: string }) =>
    url === '/categories'
      ? []
      : {
          statement: { id: 'st-1', fileName: 'march.pdf', bankName: null, accountNumber: null },
          transactions: [
            transactionItem({
              id: 'tx-1',
              category: categoryRef({ id: 'cat-ads', name: 'Advertising' }),
            }),
            transactionItem({ id: 'tx-2', counterpartyName: confirmedPayee, isVerified: true }),
          ],
        },
}));

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/components/transactions/DetailsDrawer', () => ({ default: () => null }));
vi.mock('@/app/components/transactions/hooks/useBulkUpdateCategory', () => ({
  useBulkUpdateCategory: () => ({ mutateAsync: vi.fn() }),
}));
// The icon is looked up by the stored name, so the badge shows which name it got.
vi.mock('@/app/components/dashboard/CategoryIconBadge', () => ({
  CategoryIconBadge: ({ name }: { name: string }) => <i data-testid="category-icon">{name}</i>,
}));

describe('StatementTransactionsPanel', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it("names a system category in the reader's language and keeps the stored name for its icon", async () => {
    appLocale.current = 'ru';
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText('Реклама')).toBeInTheDocument();
    expect(screen.getByTestId('category-icon')).toHaveTextContent('Advertising');
  });

  it('shows the stored name in English', async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText('Advertising', { selector: 'span' })).toBeInTheDocument();
  });

  it('leaves out confirmed rows when Review opens it', async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" unconfirmedOnly />);

    expect(await screen.findByText('Advertising', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(confirmedPayee)).toBeNull();
  });

  it('shows every row in Documents', async () => {
    renderWithQuery(<StatementTransactionsPanel statementId="st-1" />);

    expect(await screen.findByText(confirmedPayee)).toBeInTheDocument();
  });
});
