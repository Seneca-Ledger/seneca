import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetImpactNotice } from './BudgetImpactNotice';

const getMock = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/api', () => ({ default: { get: getMock } }));

describe('BudgetImpactNotice', () => {
  afterEach(() => {
    getMock.mockReset();
  });

  it('names the budget that goes over and the account that goes negative', async () => {
    getMock.mockResolvedValue({
      data: {
        budgets: [
          { id: 'b1', name: 'Food', currency: 'USD', remainingAfter: -10, exceeds: true },
          { id: 'b2', name: 'Everything', currency: 'USD', remainingAfter: 40, exceeds: false },
        ],
        account: {
          walletId: 'w1',
          name: 'Cash',
          currency: 'USD',
          balanceAfter: -20,
          overdraws: true,
        },
      },
    });

    render(<BudgetImpactNotice categoryId="c1" amount="30" currency="USD" date="2026-10-01" />);

    expect(await screen.findByText('Takes “Food” over its limit by 10 USD')).toBeInTheDocument();
    expect(screen.getByText('Leaves 40 USD in “Everything”')).toBeInTheDocument();
    expect(screen.getByText('Would overdraw “Cash”: balance -20 USD')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith(
      '/budgets/impact',
      expect.objectContaining({
        params: expect.objectContaining({ categoryId: 'c1', amount: 30, currency: 'USD' }),
      }),
    );
  });

  it('asks nothing until there is a category and a positive amount', () => {
    render(<BudgetImpactNotice categoryId="" amount="30" currency="USD" date="" />);
    render(<BudgetImpactNotice categoryId="c1" amount="0" currency="USD" date="" />);

    expect(getMock).not.toHaveBeenCalled();
  });
});
