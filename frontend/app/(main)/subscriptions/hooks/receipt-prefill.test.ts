import { describe, expect, it } from 'vitest';
import { buildReceiptPrefillParams, parseReceiptPrefill, type ReceiptPrefill } from './receipt-prefill';

const receipt: ReceiptPrefill = {
  vendor: 'ACME Cloud',
  amount: 5,
  currency: 'USD',
  date: '2026-06-20',
  transactionId: '00000000-0000-4000-8000-000000000001',
};

const roundTrip = (overrides: Partial<ReceiptPrefill> = {}) =>
  parseReceiptPrefill(buildReceiptPrefillParams({ ...receipt, ...overrides }), 'EUR');

describe('receipt prefill', () => {
  it('fills a monthly subscription charged a month after the receipt', () => {
    const form = roundTrip();
    expect(form).toMatchObject({
      vendorName: receipt.vendor,
      amount: receipt.amount,
      currency: receipt.currency,
      frequency: 'monthly',
      nextChargeDate: '2026-07-20',
    });
  });

  it('links the receipt bank row as the first payment', () => {
    expect(roundTrip()?.payments).toEqual([
      {
        key: receipt.transactionId,
        date: receipt.date,
        amount: receipt.amount,
        currency: receipt.currency,
        linked: true,
        transactionId: receipt.transactionId,
      },
    ]);
  });

  it('keeps a receipt without a bank row as a typed-in payment', () => {
    const [payment] = roundTrip({ transactionId: null })?.payments ?? [];
    expect(payment).toMatchObject({ linked: false, transactionId: null, date: receipt.date });
  });

  it('moves a month-end receipt to the end of the shorter month', () => {
    expect(roundTrip({ date: '2026-01-31' })?.nextChargeDate).toBe('2026-02-28');
  });

  it('adds no payment and no next charge without a date', () => {
    const form = roundTrip({ date: '' });
    expect(form?.nextChargeDate).toBe('');
    expect(form?.payments).toEqual([]);
  });

  it('falls back to the workspace currency', () => {
    expect(roundTrip({ currency: '' })?.currency).toBe('EUR');
  });

  it('ignores a page opened without a receipt', () => {
    expect(parseReceiptPrefill(new URLSearchParams('vendor=x'), 'EUR')).toBeNull();
  });
});
