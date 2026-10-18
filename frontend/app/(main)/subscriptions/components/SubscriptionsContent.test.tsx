import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  SubscriptionChargeCalendar,
  SubscriptionItem,
  SubscriptionSummary,
} from '../hooks/useSubscriptionsPage';
import { normalizeSubscription } from '../hooks/useSubscriptionsPage';
import { categoryRef, subscriptionRow } from '@/app/test/fixtures/contracts';
import { SubscriptionsContent } from './SubscriptionsContent';

const appLocale = vi.hoisted(() => ({ current: 'en' }));
vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

vi.mock('./SubscriptionFormDrawer', () => ({ SubscriptionFormDrawer: () => null }));
vi.mock('./SubscriptionDetailsDrawer', () => ({ SubscriptionDetailsDrawer: () => null }));
vi.mock('./SubscriptionChargeCalendar', () => ({
  SubscriptionChargeCalendar: () => <div data-testid="charge-calendar" />,
}));

const subscription: SubscriptionItem = {
  ...normalizeSubscription(
    subscriptionRow({ id: 'sub-1', vendorName: 'Claude' }),
  ),
  amount: 100,
  riskStatus: 'price_changed',
  nextChargeDate: '2026-08-20',
  lastChargeDate: '2026-07-20',
};

const summary: SubscriptionSummary = {
  totalMonthlyCost: 100,
  activeCount: 1,
  upcomingCount: 1,
  upcoming30DaysCount: 1,
  priceChangeCount: 1,
  priceChangeYearlyEffect: 0,
  duplicateCount: 0,
  overdueReviewCount: 0,
  realizedAnnualSavings: 0,
};

const EMPTY: SubscriptionSummary = {
  totalMonthlyCost: 0,
  activeCount: 0,
  upcomingCount: 0,
  upcoming30DaysCount: 0,
  priceChangeCount: 0,
  priceChangeYearlyEffect: 0,
  duplicateCount: 0,
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
    subscriptions?: SubscriptionItem[];
    workspaceMembers?: Array<{ id: string; name?: string | null; email?: string | null }>;
    statusFilter?: string;
  } = {},
) =>
  render(
    <SubscriptionsContent
      subscriptions={overrides.subscriptions ?? [subscription]}
      summary={{ ...summary, ...overrides.summary }}
      chargeCalendar={overrides.chargeCalendar ?? emptyCalendar}
      workspaceCurrency="USD"
      workspaceMembers={overrides.workspaceMembers ?? []}
      isPending={false}
      isFetching={false}
      error={null}
      statusFilter={overrides.statusFilter ?? 'all'}
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
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it('shows the management KPIs and a desktop subscription row', () => {
    renderContent();

    expect(screen.getByText('Price changes')).toBeInTheDocument();
    expect(screen.getAllByText('Claude')).not.toHaveLength(0);
  });

  it('names the owner from the member list, since a row carries only the user id', () => {
    renderContent({
      subscriptions: [{ ...subscription, ownerId: 'user-2' }],
      workspaceMembers: [{ id: 'user-2', name: 'Ana', email: 'ana@example.com' }],
    });

    expect(screen.getByRole('cell', { name: 'Ana' })).toBeInTheDocument();
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

  it('tells an empty workspace there is nothing yet, with dashes for the summary and no filters', () => {
    renderContent({ subscriptions: [], summary: EMPTY });

    expect(screen.getByRole('heading', { name: 'No subscriptions yet' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Search subscriptions')).not.toBeVisible();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6);
    // The empty state's button leads; the toolbar's steps back to outlined.
    const addButtons = screen.getAllByRole('button', { name: /Add subscription/ });
    expect(addButtons.map(button => button.className.includes('MuiButton-contained'))).toEqual([
      false,
      true,
    ]);
  });

  it('shows dashes on every tab while the workspace has nothing to summarise', () => {
    renderContent({ subscriptions: [], summary: EMPTY, statusFilter: 'detected' });

    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText('0 USD')).toBeNull();
    expect(screen.queryByText('0')).toBeNull();
  });

  it("keeps the workspace's real figures on a tab that happens to be empty", () => {
    renderContent({ subscriptions: [], statusFilter: 'detected' });

    expect(screen.queryByText('—')).toBeNull();
  });

  it('says "No matches" with a way back when the filters hide every row', () => {
    renderContent();
    fireEvent.change(screen.getByLabelText('Search subscriptions'), {
      target: { value: 'nothing like this' },
    });

    expect(screen.getByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.queryByRole('heading', { name: 'No matches' })).toBeNull();
    expect(screen.getAllByText('Claude')).not.toHaveLength(0);
  });

  it("lists category filters in the reader's language and still filters by the stored name", () => {
    appLocale.current = 'ru';
    const advertising = categoryRef({
      id: 'c-ads',
      name: 'Advertising',
      isSystem: true,
      source: 'system',
    });
    renderContent({
      subscriptions: [
        { ...subscription, categoryId: advertising.id, category: advertising },
        { ...subscription, id: 'sub-2', vendorName: 'Adobe' },
      ],
    });
    const trigger = screen
      .getAllByRole('combobox')
      .find(element => element.textContent === 'All categories');
    if (!trigger) throw new Error('no category filter');

    fireEvent.mouseDown(trigger);
    expect(screen.queryByRole('option', { name: 'Advertising' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Реклама' }));

    expect(trigger).toHaveTextContent('Реклама');
    expect(screen.getAllByText('Claude')).not.toHaveLength(0);
    expect(screen.queryByText('Adobe')).toBeNull();
  });
});
