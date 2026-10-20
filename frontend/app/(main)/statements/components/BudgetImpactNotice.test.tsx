import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetImpactNotice } from './BudgetImpactNotice';

const getMock = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/api', () => ({ default: { get: getMock } }));

/** One notice line: the amount in it is its own (redactable) span. */
const line =
  (text: string) =>
  (_: string, element: Element | null): boolean =>
    element?.tagName === 'LI' && element.textContent === text;

describe('BudgetImpactNotice', () => {
  afterEach(() => {
    getMock.mockReset();
  });

  it('names the budget that goes over and the account that goes negative', async () => {
    getMock.mockResolvedValue({
      data: {
        budgets: [
          {
            id: 'b1',
            name: 'Food',
            categoryName: null,
            currency: 'USD',
            availableAmount: 20,
            spentAmount: 0,
            remainingAfter: -10,
            exceeds: true,
          },
          {
            id: 'b2',
            name: 'Everything',
            categoryName: null,
            currency: 'USD',
            availableAmount: 70,
            spentAmount: 0,
            remainingAfter: 40,
            exceeds: false,
          },
        ],
        account: {
          walletId: 'w1',
          name: 'Cash',
          currency: 'USD',
          balance: 10,
          balanceAfter: -20,
          overdraws: true,
        },
      },
    });

    render(<BudgetImpactNotice categoryId="c1" amount="30" currency="USD" date="2026-10-01" />);

    expect(await screen.findByText(line('Takes “Food” over its limit by 10 USD'))).toBeInTheDocument();
    expect(screen.getByText(line('Leaves 40 USD in “Everything”'))).toBeInTheDocument();
    expect(screen.getByText(line('Would overdraw “Cash”: balance -20 USD'))).toBeInTheDocument();
    expect(screen.getByText('10 USD')).toHaveClass('seneca-private');
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
