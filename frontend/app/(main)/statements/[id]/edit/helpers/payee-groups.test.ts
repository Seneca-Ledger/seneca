import { describe, expect, it } from 'vitest';
import type { Transaction } from '../editHelpers';
import { groupByPayee, needsCategory, sameUnfiledPayeeRows, unnamedRows } from './payee-groups';

const store = { id: 'payee-1', name: 'ACME Store' };
const courier = { id: 'payee-2', name: 'Example Courier' };
const groceries = { id: 'cat-1', name: 'Groceries' };
const fallback = { id: 'cat-0', name: 'Uncategorized' };

const row = (id: string, extra: Partial<Transaction>): Transaction => ({
  id,
  transactionDate: '2026-01-10',
  counterpartyName: extra.payee?.name ?? 'Someone',
  paymentPurpose: 'Payment',
  transactionType: 'expense',
  debit: 10,
  ...extra,
});

describe('needsCategory', () => {
  it('treats the workspace fallback the same as no category', () => {
    expect(needsCategory(row('a', {}))).toBe(true);
    expect(needsCategory(row('a', { category: fallback }))).toBe(true);
    expect(needsCategory(row('a', { category: groceries }))).toBe(false);
  });
});

describe('sameUnfiledPayeeRows', () => {
  it('finds the payee’s other rows still to file, and nothing already filed', () => {
    const picked = row('a', { payee: store });
    const waiting = row('b', { payee: store, category: fallback });
    const filed = row('c', { payee: store, category: groceries });
    const other = row('d', { payee: courier });

    const rest = sameUnfiledPayeeRows([picked, waiting, filed, other], picked);

    expect(rest.map(r => r.id)).toEqual([waiting.id]);
  });

  it('never spreads between rows the bank printed no payee for', () => {
    const a = row('a', { counterpartyName: 'POS Purchase' });
    const b = row('b', { counterpartyName: 'POS Purchase' });

    expect(sameUnfiledPayeeRows([a, b], a)).toEqual([]);
  });
});

describe('groupByPayee', () => {
  it('puts payees to file first, the busiest first, and sums signed amounts', () => {
    const rows = [
      row('a', { payee: courier, category: groceries }),
      row('b', { payee: courier, category: groceries }),
      row('c', { payee: courier, category: groceries }),
      row('d', { payee: store, debit: 25 }),
      row('e', { payee: store, debit: 0, credit: 5 }),
    ];

    const groups = groupByPayee(rows);

    expect(groups.map(g => g.name)).toEqual([store.name, courier.name]);
    expect(groups[0]).toMatchObject({ unfiled: 2, total: -20, category: null });
    expect(groups[1]).toMatchObject({ unfiled: 0, category: groceries });
  });

  it('leaves rows without a payee out of the groups and lists them apart', () => {
    const unnamed = row('a', { counterpartyName: 'POS Purchase' });
    const named = row('b', { payee: store });

    expect(groupByPayee([unnamed, named]).map(g => g.name)).toEqual([store.name]);
    expect(unnamedRows([unnamed, named]).map(r => r.id)).toEqual([unnamed.id]);
  });

  it('shows no shared category when the payee’s rows were filed differently', () => {
    const rows = [
      row('a', { payee: store, category: groceries }),
      row('b', { payee: store, category: { id: 'cat-2', name: 'Household' } }),
    ];

    expect(groupByPayee(rows)[0]?.category).toBeNull();
  });
});
