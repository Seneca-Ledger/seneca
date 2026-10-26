// @vitest-environment jsdom
import type { GoalPlanResponse } from '@/app/lib/goals-api';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { wholeLine } from '@/app/components/dashboard/__tests__/whole-line';
import { GoalPlanCard } from './GoalPlanCard';

// The wire format (packages/contracts GoalPlanResponse): the goal from the
// screenshot that prompted the redesign, 200 of 4 000 saved, 9 months left,
// budgets already 19.18 over income.
function plan(overrides: Partial<GoalPlanResponse> = {}): GoalPlanResponse {
  return {
    goalId: 'g1',
    currency: 'USD',
    target: { declared: 4000, estimated: 0, unallocated: 4000 },
    saved: 200,
    remaining: 3800,
    targetDate: '2027-06-30',
    monthsLeft: 9,
    requiredPerMonth: 422.22,
    pace: { perMonth: 0, monthsObserved: 0 },
    forecast: { month: null, monthsLate: null },
    capacity: { income: 1000, committed: 1019.18, free: -19.18 },
    gap: 441.4,
    status: 'not_feasible',
    ...overrides,
  };
}

const money = (value: number): string => `$${value.toFixed(2)}`;

describe('GoalPlanCard', () => {
  it('explains a gap larger than the required amount as goal plus budget overflow', () => {
    render(<GoalPlanCard plan={plan()} locale="en" formatAmount={money} />);

    expect(screen.getByText('$441.40')).toBeInTheDocument();
    expect(
      screen.getByText(wholeLine('$422.22 for the goal + $19.18 by which budgets exceed income')),
    ).toBeInTheDocument();
    expect(screen.getByText('Budgets already take more than your income')).toBeInTheDocument();
  });

  it('compares required with free when the budgets still leave room', () => {
    render(
      <GoalPlanCard
        plan={plan({ capacity: { income: 1300, committed: 1000, free: 300 }, gap: 122.22 })}
        locale="en"
        formatAmount={money}
      />,
    );

    expect(screen.getByText(wholeLine('$422.22 needed, $300.00 free'))).toBeInTheDocument();
    expect(screen.queryByText('Budgets already take more than your income')).toBeNull();
  });

  it('shows the verdict as a dot and a word, not a filled chip', () => {
    const { container } = render(<GoalPlanCard plan={plan()} locale="en" formatAmount={money} />);

    expect(screen.getByText('Not feasible')).toBeInTheDocument();
    expect(container.querySelector('.MuiChip-root')).toBeNull();
  });

  it('puts the deadline in the subtitle with a pluralised month count', () => {
    render(<GoalPlanCard plan={plan()} locale="en" formatAmount={money} />);

    expect(screen.getByText('9 months until June 30, 2027')).toBeInTheDocument();
  });

  it('says why the pace is empty for a goal younger than a complete month', () => {
    render(<GoalPlanCard plan={plan()} locale="en" formatAmount={money} />);

    expect(
      screen.getByText('Counted over complete months; the first one is still running'),
    ).toBeInTheDocument();
    // The message is a hint, not the value: the pace and forecast read "—".
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('says no contributions came in when there is history but no pace', () => {
    render(
      <GoalPlanCard
        plan={plan({ pace: { perMonth: 0, monthsObserved: 3 } })}
        locale="en"
        formatAmount={money}
      />,
    );

    expect(screen.getByText('No contributions in the last complete months')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });
});
