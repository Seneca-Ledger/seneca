// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildReceiptPrefillParams } from './receipt-prefill';
import { useReceiptPrefill } from './useReceiptPrefill';

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => navigation.params }));

const receipt = {
  vendor: 'ACME Cloud',
  amount: 5,
  currency: 'USD',
  date: '2026-06-20',
  transactionId: null,
};

describe('useReceiptPrefill', () => {
  it('opens the add form filled from the receipt and clears the link', () => {
    navigation.params = buildReceiptPrefillParams(receipt);
    window.history.replaceState(null, '', `/subscriptions?${navigation.params}&tab=list`);
    const openCreate = vi.fn();
    const setFormData = vi.fn();

    const { rerender } = renderHook(
      ({ open }) => useReceiptPrefill(open, setFormData, 'EUR'),
      { initialProps: { open: openCreate } },
    );

    expect(openCreate).toHaveBeenCalledTimes(1);
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ vendorName: receipt.vendor, nextChargeDate: '2026-07-20' }),
    );
    expect(window.location.search).toBe('?tab=list');

    // The workspace loading gives a new openCreate: the form is not refilled over edits.
    rerender({ open: vi.fn() });
    expect(setFormData).toHaveBeenCalledTimes(1);
  });

  it('leaves the page alone without a receipt', () => {
    navigation.params = new URLSearchParams('tab=list');
    const openCreate = vi.fn();

    renderHook(() => useReceiptPrefill(openCreate, vi.fn(), 'EUR'));

    expect(openCreate).not.toHaveBeenCalled();
  });
});
