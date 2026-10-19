import {
  findMultiChargeMatch,
  type MatchCandidate,
  matchReceiptToTransactions,
  type ReceiptMatchInput,
  scoreCandidates,
} from '../../../../src/modules/receipts/services/receipt-transaction-match';

const row = (overrides: Partial<MatchCandidate> & { id: string }): MatchCandidate => ({
  transactionDate: '2026-05-10',
  amount: 42.5,
  currency: 'EUR',
  counterpartyName: 'REWE SAGT DANKE',
  vendorNormalized: null,
  transactionType: 'expense',
  ...overrides,
});

const receipt: ReceiptMatchInput = {
  amount: 42.5,
  currency: 'EUR',
  date: '2026-05-10',
  vendor: 'REWE',
  transactionType: 'expense',
};

describe('receipt → transaction matcher', () => {
  it('matches the row with the same money, same day and the same name', () => {
    const match = matchReceiptToTransactions(receipt, [
      row({ id: 'rewe' }),
      row({ id: 'other', counterpartyName: 'LIDL', transactionDate: '2026-05-12' }),
    ]);
    expect(match).toEqual({ transactionIds: ['rewe'], kind: 'single', score: expect.any(Number) });
  });

  it('refuses when two rows are equally plausible', () => {
    expect(
      matchReceiptToTransactions(receipt, [
        row({ id: 'a', counterpartyName: 'REWE' }),
        row({ id: 'b', counterpartyName: 'REWE' }),
      ]),
    ).toBeNull();
  });

  it('ignores other currencies, the other direction, far dates and other amounts', () => {
    expect(
      scoreCandidates(receipt, [
        row({ id: 'usd', currency: 'USD' }),
        row({ id: 'income', transactionType: 'income' }),
        row({ id: 'late', transactionDate: '2026-05-20' }),
        row({ id: 'cheap', amount: 40 }),
      ]),
    ).toEqual([]);
  });

  it('tolerates a cent of rounding and a day of settlement delay', () => {
    const [best] = scoreCandidates(receipt, [
      row({ id: 'close', amount: 42.9, transactionDate: '2026-05-11' }),
    ]);
    expect(best?.candidate.id).toBe('close');
    expect(best?.score).toBeGreaterThanOrEqual(0.6);
  });

  it('does not match without a date', () => {
    expect(matchReceiptToTransactions({ ...receipt, date: null }, [row({ id: 'rewe' })])).toBeNull();
  });

  it('finds the shipments that add up to one Amazon order', () => {
    const order: ReceiptMatchInput = {
      amount: 99.97,
      currency: 'EUR',
      date: '2026-05-10',
      vendor: 'Amazon.de',
      transactionType: 'expense',
    };
    const match = findMultiChargeMatch(order, [
      row({ id: 's1', counterpartyName: 'AMAZON.DE', amount: 50, transactionDate: '2026-05-11' }),
      row({ id: 's2', counterpartyName: 'AMAZON.DE', amount: 37, transactionDate: '2026-05-12' }),
      row({ id: 's3', counterpartyName: 'AMAZON.DE', amount: 12.97, transactionDate: '2026-05-14' }),
      row({ id: 'noise', counterpartyName: 'AMAZON.DE', amount: 12.97, transactionDate: '2026-05-30' }),
      row({ id: 'lidl', counterpartyName: 'LIDL', amount: 50, transactionDate: '2026-05-11' }),
    ]);
    expect(match).toEqual({ transactionIds: ['s1', 's2', 's3'], kind: 'multi', score: 0.7 });
  });

  it('prefers a single match over a multi-charge set', () => {
    const match = matchReceiptToTransactions(receipt, [
      row({ id: 'whole' }),
      row({ id: 'half-a', amount: 20 }),
      row({ id: 'half-b', amount: 22.5 }),
    ]);
    expect(match?.transactionIds).toEqual(['whole']);
  });
});
