// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoalItemsResponse, GoalWithProgress, TransactionGoalLink } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { GoalLinkField } from './GoalLinkField';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet, put: apiPut } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const GOAL_NAME = 'Lisbon workation';

const goal: GoalWithProgress = {
  id: 'goal-1',
  name: GOAL_NAME,
  targetAmount: 1000,
  currency: 'USD',
  targetDate: null,
  currentAmount: 100,
  remaining: 900,
  percent: 10,
  isReached: false,
  createdAt: '2026-10-01T10:00:00.000Z',
  cover: null,
};

const unlinked: TransactionGoalLink = { goal: null, amount: null, itemId: null };
const linked = (itemId: string | null = null): TransactionGoalLink => ({
  goal: { id: goal.id, name: GOAL_NAME, currency: 'USD' },
  amount: -2.97,
  itemId,
});

const items: GoalItemsResponse = {
  currency: 'USD',
  items: [
    {
      id: 'item-1',
      name: 'Flights',
      estimatedAmount: 300,
      actualAmount: null,
      currency: 'USD',
      dueMonth: null,
      status: 'planned',
      note: null,
      createdAt: '2026-10-01T10:00:00.000Z',
    },
  ],
  summary: {
    estimatedTotal: 300,
    committedTotal: 300,
    paidTotal: 0,
    outstanding: 300,
    targetAmount: 1000,
    unallocated: 700,
  },
};

/** The server's link: a PUT changes it, so the refetch after a save reads the new one. */
function answer(initial: TransactionGoalLink) {
  let stored = initial;
  apiGet.mockImplementation(async (url: string) => {
    if (url === '/goals') return apiResponse([goal]);
    if (url === '/goals/goal-1/items') return apiResponse(items);
    return apiResponse(stored);
  });
  return (next: TransactionGoalLink) => {
    apiPut.mockImplementationOnce(async () => {
      stored = next;
      return apiResponse(next);
    });
  };
}

describe('GoalLinkField', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
  });

  it('says to approve first while there is no transaction to count', async () => {
    answer(unlinked);
    renderWithQuery(<GoalLinkField transactionId={null} />);

    expect(
      await screen.findByText('Approve the receipt to count it toward a goal'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Goal' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('counts the transaction toward the picked goal and says what it takes out', async () => {
    answer(unlinked)(linked());
    renderWithQuery(<GoalLinkField transactionId="tx-1" />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Goal' })).not.toHaveAttribute('aria-disabled'),
    );

    selectOption(screen.getByRole('combobox', { name: 'Goal' }), GOAL_NAME);

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/transactions/tx-1/goal', { goalId: 'goal-1' }),
    );
    expect(await screen.findByText(`Takes $2.97 out of ${GOAL_NAME}`)).toBeInTheDocument();
  });

  it("marks one of the linked goal's cost lines paid", async () => {
    answer(linked())(linked('item-1'));
    renderWithQuery(<GoalLinkField transactionId="tx-1" />);

    selectOption(await screen.findByRole('combobox', { name: 'Cost line' }), 'Flights');

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/transactions/tx-1/goal', {
        goalId: 'goal-1',
        goalItemId: 'item-1',
      }),
    );
  });
});
