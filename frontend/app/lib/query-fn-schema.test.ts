import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContractMismatchError, checkContract } from './query-fn-schema';

/** What GET /goals/:id/items returns (goal-items.service.ts buildResponse). */
const goalItems = {
  currency: 'EUR',
  items: [
    {
      id: 'item-1',
      name: 'Visa',
      estimatedAmount: 120,
      actualAmount: null,
      currency: 'EUR',
      dueMonth: '2026-11',
      status: 'planned',
      note: null,
      createdAt: '2026-10-11T12:00:00.000Z',
    },
  ],
  summary: {
    estimatedTotal: 120,
    committedTotal: 120,
    paidTotal: 0,
    outstanding: 120,
    targetAmount: 1000,
    unallocated: 880,
  },
};

describe('checkContract', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns a payload that matches its contract', async () => {
    await expect(checkContract('GoalItemsResponse', goalItems, '/goals/g/items')).resolves.toBe(
      goalItems,
    );
  });

  it('lets fields the contract does not know yet through', async () => {
    const withNewField = {
      ...goalItems,
      addedLater: true,
      items: [{ ...goalItems.items[0], tags: ['move'] }],
    };
    await expect(checkContract('GoalItemsResponse', withNewField, '/goals/g/items')).resolves.toEqual(
      withNewField,
    );
  });

  it('throws outside production, naming the url and the drifted field', async () => {
    const drifted = {
      ...goalItems,
      items: [{ ...goalItems.items[0], status: 'cancelled', estimatedAmount: '120' }],
    };

    const error = await checkContract('GoalItemsResponse', drifted, '/goals/g/items').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ContractMismatchError);
    expect((error as ContractMismatchError).url).toBe('/goals/g/items');
    expect((error as ContractMismatchError).issues).toEqual([
      expect.stringMatching(/^items\.0\.estimatedAmount: /),
      expect.stringMatching(/^items\.0\.status: /),
    ]);
  });

  it('passes the payload through unchecked in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const drifted = { ...goalItems, summary: null };

    await expect(checkContract('GoalItemsResponse', drifted, '/goals/g/items')).resolves.toBe(
      drifted,
    );
  });
});
