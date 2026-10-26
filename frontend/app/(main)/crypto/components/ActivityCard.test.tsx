import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CryptoGains } from '../hooks/useCrypto';
import { ActivityCard } from './ActivityCard';

const transactionLabels = {
  title: 'Transactions',
  empty: 'No transactions yet',
  date: 'Date',
  wallet: 'Wallet',
  counterparty: 'Counterparty',
  amount: 'Amount',
  worth: 'Value',
  received: 'Received',
  sent: 'Sent',
  receivedFrom: 'Received from {counterparty}',
  sentTo: 'Sent to {counterparty}',
};

const gainLabels = {
  title: 'Realized gains',
  hint: 'Holding periods are shown as recorded.',
  empty: 'No sales recorded in this period',
  allYears: 'All time',
  asset: 'Asset',
  sold: 'Sold',
  acquired: 'Acquired',
  amount: 'Amount',
  proceeds: 'Proceeds',
  cost: 'Cost',
  gain: 'Realized',
  heldDays: 'Days held',
  exportCsv: 'Download CSV',
  basisIncomplete: 'Purchase unknown',
  basisIncompleteHint: 'Some coins arrived without a purchase behind them',
  acquiredUnknown: 'Unknown',
  totalRealized: 'Total realized',
  lotCount: '{count} lots',
  showUncovered: 'Show {count} rows without purchase data',
  hideUncovered: 'Hide rows without purchase data',
};

const gains: CryptoGains = {
  currency: 'EUR',
  incompleteCount: 0,
  disposals: [],
  proceeds: 0,
  cost: 0,
  gain: 0,
};

describe('ActivityCard', () => {
  it('switches between transactions and realized gains in one card', () => {
    render(
      <ActivityCard
        transactions={[]}
        gains={gains}
        gainsYear={null}
        gainsYears={[2026]}
        onGainsYearChange={vi.fn()}
        locale="en"
        money={value => `€${value}`}
        labels={{ tabs: 'Wallet activity', transactions: transactionLabels, gains: gainLabels }}
      />,
    );

    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    // The year and the export belong to the gains tab only.
    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Realized gains' }));

    expect(screen.getByRole('tab', { name: 'Realized gains' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('No sales recorded in this period')).toBeInTheDocument();
    expect(screen.getByText('Holding periods are shown as recorded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument();
  });
});
