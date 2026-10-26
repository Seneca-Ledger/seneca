import { describe, expect, it } from 'vitest';
import type { TopCategoryRecord } from '@/app/(main)/statements/components/top-categories.utils';
import { expandRecordsByTag } from './tag-records';

const trip = { id: 'tag-trip', name: 'Team Trip' };
const office = { id: 'tag-office', name: 'Office Move' };

const record = (overrides: Partial<TopCategoryRecord>): TopCategoryRecord =>
  ({
    id: 'row',
    sourceType: 'statement',
    sourceChannel: 'bank',
    flowType: 'expense',
    category: 'Groceries',
    amount: 10,
    currencyValue: 'EUR',
    dateValue: '2026-10-01',
    color: '#123456',
    icon: 'cart',
    ...overrides,
  }) as TopCategoryRecord;

describe('expandRecordsByTag', () => {
  it('repeats a transaction once per tag it carries and drops untagged ones', () => {
    const twoTags = record({ id: 'tx-1', transactionId: 'tx-1', amount: 40 });
    const untagged = record({ id: 'tx-2', transactionId: 'tx-2' });
    const links = [
      { transactionId: 'tx-1', tagId: trip.id },
      { transactionId: 'tx-1', tagId: office.id },
    ];

    const result = expandRecordsByTag([twoTags, untagged], links, [], [trip, office]);

    expect(result.map(r => [r.category, r.amount])).toEqual([
      [trip.name, 40],
      [office.name, 40],
    ]);
    expect(result[0]).toMatchObject({ color: null, icon: null });
  });

  it('takes a standalone receipt’s own tags, once even when its transaction has the same one', () => {
    const receipt = record({ id: 'rcpt-1', sourceType: 'receipt', transactionId: 'tx-9' });

    const result = expandRecordsByTag(
      [receipt],
      [{ transactionId: 'tx-9', tagId: trip.id }],
      [{ id: 'rcpt-1', tags: [trip, office] }],
      [trip, office],
    );

    expect(result.map(r => r.category).sort()).toEqual([office.name, trip.name].sort());
  });

  it('skips a tag it has no name for (deleted meanwhile)', () => {
    const tx = record({ transactionId: 'tx-1' });
    expect(expandRecordsByTag([tx], [{ transactionId: 'tx-1', tagId: 'gone' }], [], [])).toEqual(
      [],
    );
  });
});
