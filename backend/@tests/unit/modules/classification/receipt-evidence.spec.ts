import type { Transaction } from '@/entities/transaction.entity';
import { receiptEvidence } from '@/modules/classification/suggestions/receipt-evidence';

const WORKSPACE = 'ws-1';

const row = (id: string, amount: number, date = '2026-03-10'): Transaction =>
  ({
    id,
    transactionDate: date,
    amount,
    currency: 'EUR',
    counterpartyName: 'POS Purchase',
    transactionType: 'expense',
  }) as unknown as Transaction;

const receipt = (id: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id,
  transactionId: null,
  parsedData: { amount, currency: 'EUR', date: '2026-03-10', vendor: 'Example Shop' },
  ...extra,
});

const repo = (receipts: unknown[]) => {
  const query = { where: () => query, andWhere: () => query, getMany: async () => receipts };
  return { createQueryBuilder: () => query } as never;
};

describe('receiptEvidence', () => {
  it('pairs a receipt with the one row of its amount and date', async () => {
    const found = await receiptEvidence(repo([receipt('r1', 42.5)]), WORKSPACE, [
      row('t1', 42.5),
      row('t2', 9.99),
    ]);

    expect([...found.keys()]).toEqual(['t1']);
    expect(found.get('t1')).toMatchObject({ receiptId: 'r1', vendor: 'Example Shop' });
  });

  it('takes a receipt already attached to the row', async () => {
    const found = await receiptEvidence(
      repo([receipt('r1', 1, { transactionId: 't2' })]),
      WORKSPACE,
      [row('t1', 42.5), row('t2', 9.99)],
    );

    expect([...found.keys()]).toEqual(['t2']);
  });

  it('pairs nothing when two rows fit the receipt equally', async () => {
    const found = await receiptEvidence(repo([receipt('r1', 42.5)]), WORKSPACE, [
      row('t1', 42.5),
      row('t2', 42.5),
    ]);

    expect(found.size).toBe(0);
  });

  it('leaves out a row two receipts point at', async () => {
    const found = await receiptEvidence(
      repo([receipt('r1', 42.5), receipt('r2', 42.5)]),
      WORKSPACE,
      [row('t1', 42.5)],
    );

    expect(found.size).toBe(0);
  });
});
