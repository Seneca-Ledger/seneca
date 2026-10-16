import { fireEvent, render, screen, within } from '@testing-library/react';
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
  acquiredUnknown: 'Unknown',
  totalRealized: 'Total realized',
  lotCount: '{count} lots',
  showUncovered: 'Show {count} rows without purchase data',
  hideUncovered: 'Hide rows without purchase data',
};

const gains: CryptoGains = {
  currency: 'EUR',
  incompleteCount: 0,
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
        gains={{ currency: 'EUR', disposals: [], proceeds: 0, cost: 0, gain: 0, incompleteCount: 0 }}
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

  it('keeps two identical sales on the same day as two lots of one sale', () => {
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

    expect(screen.getAllByTestId('gains-group')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    // A key built from asset, date and amount would have collapsed these into one.
    expect(screen.getAllByTestId('gains-lot')).toHaveLength(2);
  });

  it('groups lots of one sale day and coin into a summed row that expands', () => {
    const lot = (id: string, proceeds: number, cost: number, acquiredOn: string) => ({
      ...gains.disposals[0],
      id,
      date: '2025-10-27',
      acquiredOn,
      amount: 0.5,
      proceeds,
      cost,
      gain: proceeds - cost,
    });
    render(
      <GainsCard
        gains={{
          ...gains,
          disposals: [
            lot('a', 100, 60, '2025-01-01'),
            lot('b', 50, 40, '2025-02-01'),
            lot('c', 30, 10, '2025-03-01'),
            { ...gains.disposals[0], id: 'btc', asset: 'BTC', date: '2025-10-27' },
          ],
        }}
        year={null}
        years={[2025]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    const groups = screen.getAllByTestId('gains-group');
    expect(groups).toHaveLength(2);
    const eth = groups[0];
    expect(within(eth).getByText('Oct 27, 2025')).toBeInTheDocument();
    expect(eth).toHaveTextContent('ETH · 3 lots');
    expect(within(eth).getByText('1.5')).toBeInTheDocument();
    expect(within(eth).getByText('€180')).toBeInTheDocument();
    expect(within(eth).getByText('€110')).toBeInTheDocument();
    expect(within(eth).getByText('+€70')).toBeInTheDocument();
    expect(screen.queryAllByTestId('gains-lot')).toHaveLength(0);

    fireEvent.click(within(eth).getByRole('button', { expanded: false }));
    const lots = screen.getAllByTestId('gains-lot');
    expect(lots).toHaveLength(3);
    expect(within(lots[0]).getByText('Jan 1, 2025')).toBeInTheDocument();
    expect(within(lots[0]).getByText('+€40')).toBeInTheDocument();

    fireEvent.click(within(eth).getByRole('button', { expanded: true }));
    expect(screen.queryAllByTestId('gains-lot')).toHaveLength(0);
  });

  it('shows the totals in one quiet line above the table', () => {
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

    expect(screen.getByTestId('gains-totals')).toHaveTextContent(
      'Total realized +€1500 · Proceeds €2500 · Cost €1000',
    );
  });

  it('keeps a zero result grey and a loss terracotta', () => {
    const zero = { ...gains.disposals[0], id: 'z', asset: 'DOT', proceeds: 10, cost: 10, gain: 0 };
    const loss = { ...gains.disposals[0], id: 'l', asset: 'SOL', proceeds: 5, cost: 15, gain: -10 };
    render(
      <GainsCard
        gains={{ ...gains, gain: 0, disposals: [zero, loss] }}
        year={null}
        years={[2026]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    const zeroCells = screen.getAllByText('€0');
    expect(zeroCells.length).toBeGreaterThan(0);
    for (const cell of zeroCells) {
      expect(cell).toHaveStyle({ color: 'var(--muted-foreground)' });
      expect(cell).not.toHaveStyle({ color: 'var(--money-up)' });
    }
    expect(screen.queryByText('+€0')).not.toBeInTheDocument();
    expect(screen.getByText('€-10')).toHaveStyle({ color: 'var(--money-down)' });
  });

  it('hides rows with nothing covered behind a link', () => {
    const dust = {
      ...gains.disposals[0],
      id: 'dust',
      asset: 'TRX',
      date: '2026-02-01',
      acquiredOn: null,
      amount: 0,
      proceeds: 0,
      cost: 0,
      gain: 0,
      heldDays: null,
      uncoveredAmount: 0.0001,
      uncoveredProceeds: 0.00002,
      costIncomplete: true,
    };
    render(
      <GainsCard
        gains={{ ...gains, disposals: [gains.disposals[0], dust, { ...dust, id: 'dust-2' }] }}
        year={null}
        years={[2026]}
        labels={labels}
        locale="en"
        money={money}
        onYearChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('TRX')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 rows without purchase data' }));
    expect(screen.getByText('TRX')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide rows without purchase data' }));
    expect(screen.queryByText('TRX')).not.toBeInTheDocument();
  });

  it('marks a sale whose coins no purchase backs', () => {
    render(
      <GainsCard
        gains={{
          currency: 'EUR',
          incompleteCount: 1,
          proceeds: 2500,
          cost: 0,
          gain: 0,
          disposals: [
            {
              id: 'ETH-2026-03-01-1',
              asset: 'ETH',
              date: '2026-03-01',
              acquiredOn: null,
              amount: 0.5,
              proceeds: 1250,
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

    // A row with no purchase behind it says so in the Acquired column, behind an
    // ochre dot, instead of a red second line under the asset.
    const unknown = screen.getByText('Unknown');
    expect(unknown).toHaveClass('lumio-crypto-attention');
    expect(unknown).toHaveAttribute('title', 'Purchase unknown');
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    const note = screen.getByText('Some coins arrived without a purchase behind them');
    expect(note).toHaveClass('lumio-crypto-attention');
    expect(note).not.toHaveStyle({ color: 'var(--ff-dash-critical)' });
  });
});
