import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CryptoGains } from '../hooks/useCrypto';
import { GainsCard } from './GainsCard';

const labels = {
  title: 'Realized gains',
  hint: 'The holding period is stated as it is',
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
};

const gains: CryptoGains = {
  currency: 'EUR',
  disposals: [
    {
      id: 'ETH-2026-03-01-1',
      asset: 'ETH',
      date: '2026-03-01',
      acquiredOn: '2026-01-01',
      amount: 1,
      proceeds: 2500,
      cost: 1000,
      gain: 1500,
      heldDays: 59,
      uncoveredAmount: 0,
      uncoveredProceeds: 0,
      costIncomplete: false,
    },
  ],
  proceeds: 2500,
  cost: 1000,
  gain: 1500,
};

const money = (value: number): string => `€${value}`;

describe('GainsCard', () => {
  it('shows a sale against the purchase it consumed', () => {
    render(
      <GainsCard
        gains={gains}
        year={null}
        years={[2026]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    expect(screen.getByText('ETH')).toBeInTheDocument();
    expect(screen.getByText('59')).toBeInTheDocument();
    expect(screen.getAllByText('+€1500').length).toBeGreaterThan(0);
  });

  it('says there is nothing rather than showing an empty table', () => {
    render(
      <GainsCard
        gains={{ currency: 'EUR', disposals: [], proceeds: 0, cost: 0, gain: 0 }}
        year={2027}
        years={[2026, 2027]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    expect(screen.getByText(labels.empty)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: labels.exportCsv })).toBeDisabled();
  });

  it('asks for another year when one is picked', () => {
    const onYearChange = vi.fn();
    render(
      <GainsCard
        gains={gains}
        year={null}
        years={[2026]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={onYearChange}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: '2026' }));

    expect(onYearChange).toHaveBeenCalledWith(2026);
  });

  it('keeps two identical sales on the same day as two rows', () => {
    // The same sale twice: identical but for the place it holds in the report.
    const twin = { ...gains.disposals[0], id: 'ETH-2026-03-01-2' };
    render(
      <GainsCard
        gains={{ ...gains, disposals: [gains.disposals[0], twin] }}
        year={null}
        years={[2026]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    // A key built from asset, date and amount would have collapsed these into one.
    expect(screen.getAllByText('ETH')).toHaveLength(2);
  });

  it('marks a sale whose coins no purchase backs', () => {
    render(
      <GainsCard
        gains={{
          currency: 'EUR',
          proceeds: 2500,
          cost: 0,
          gain: 0,
          disposals: [
            {
              id: 'ETH-2026-03-01-1',
              asset: 'ETH',
              date: '2026-03-01',
              acquiredOn: null,
              amount: 0,
              proceeds: 0,
              cost: 0,
              gain: 0,
              heldDays: null,
              uncoveredAmount: 1,
              uncoveredProceeds: 2500,
              costIncomplete: true,
            },
          ],
        }}
        year={null}
        years={[2026]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    // A row with no purchase behind it says so instead of showing «Invalid Date».
    expect(screen.getByText('Purchase unknown')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Some coins arrived without a purchase behind them'),
    ).toBeInTheDocument();
  });
});
