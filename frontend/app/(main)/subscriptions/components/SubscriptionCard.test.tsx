import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SubscriptionItem } from '../hooks/useSubscriptionsPage';
import { normalizeSubscription } from '../hooks/useSubscriptionsPage';
import { subscriptionRow } from '@/app/test/fixtures/contracts';
import { monthlySetAsideOf, SubscriptionCard } from './SubscriptionCard';

const base: SubscriptionItem = {
  ...normalizeSubscription(
    subscriptionRow({ id: 'sub-1', vendorName: 'Adobe' }),
  ),
  amount: 240,
  frequency: 'annual',
  nextChargeDate: '2027-03-01',
  lastChargeDate: '2026-03-01',
};

const renderCard = (overrides: Partial<SubscriptionItem> = {}, props: Record<string, unknown> = {}) => {
  const onUse = vi.fn();
  const onSinkingFund = vi.fn();
  render(
    <SubscriptionCard
      subscription={{ ...base, ...overrides }}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onConfirm={vi.fn()}
      onDismiss={vi.fn()}
      onUse={onUse}
      onSinkingFund={onSinkingFund}
      {...props}
    />,
  );
  return { onUse, onSinkingFund };
};

describe('SubscriptionCard', () => {
  it('offers to set aside a monthly amount for an annual charge and records a tap', () => {
    const { onUse, onSinkingFund } = renderCard();

    fireEvent.click(screen.getByRole('button', { name: /Set aside 20 USD\/month/ }));
    expect(onSinkingFund).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Used it' }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });

  it('shows the linked savings goal instead of the button once one exists', () => {
    renderCard({ sinkingGoalId: 'goal-1' });

    expect(screen.queryByRole('button', { name: /Set aside/ })).not.toBeInTheDocument();
    expect(screen.getByText('Savings goal')).toBeInTheDocument();
  });

  it('explains a price change per charge and per year, and names a duplicate', () => {
    renderCard(
      {
        frequency: 'monthly',
        amount: 22,
        riskStatus: 'price_changed',
        detectionMeta: {
          priceChange: { previous: 20, current: 22, delta: 2, yearlyDelta: 24, detectedAt: '2026-09-01' },
        },
        usageCount: 4,
        costPerUse: 5.5,
      },
      { duplicate: true },
    );

    expect(screen.getByText('20 USD → 22 USD (2 USD per charge, 24 USD a year)')).toBeInTheDocument();
    expect(screen.getByText('6 USD per use (4)')).toBeInTheDocument();
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Set aside/ })).not.toBeInTheDocument();
  });

  it('computes the monthly set-aside only for quarterly and annual plans', () => {
    expect(monthlySetAsideOf(base)).toBe(20);
    expect(monthlySetAsideOf({ ...base, frequency: 'quarterly', amount: 90 })).toBe(30);
    expect(monthlySetAsideOf({ ...base, frequency: 'monthly' })).toBeNull();
  });
});
