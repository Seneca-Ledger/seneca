// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import DetailsDrawer from './DetailsDrawer';
import type { Transaction } from './types';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
const history = vi.hoisted(() => ({ events: [] as unknown[] }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useIsMobile', () => ({ useIsMobile: () => false }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary } = await import('@/app/components/dashboard/__tests__/intlayer-mock');
  return { useIntlayer: () => autoDictionary(), useLocale: () => ({ locale: 'en' }) };
});
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock('@/app/components/notes/NotesPanel', () => ({ NotesPanel: () => <div>notes panel</div> }));
vi.mock('@/app/audit/components/AuditEventDrawer', () => ({ AuditEventDrawer: () => null }));
vi.mock('@/app/components/payees/useOfferPayeeQueue', () => ({ useOfferPayeeQueue: () => vi.fn() }));
vi.mock('./hooks/useWorkspaceMembers', () => ({ useWorkspaceMembers: () => [] }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));
vi.mock('./hooks/useTransactionHistory', () => ({
  useTransactionHistory: () => ({
    historyEvents: history.events,
    historyLoading: false,
    historyDrawerOpen: false,
    selectedHistoryEvent: null,
    openEventDrawer: vi.fn(),
    closeEventDrawer: vi.fn(),
  }),
}));

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    transactionDate: '2026-10-12',
    counterpartyName: 'Blue Bottle Coffee',
    paymentPurpose: 'Card payment',
    debit: 12.5,
    credit: 0,
    amount: -12.5,
    transactionType: 'expense',
    currency: 'USD',
    isVerified: false,
    ...overrides,
  };
}

const SOURCE = { href: '/statements/st-1/edit', name: 'october.pdf', account: 'Chase · ••••1234' };

function renderDrawer(tx: Transaction, onChanged = vi.fn()) {
  renderWithQuery(
    <DetailsDrawer
      open
      transaction={tx}
      categories={[]}
      onClose={vi.fn()}
      onUpdateCategory={vi.fn()}
      onSplitDone={vi.fn()}
      source={SOURCE}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
}

describe('DetailsDrawer', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: [] });
    api.post.mockReset().mockResolvedValue({ data: { approved: 1 } });
    api.delete.mockReset().mockResolvedValue({ data: {} });
    history.events = [];
  });

  it('says which transaction it is before any action', () => {
    renderDrawer(transaction());

    expect(screen.getByText('Blue Bottle Coffee')).toBeInTheDocument();
    expect(screen.getByText('−$12.50')).toBeInTheDocument();
    expect(screen.getByText('october.pdf')).toBeInTheDocument();
    expect(screen.getByText('Chase · ••••1234')).toBeInTheDocument();
    expect(screen.getByText('sheet.unconfirmed')).toBeInTheDocument();
  });

  it('lists the actions with a line on what each means', () => {
    renderDrawer(transaction());

    expect(screen.getByText('sheet.splitHint')).toBeInTheDocument();
    expect(screen.getByText('sheet.contributionHint')).toBeInTheDocument();
    expect(screen.getByText('sheet.transferHint')).toBeInTheDocument();
  });

  it('starts a rule from the row, matching its payee as the bank wrote it', async () => {
    renderDrawer(transaction());

    fireEvent.click(screen.getByRole('button', { name: /drawer\.createFromRow/ }));

    expect(await screen.findByText('dialog.createTitle')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Blue Bottle Coffee')).toBeInTheDocument();
  });

  it('offers no rule from a private row', () => {
    renderDrawer(transaction({ isPrivate: true }));

    expect(screen.queryByRole('button', { name: /drawer\.createFromRow/ })).toBeNull();
  });

  it('names the rule that filed the row, linking to the rules page', () => {
    renderDrawer(
      transaction({
        category: { id: 'cat-1', name: 'Coffee' },
        categorySource: 'rule',
        categoryReason: 'Coffee shops',
      }),
    );

    expect(screen.getByText('drawer.fromRule').closest('a')?.getAttribute('href')).toBe('/rules');
  });

  it('confirms an unconfirmed row the way Review does, then hands back', async () => {
    const { onChanged } = renderDrawer(transaction());

    fireEvent.click(screen.getByRole('button', { name: 'sheet.confirm' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/review-inbox/transactions/approve', {
        ids: ['tx-1'],
      }),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('offers no confirm for a row already confirmed', () => {
    renderDrawer(transaction({ isVerified: true }));

    expect(screen.queryByRole('button', { name: 'sheet.confirm' })).toBeNull();
    expect(screen.getByText('sheet.confirmed')).toBeInTheDocument();
  });

  it('deletes only after asking once more', async () => {
    renderDrawer(transaction());

    fireEvent.click(screen.getByRole('button', { name: 'sheet.delete' }));
    expect(api.delete).not.toHaveBeenCalled();
    expect(screen.getByText('sheet.deleteQuestion')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'sheet.delete' }));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/transactions/tx-1'));
  });

  it('links to the document the row was read from', () => {
    renderDrawer(transaction());

    expect(screen.getByText('sheet.openDocument').closest('a')).toHaveAttribute(
      'href',
      '/statements/st-1/edit',
    );
  });

  it('says what history will hold when there is none yet', () => {
    renderDrawer(transaction());

    fireEvent.click(screen.getByRole('tab', { name: 'tabHistory' }));

    expect(screen.getByText('sheet.historyEmpty')).toBeInTheDocument();
  });
});
