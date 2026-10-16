import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CryptoHolding } from '../hooks/useCrypto';
import { HoldingsTable } from './HoldingsTable';

const labels = {
  title: 'Holdings',
  asset: 'Asset',
  balance: 'Balance',
  price: 'Price',
  worth: 'Value',
  avgCost: 'Avg cost',
  unrealized: 'Profit',
  basisUnknown: 'No purchase on record',
  share: 'Share',
  addHolding: 'Add holding',
};

function holding(overrides: Partial<CryptoHolding> = {}): CryptoHolding {
  return {
    asset: 'ETH',
    amount: '2',
    price: 2000,
    value: 4000,
    avgCost: 1000,
    cost: 2000,
    unrealized: 2000,
    unrealizedPercent: 100,
    realized: 0,
    basisIncomplete: false,
    ...overrides,
  };
}

const money = (value: number): string => `€${value}`;

describe('HoldingsTable', () => {
  it('shows what a coin cost on average and what it has gained', () => {
    render(
      <HoldingsTable holdings={[holding()]} labels={labels} locale="en" currency="USD" money={money} onAddHolding={() => undefined} />,
    );

    expect(screen.getByText('€1000')).toBeInTheDocument();
    // Profit is shown as money and as a share of what the coins cost.
    expect(screen.getByText('+€2000')).toBeInTheDocument();
    expect(screen.getByText('+100%')).toBeInTheDocument();
  });

  it('says so instead of showing a gain measured from zero', () => {
    render(
      <HoldingsTable
        holdings={[holding({ avgCost: null, cost: null, unrealized: null, unrealizedPercent: null })]}
        labels={labels}
        locale="en"
        currency="USD"
        money={money}
        onAddHolding={() => undefined}
      />,
    );

    expect(screen.getByText('No purchase on record')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('marks a loss apart from a gain', () => {
    render(
      <HoldingsTable
        holdings={[holding({ unrealized: -500, unrealizedPercent: -25 })]}
        labels={labels}
        locale="en"
        currency="USD"
        money={money}
        onAddHolding={() => undefined}
      />,
    );

    expect(screen.getByText('-25%')).toBeInTheDocument();
  });

  it('reads a stablecoin to four decimals, so a tiny loss is not a mystery', () => {
    render(
      <HoldingsTable
        holdings={[
          holding({ asset: 'USDT', amount: '1000', price: 0.9991, avgCost: 1, value: 999.1 }),
        ]}
        labels={labels}
        locale="en"
        currency="USD"
        money={money}
        onAddHolding={() => undefined}
      />,
    );

    expect(screen.getByText('$0.9991')).toBeInTheDocument();
    expect(screen.getByText('$1.0000')).toBeInTheDocument();
  });

  it('gives each holding its share of the portfolio and leaves noise uncoloured', () => {
    render(
      <HoldingsTable
        holdings={[
          holding({ asset: 'USDT', value: 75, unrealized: -0.1, unrealizedPercent: -0.07 }),
          holding({ asset: 'ETH', value: 25 }),
        ]}
        labels={labels}
        locale="en"
        currency="USD"
        money={money}
        onAddHolding={() => undefined}
      />,
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    // −0.07% is noise: the figure keeps the text colour.
    expect(screen.getByText('€-0.1')).not.toHaveStyle({ color: 'var(--money-down)' });
  });
});
