import { describe, expect, it, vi } from 'vitest';
import {
  buildPayablesListParams,
  formatPayableDate,
  isPayableOverdue,
  sortPayables,
} from './payables-utils';

describe('payables-utils', () => {
  it('builds list params with sort and optional pagination', () => {
    const params = buildPayablesListParams(
      {
        search: 'acme',
        status: 'to_pay',
        source: 'manual',
        dueDateFrom: '2026-03-01',
        dueDateTo: '2026-03-31',
        sort: 'amountDesc',
      },
      { page: 2, limit: 50 },
    );

    expect(params).toEqual({
      page: 2,
      limit: 50,
      search: 'acme',
      status: 'to_pay',
      source: 'manual',
      dueDateFrom: '2026-03-01',
      dueDateTo: '2026-03-31',
      sort: 'amountDesc',
    });

    expect(
      buildPayablesListParams({
        search: '',
        status: 'all',
        source: 'all',
        dueDateFrom: '',
        dueDateTo: '',
        sort: 'dueDateAsc',
      }),
    ).toEqual({
      search: undefined,
      status: undefined,
      source: undefined,
      dueDateFrom: undefined,
      dueDateTo: undefined,
      sort: 'dueDateAsc',
    });
  });

  it('formats date-only values without timezone shift', () => {
    const formatted = formatPayableDate('2026-03-28', 'en');
    expect(formatted).toContain('3');
    expect(formatted).toContain('28');
    expect(formatted).not.toContain('27');
  });

  it('calculates overdue status from stable local dates', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 12, 0, 0));

    expect(isPayableOverdue({ status: 'to_pay', dueDate: '2026-03-14' })).toBe(true);
    expect(isPayableOverdue({ status: 'to_pay', dueDate: '2026-03-15' })).toBe(false);
    expect(isPayableOverdue({ status: 'archived', dueDate: '2026-03-14' })).toBe(false);

    vi.useRealTimers();
  });

  it('sorts date-only due dates deterministically', () => {
    const sorted = sortPayables(
      [
        {
          id: 'b',
          direction: 'payable' as const,
          vendor: 'Bravo',
          amount: 10,
          currency: 'KZT',
          dueDate: '2026-03-28',
          status: 'to_pay',
          paidAmount: 0,
          linkedTransactionId: null,
          source: 'manual',
          isRecurring: false,
          comment: null,
          statementId: null,
          paidAt: null,
          dueSoonNotifiedAt: null,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'a',
          direction: 'payable' as const,
          vendor: 'Alpha',
          amount: 5,
          currency: 'KZT',
          dueDate: '2026-03-05',
          status: 'to_pay',
          paidAmount: 0,
          linkedTransactionId: null,
          source: 'manual',
          isRecurring: false,
          comment: null,
          statementId: null,
          paidAt: null,
          dueSoonNotifiedAt: null,
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
      'dueDateAsc',
    );

    expect(sorted.map(item => item.id)).toEqual(['a', 'b']);
  });
});
