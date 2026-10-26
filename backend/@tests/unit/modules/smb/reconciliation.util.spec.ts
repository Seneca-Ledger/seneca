import {
  ageing,
  bucketFor,
  findDuplicateOpenItems,
  matchOpenItems,
  type OpenItem,
} from '@/modules/smb/reconciliation.util';

const item = (partial: Partial<OpenItem> & { id: string }): OpenItem => ({
  direction: 'payable',
  vendor: 'Landlord',
  amount: 500,
  currency: 'USD',
  dueDate: '2026-09-30',
  createdAt: '2026-09-01T00:00:00.000Z',
  status: 'to_pay',
  amountInWorkspace: 500,
  ...partial,
});

describe('matchOpenItems', () => {
  it('pairs a bill with the row of the same amount, preferring vendor and date evidence', () => {
    const matches = matchOpenItems(
      [item({ id: 'rent' })],
      [
        { id: 't1', type: 'expense', amount: 500, currency: 'USD', date: '2026-08-01', counterpartyName: 'Someone', paymentPurpose: null },
        { id: 't2', type: 'expense', amount: 500, currency: 'USD', date: '2026-10-01', counterpartyName: 'LANDLORD LLC', paymentPurpose: 'rent' },
        { id: 't3', type: 'income', amount: 500, currency: 'USD', date: '2026-10-01', counterpartyName: 'Landlord', paymentPurpose: null },
      ],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ itemId: 'rent', transactionId: 't2' });
    expect(matches[0].reasons).toEqual(['amount', 'vendor', 'date']);
    expect(matches[0].confidence).toBeGreaterThan(0.9);
  });

  it('uses each row once and skips other currencies', () => {
    const matches = matchOpenItems(
      [item({ id: 'a' }), item({ id: 'b', vendor: 'Other' })],
      [
        { id: 't1', type: 'expense', amount: 500, currency: 'USD', date: '2026-09-30', counterpartyName: 'Landlord', paymentPurpose: null },
        { id: 't2', type: 'expense', amount: 500, currency: 'EUR', date: '2026-09-30', counterpartyName: 'Other', paymentPurpose: null },
      ],
    );
    expect(matches).toEqual([expect.objectContaining({ itemId: 'a', transactionId: 't1' })]);
  });

  it("never offers an earlier month's payment for a recurring bill", () => {
    const row = (id: string, date: string) => ({
      id,
      type: 'expense' as const,
      amount: 500,
      currency: 'USD',
      date,
      counterpartyName: 'Landlord',
      paymentPurpose: null,
    });
    const due = item({ id: 'rent', dueDate: '2026-10-01' });

    expect(matchOpenItems([due], [row('jul', '2026-07-01'), row('sep', '2026-09-01')])).toEqual([]);
    expect(matchOpenItems([due], [row('early', '2026-09-15')])).toEqual([
      expect.objectContaining({ transactionId: 'early' }),
    ]);
    expect(matchOpenItems([due], [row('late', '2026-11-10')])).toEqual([
      expect.objectContaining({ transactionId: 'late' }),
    ]);
  });
});

describe('ageing', () => {
  it('puts open amounts into days-past-due buckets per direction', () => {
    expect(bucketFor('2026-10-01', '2026-10-01')).toBe('current');
    expect(bucketFor('2026-09-20', '2026-10-01')).toBe('d1_30');
    expect(bucketFor('2026-07-01', '2026-10-01')).toBe('d90_plus');
    expect(bucketFor(null, '2026-10-01')).toBe('current');

    const rows = ageing(
      [
        item({ id: 'a', dueDate: '2026-09-25', amountInWorkspace: 100 }),
        item({ id: 'b', dueDate: '2026-08-15', amountInWorkspace: 50, vendor: 'Old' }),
        item({ id: 'c', direction: 'receivable', vendor: 'Client', dueDate: '2026-06-01', amountInWorkspace: 900 }),
      ],
      '2026-10-01',
    );
    const payable = rows.find(row => row.direction === 'payable');
    expect(payable?.buckets).toMatchObject({ d1_30: 100, d31_60: 50, d90_plus: 0 });
    expect(payable?.total).toBe(150);
    expect(payable?.top[0]).toEqual({ vendor: 'Landlord', amount: 100, bucket: 'd1_30' });
    const receivable = rows.find(row => row.direction === 'receivable');
    expect(receivable?.buckets.d90_plus).toBe(900);
  });
});

describe('findDuplicateOpenItems', () => {
  it('groups the same vendor, amount and currency due within a week, nothing else', () => {
    const groups = findDuplicateOpenItems([
      item({ id: 'a', dueDate: '2026-09-30' }),
      item({ id: 'b', dueDate: '2026-10-03', vendor: 'landlord' }),
      item({ id: 'c', dueDate: '2026-11-30' }),
      item({ id: 'd', dueDate: '2026-10-01', amount: 501 }),
    ]);
    expect(groups).toEqual([{ vendor: 'Landlord', amount: 500, currency: 'USD', itemIds: ['a', 'b'] }]);
  });
});
