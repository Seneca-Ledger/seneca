import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalItemsResponse } from './contracts';
import { ContractMismatchError, decodeResponse } from './query-fn-schema';

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

describe('decodeResponse', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns a payload that matches its contract', () => {
    expect(decodeResponse(GoalItemsResponse, goalItems, '/goals/g/items')).toEqual(goalItems);
  });

  it('lets fields the contract does not know yet through', () => {
    const withNewField = {
      ...goalItems,
      addedLater: true,
      items: [{ ...goalItems.items[0], tags: ['move'] }],
    };
    expect(decodeResponse(GoalItemsResponse, withNewField, '/goals/g/items')).toEqual(withNewField);
  });

  it('throws outside production, naming the url and the drifted field', () => {
    const drifted = {
      ...goalItems,
      items: [{ ...goalItems.items[0], status: 'cancelled', estimatedAmount: '120' }],
    };

    let error: unknown;
    try {
      decodeResponse(GoalItemsResponse, drifted, '/goals/g/items');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ContractMismatchError);
    expect((error as ContractMismatchError).url).toBe('/goals/g/items');
    expect((error as ContractMismatchError).issues).toEqual([
      expect.stringMatching(/^items\.0\.estimatedAmount: /),
      expect.stringMatching(/^items\.0\.status: /),
    ]);
  });

  it('logs and passes the payload through in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const drifted = { ...goalItems, summary: null };

    expect(decodeResponse(GoalItemsResponse, drifted, '/goals/g/items')).toBe(drifted);
    expect(log).toHaveBeenCalledWith(expect.any(ContractMismatchError));
  });
});
