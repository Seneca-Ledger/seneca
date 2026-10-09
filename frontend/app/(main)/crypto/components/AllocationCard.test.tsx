import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CryptoHolding } from '../hooks/useCrypto';
import { AllocationCard } from './AllocationCard';

function holding(asset: string, value: number): CryptoHolding {
  return {
    asset,
    amount: '1',
    price: value,
    value,
    avgCost: null,
    cost: null,
    unrealized: null,
    unrealizedPercent: null,
    realized: 0,
    basisIncomplete: true,
  };
}

const money = (value: number): string => `$${value}`;

describe('AllocationCard', () => {
  it('does not draw a tiny holding as a full bar', () => {
    const { container } = render(
      <AllocationCard
        holdings={[holding('USDT', 1272), holding('ETH', 3.5)]}
        money={money}
        title="Allocation"
      />,
    );

    const shares = [...container.querySelectorAll('[data-share]')].map(node =>
      Number(node.getAttribute('data-share')),
    );

    // 1 272 of 1 275.5 — all but a rounding crumb of the portfolio.
    expect(shares[0]).toBeGreaterThan(99);
    // A quarter of a per cent is drawn as the smallest visible sliver, not as 100%.
    expect(shares[1]).toBeLessThan(5);
    expect(shares[1]).toBeGreaterThan(0);
  });

  it('says "<1" rather than rounding a real holding down to nothing', () => {
    render(
      <AllocationCard
        holdings={[holding('USDT', 1272), holding('ETH', 3.5)]}
        money={money}
        title="Allocation"
      />,
    );

    expect(screen.getByText(/<1% · \$3.5/)).toBeInTheDocument();
  });
});
