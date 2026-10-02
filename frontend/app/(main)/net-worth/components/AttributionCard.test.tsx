// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AttributionCard } from './AttributionCard';

const labels = {
  title: 'What changed it',
  hint: 'The rows add up to the change.',
  kinds: { money: 'Money', revaluation: 'Revaluation', fx: 'Exchange rate' },
};

const money = (value: number) => `${value} T`;

describe('AttributionCard', () => {
  it('names each line and signs what it did', () => {
    render(
      <AttributionCard
        attribution={{
          byAccount: [
            { id: 'a', code: 'ASSET_CASH', name: 'Cash', amount: 500 },
            { id: 'b', code: 'LIABILITY_LOANS', name: 'Car loan', amount: -120 },
          ],
          byKind: [{ kind: 'money', amount: 380 }],
        }}
        formatMoney={money}
        labels={labels}
      />,
    );

    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('+500 T')).toBeInTheDocument();
    // A minus sign, not a hyphen, and the amount unsigned behind it.
    expect(screen.getByText('−120 T')).toBeInTheDocument();
  });

  it('tells money apart from the market and the rate', () => {
    render(
      <AttributionCard
        attribution={{
          byAccount: [{ id: 'a', code: 'ASSET_CASH', name: 'Cash', amount: 100 }],
          byKind: [
            { kind: 'money', amount: 60 },
            { kind: 'revaluation', amount: 25 },
            { kind: 'fx', amount: 15 },
          ],
        }}
        formatMoney={money}
        labels={labels}
      />,
    );

    expect(screen.getByText('Money')).toBeInTheDocument();
    expect(screen.getByText('Revaluation')).toBeInTheDocument();
    expect(screen.getByText('Exchange rate')).toBeInTheDocument();
  });

  it('shows nothing at all when nothing moved', () => {
    const { container } = render(
      <AttributionCard
        attribution={{ byAccount: [], byKind: [] }}
        formatMoney={money}
        labels={labels}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
