import { describe, expect, it } from 'vitest';
import {
  directionOf,
  type ListedRow,
  monthBounds,
  OTHER_SLICE,
  paymentTypeFromParams,
  periodFromParams,
  rollUpSlices,
  rowSides,
  signedAmount,
} from './all-transactions';

const checking = 'Checking Account';
const savings = 'Savings Account';
const merchant = 'ACME Store - Wireless Buds';

function row(overrides: Partial<ListedRow>): ListedRow {
  return {
    transactionType: 'expense',
    counterpartyName: merchant,
    wallet: { id: 'w-1', name: checking },
    transferPairId: null,
    transferPairKind: null,
    transferPairWallet: null,
    debit: null,
    credit: null,
    amount: null,
    ...overrides,
  } as ListedRow;
}

const params = (query: string) => new URLSearchParams(query);

describe('periodFromParams', () => {
  const now = new Date(2026, 9, 23);

  it('reads a valid month and falls back to this one', () => {
    expect(periodFromParams(params('month=2026-07'), now)).toEqual({ kind: 'month', month: '2026-07' });
    expect(periodFromParams(params('month=2026-13'), now)).toEqual({ kind: 'month', month: '2026-10' });
    expect(periodFromParams(params(''), now)).toEqual({ kind: 'month', month: '2026-10' });
  });

  it('shows everything with all=1', () => {
    expect(periodFromParams(params('all=1&month=2026-07'), now)).toEqual({ kind: 'all' });
  });
});

describe('monthBounds', () => {
  it('ends on the last day, leap years included', () => {
    expect(monthBounds('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('rowSides', () => {
  it('sends an expense from the wallet to the counterparty', () => {
    expect(rowSides(row({}))).toEqual({ source: checking, destination: merchant });
  });

  it('brings income from the counterparty into the wallet', () => {
    expect(rowSides(row({ transactionType: 'income' }))).toEqual({
      source: merchant,
      destination: checking,
    });
  });

  it("names a transfer's other wallet", () => {
    const leg = row({
      transferPairId: 'pair-1',
      transferPairWallet: { id: 'w-2', name: savings },
    });
    expect(rowSides(leg)).toEqual({ source: checking, destination: savings });
    expect(directionOf(leg)).toBe('transfer');
  });

  it('leaves an unnamed side empty', () => {
    expect(rowSides(row({ wallet: null }))).toEqual({ source: null, destination: merchant });
  });
});

describe('directionOf and signedAmount', () => {
  it('keeps a reimbursement as income', () => {
    expect(
      directionOf(row({ transactionType: 'income', transferPairId: 'p', transferPairKind: 'reimbursement' })),
    ).toBe('income');
  });

  it('signs by debit and credit, else by type', () => {
    expect(signedAmount(row({ debit: '4.94' }))).toBe(-4.94);
    expect(signedAmount(row({ transactionType: 'income', credit: '1861.50' }))).toBe(1861.5);
    expect(signedAmount(row({ transactionType: 'income', amount: '-20.00' }))).toBe(20);
  });
});

describe('rollUpSlices', () => {
  it('sums the smallest into one Other past nine', () => {
    const slices = Array.from({ length: 12 }, (_, index) => ({
      key: `k${index}`,
      name: `Slice ${index}`,
      value: 12 - index,
    }));
    const rolled = rollUpSlices(slices);
    expect(rolled).toHaveLength(9);
    expect(rolled[8]).toEqual({ key: OTHER_SLICE, name: '', value: 4 + 3 + 2 + 1, isOther: true });
  });
});

describe('paymentTypeFromParams', () => {
  it('reads an offered type', () => {
    expect(paymentTypeFromParams(new URLSearchParams('paymentType=card'))).toBe('card');
  });

  it('ignores a type the page does not offer, and a missing one', () => {
    expect(paymentTypeFromParams(new URLSearchParams('paymentType=cash'))).toBeUndefined();
    expect(paymentTypeFromParams(new URLSearchParams(''))).toBeUndefined();
  });
});
