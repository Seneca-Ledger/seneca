import { fireEvent, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { subscriptionRow } from '@/app/test/fixtures/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import type { SubscriptionItem } from '../hooks/useSubscriptionsPage';
import { normalizeSubscription } from '../hooks/useSubscriptionsPage';
import { SubscriptionDetailsDrawer } from './SubscriptionDetailsDrawer';

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: 'en' }),
}));

vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/app/lib/query-fn-schema', () => ({
  apiQueryDecoded: vi.fn(async () => ({ charges: [], decisions: [] })),
}));

const subscription: SubscriptionItem = normalizeSubscription(
  subscriptionRow({
    id: 'sub-1',
    vendorName: 'KSP - AirPods Pro',
    amount: '42.00',
    currency: 'ILS',
    ownerId: 'user-1',
    nextChargeDate: '2026-11-10',
  }),
);

const members = [
  { id: 'user-1', name: 'Administrator', email: 'admin@example.com' },
  { id: 'user-2', name: 'Keller', email: 'keller@example.com' },
] as React.ComponentProps<typeof SubscriptionDetailsDrawer>['members'];

function renderDrawer(overrides: Partial<SubscriptionItem> = {}) {
  const onDecision = vi.fn(async () => undefined);
  const onAssignOwner = vi.fn(async () => undefined);
  renderWithQuery(
    <SubscriptionDetailsDrawer
      subscription={{ ...subscription, ...overrides }}
      members={members}
      onClose={vi.fn()}
      onAssignOwner={onAssignOwner}
      onDecision={onDecision}
    />,
  );
  return { onDecision, onAssignOwner };
}

describe('SubscriptionDetailsDrawer', () => {
  it('shows the status as a word with a dot, the price and each date on its own line', () => {
    renderDrawer();

    expect(screen.getByText('Active')).toHaveClass('lumio-sub-detail__dot');
    expect(screen.getByText('₪42')).toBeInTheDocument();
    expect(screen.getByText('Expected charge').nextSibling).toHaveTextContent('Nov 10, 2026');
    expect(screen.getByText('Last charge').nextSibling).toHaveTextContent('—');
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('offers to assign an owner only once a different person is picked', () => {
    renderDrawer();

    expect(screen.queryByRole('button', { name: 'Assign owner' })).toBeNull();
  });

  it('switches between keep and review as one state, recorded at once', () => {
    const { onDecision } = renderDrawer({ reviewStatus: 'needs_review' });

    expect(screen.getByRole('tab', { name: 'Review' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Keep' }));

    expect(onDecision).toHaveBeenCalledWith('sub-1', 'keep', { reviewAt: undefined });
    expect(screen.getByRole('tab', { name: 'Keep' })).toHaveAttribute('aria-selected', 'true');
  });

  it('records a cancellation from a quiet text button, with the reason and savings', () => {
    const { onDecision } = renderDrawer();

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Not used' } });
    fireEvent.change(screen.getByLabelText('Realized annual savings'), {
      target: { value: '504' },
    });
    const cancel = screen.getByRole('button', { name: 'Record cancellation' });
    expect(cancel).toHaveClass('MuiButton-text');
    fireEvent.click(cancel);

    expect(onDecision).toHaveBeenCalledWith('sub-1', 'cancelled', {
      note: 'Not used',
      realizedAnnualSavings: 504,
    });
  });
});
