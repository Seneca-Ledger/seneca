import type { SelectQueryBuilder } from 'typeorm';
import type { Transaction } from '@/entities/transaction.entity';
import { applyListFilters } from '@/modules/transactions/transaction-list-filters';

function fakeQuery() {
  const clauses: Array<{ sql: string; params?: Record<string, unknown> }> = [];
  const query = {
    andWhere: (sql: string, params?: Record<string, unknown>) => {
      clauses.push({ sql, params });
      return query;
    },
  };
  return { query: query as unknown as SelectQueryBuilder<Transaction>, clauses };
}

describe('applyListFilters paymentType', () => {
  it('adds no condition when the filter is absent', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, {}, 'member-1');
    expect(clauses).toEqual([]);
  });

  it('filters by the type and hides other members private rows', () => {
    const { query, clauses } = fakeQuery();
    applyListFilters(query, { paymentType: 'card' }, 'member-1');
    expect(clauses[0]).toEqual({
      sql: 'transaction.paymentType = :paymentType',
      params: { paymentType: 'card' },
    });
    expect(clauses[1].sql).toContain('transaction.isPrivate = false');
    expect(clauses[1].params).toEqual({ viewerMemberId: 'member-1' });
  });
});
