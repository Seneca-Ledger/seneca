import { fireEvent, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { budgetItem, subscriptionRow } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { SubscriptionItem } from '../hooks/useSubscriptionsPage';
import { normalizeSubscription } from '../hooks/useSubscriptionsPage';
import { SubscriptionDetailsDrawer } from './SubscriptionDetailsDrawer';

const apiPost = vi.hoisted(() => vi.fn(async () => ({ data: {} })));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/lib/api', () => ({ default: { post: apiPost }, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async ({ url }: { url: string }) =>
    url === '/budgets'
      ? [budgetItem({ id: 'budget-1', name: 'Software' })]
      : {
    subscription: {},
    charges: [
      {
        id: 'charge-1',
        transactionId: null,
        amount: '42.00',
        currency: 'ILS',
        chargeDate: '2026-09-10',
        expectedAmount: '42.00',
        expectedDate: null,
        matchStatus: 'matched',
        createdAt: '2026-09-10T00:00:00.000Z',
      },
    ],
    decisions: [],
    autoLinkPayees: [{ payeeId: 'payee-1', name: 'ACME Music Ltd', shared: false }],
  }),
}));

vi.mock('@/app/components/CustomDatePicker', () => ({
  default: ({ onChange }: { onChange: (value: string) => void }) => (
    <input aria-label="Payment date" onChange={event => onChange(event.target.value)} />
  ),
}));
vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const subscription: SubscriptionItem = normalizeSubscription(
  subscriptionRow({
    id: 'sub-1',
    vendorName: 'ACME Store - Wireless Buds',
    amount: '42.00',
    currency: 'ILS',
    nextChargeDate: '2026-11-10',
  }),
);

function renderDrawer(overrides: Partial<SubscriptionItem> = {}) {
  const onDecision = vi.fn(async () => undefined);
  const onEdit = vi.fn();
  const onStatusChange = vi.fn(async () => undefined);
  renderWithQuery(
    <SubscriptionDetailsDrawer
      subscription={{ ...subscription, ...overrides }}
      onClose={vi.fn()}
      onEdit={onEdit}
      onDecision={onDecision}
      onStatusChange={onStatusChange}
    />,
  );
  return { onDecision, onEdit, onStatusChange };
}

describe('SubscriptionDetailsDrawer', () => {
  it('shows the status as a word with a dot, the price and each date on its own line', () => {
    renderDrawer();

    expect(screen.getByText('Active')).toHaveClass('lumio-sub-detail__dot');
    expect(screen.getByText('₪42')).toBeInTheDocument();
    expect(screen.getByText('Expected charge').nextSibling).toHaveTextContent('Nov 10, 2026');
    expect(screen.getByText('Last charge').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('shows nothing beyond the price and dates: no owner, review, reason or history', () => {
    renderDrawer();

    expect(screen.queryByText('Owner')).toBeNull();
    expect(screen.queryByText('Reason')).toBeNull();
    expect(screen.queryByText('Charge history')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('cancels from a quiet text button', () => {
    const { onDecision } = renderDrawer();

    const cancel = screen.getByRole('button', { name: 'Record cancellation' });
    expect(cancel).toHaveClass('MuiButton-text');
    fireEvent.click(cancel);

    expect(onDecision).toHaveBeenCalledWith('sub-1', 'cancelled');
  });

  it('lists the payments and offers to link one typed in by hand', async () => {
    renderDrawer();

    expect(await screen.findByText('Sep 10, 2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link' })).toBeInTheDocument();
  });

  it('names the budget the subscription is paid from', async () => {
    renderDrawer({ budgetId: 'budget-1' });

    expect((await screen.findByText('Budget')).nextSibling).toHaveTextContent('Software');
  });

  it('says which payees are added automatically', async () => {
    renderDrawer();

    expect(
      await screen.findByText('New rows from ACME Music Ltd are added here automatically.'),
    ).toBeInTheDocument();
  });

  it('records a payment typed in against the subscription', async () => {
    renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Add payment' }));
    fireEvent.change(screen.getByLabelText('Payment date'), { target: { value: '2026-08-10' } });
    fireEvent.change(screen.getByPlaceholderText('42'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/subscriptions/sub-1/charges', {
        chargeDate: '2026-08-10',
        amount: 40,
      }),
    );
  });

  it('opens the form to correct the name or the price', () => {
    const { onEdit } = renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Subscription' }));

    expect(onEdit).toHaveBeenCalled();
  });

  it('pauses an active subscription', () => {
    const { onStatusChange } = renderDrawer();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(onStatusChange).toHaveBeenCalledWith('sub-1', 'paused');
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('resumes a paused one, which can still be cancelled', () => {
    const { onStatusChange } = renderDrawer({ status: 'paused' });

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    expect(onStatusChange).toHaveBeenCalledWith('sub-1', 'active');
    expect(screen.getByRole('button', { name: 'Record cancellation' })).toBeInTheDocument();
  });

  it('brings a cancelled one back', () => {
    const { onStatusChange } = renderDrawer({ status: 'cancelled' });

    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));

    expect(onStatusChange).toHaveBeenCalledWith('sub-1', 'active');
  });

  it('drops the cancel button once the subscription is cancelled', () => {
    renderDrawer({ status: 'cancelled' });

    expect(screen.queryByRole('button', { name: 'Record cancellation' })).toBeNull();
  });
});
