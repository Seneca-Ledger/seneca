import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SubscriptionChargeCalendar,
  SubscriptionItem,
  SubscriptionSummary,
} from '../hooks/useSubscriptionsPage';
import { SubscriptionsContent } from './SubscriptionsContent';

vi.mock('./SubscriptionFormDrawer', () => ({ SubscriptionFormDrawer: () => null }));
vi.mock('./SubscriptionDetailsDrawer', () => ({ SubscriptionDetailsDrawer: () => null }));
vi.mock('./SubscriptionChargeCalendar', () => ({
  SubscriptionChargeCalendar: () => <div data-testid="charge-calendar" />,
}));

const subscription: SubscriptionItem = {
  id: 'sub-1',
  vendorName: 'Claude',
  vendorRaw: null,
  vendorDomain: null,
  amount: 100,
  currency: 'USD',
  frequency: 'monthly',
  status: 'active',
  ownerId: null,
  owner: null,
  reviewAt: null,
  reviewStatus: 'current',
  riskStatus: 'price_changed',
  cancellationReason: null,
  realizedAnnualSavings: 0,
  confidence: null,
  nextChargeDate: '2026-08-20',
  lastChargeDate: '2026-07-20',
  categoryId: null,
  category: null,
  detectionMeta: null,
  createdAt: '2026-01-01',
};

const summary: SubscriptionSummary = {
  totalMonthlyCost: 100,
  activeCount: 1,
  upcomingCount: 1,
  upcoming30DaysCount: 1,
  priceChangeCount: 1,
  overdueReviewCount: 0,
  realizedAnnualSavings: 0,
};

const emptyCalendar: SubscriptionChargeCalendar = {
  currency: 'USD',
  months: [],
  monthTotals: [],
  rows: [],
};

const filledCalendar: SubscriptionChargeCalendar = {
  currency: 'USD',
  months: ['2026-09'],
  monthTotals: [100],
  rows: [{ subscriptionId: 'sub-1', vendorName: 'Claude', vendorDomain: null, amounts: [100] }],
};

const renderContent = (
  overrides: {
    summary?: Partial<SubscriptionSummary>;
    chargeCalendar?: SubscriptionChargeCalendar;
  } = {},
) =>
  render(
    <SubscriptionsContent
      subscriptions={[subscription]}
      summary={{ ...summary, ...overrides.summary }}
      chargeCalendar={overrides.chargeCalendar ?? emptyCalendar}
      workspaceCurrency="USD"
      workspaceMembers={[]}
      isPending={false}
      isFetching={false}
      error={null}
      statusFilter="all"
      setStatusFilter={vi.fn()}
      dialogOpen={false}
      editingSubscription={null}
      formData={{
        vendorName: '',
        amount: '',
        frequency: 'monthly',
        currency: 'USD',
        categoryId: '',
        nextChargeDate: '',
        vendorDomain: '',
      }}
      setFormData={vi.fn()}
      saving={false}
      openCreate={vi.fn()}
      invalidate={vi.fn(async () => undefined)}
      openEdit={vi.fn()}
      closeDialog={vi.fn()}
      handleSave={vi.fn()}
      handleDelete={vi.fn()}
      handleConfirm={vi.fn()}
      handleDismiss={vi.fn()}
      assignOwner={vi.fn(async () => undefined)}
      recordDecision={vi.fn(async () => undefined)}
    />,
  );

describe('SubscriptionsContent', () => {
  it('shows the management KPIs and a desktop subscription row', () => {
    renderContent();

    expect(screen.getByText('Price changes')).toBeInTheDocument();
    expect(screen.getAllByText('Claude')).not.toHaveLength(0);
  });

  it('labels the vendor icon so the row is readable without the logo', () => {
    renderContent();

    expect(screen.getAllByRole('img', { name: 'Claude' })).not.toHaveLength(0);
  });

  it('hides the charge calendar for a workspace with few subscriptions', () => {
    renderContent({ chargeCalendar: filledCalendar });

    expect(screen.queryByText('Upcoming charges')).not.toBeInTheDocument();
  });

  it('hides the charge calendar when the workspace is big but has no charges ahead', () => {
    renderContent({ summary: { activeCount: 5 } });

    expect(screen.queryByText('Upcoming charges')).not.toBeInTheDocument();
  });

  it('switches to the charge calendar once the workspace has enough subscriptions', async () => {
    renderContent({ summary: { activeCount: 5 }, chargeCalendar: filledCalendar });

    expect(screen.queryByTestId('charge-calendar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upcoming charges' }));
    // The matrix loads as its own chunk, so it arrives a tick later.
    expect(await screen.findByTestId('charge-calendar')).toBeInTheDocument();
  });
});
