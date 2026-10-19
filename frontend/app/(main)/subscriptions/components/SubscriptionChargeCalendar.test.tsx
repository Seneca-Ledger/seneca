import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SubscriptionChargeCalendar as Calendar } from '../hooks/useSubscriptionsPage';
import { SubscriptionChargeCalendar } from './SubscriptionChargeCalendar';

const calendar: Calendar = {
  currency: 'EUR',
  months: ['2026-09', '2026-10'],
  monthTotals: [714, 24],
  rows: [
    { subscriptionId: 'a', vendorName: 'WeWork', vendorDomain: 'wework.com', amounts: [690, 0] },
    { subscriptionId: 'b', vendorName: 'ChatGPT', vendorDomain: null, amounts: [24, 24] },
  ],
};

const renderCalendar = () =>
  render(
    <SubscriptionChargeCalendar
      calendar={calendar}
      monthLabels={['сент. 26', 'окт. 26']}
      formatAmount={amount => `${amount} EUR`}
    />,
  );

describe('SubscriptionChargeCalendar', () => {
  it('has a column header per month and a row header per vendor', () => {
    renderCalendar();

    expect(screen.getByRole('columnheader', { name: 'сент. 26' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'окт. 26' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'WeWork' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'ChatGPT' })).toBeInTheDocument();
  });

  it('prints the amount in every charged cell, so colour is never the only signal', () => {
    renderCalendar();

    const row = screen.getByRole('rowheader', { name: 'WeWork' }).closest('tr');
    expect(within(row as HTMLElement).getByText('690 EUR')).toBeInTheDocument();
  });

  it('marks a month with no charge', () => {
    renderCalendar();

    const row = screen.getByRole('rowheader', { name: 'WeWork' }).closest('tr');
    expect(within(row as HTMLElement).getByText('No charge')).toBeInTheDocument();
  });

  it('totals each month', () => {
    renderCalendar();

    const total = screen.getByRole('rowheader', { name: 'Total' }).closest('tr');
    expect(within(total as HTMLElement).getByText('714 EUR')).toBeInTheDocument();
  });
});
