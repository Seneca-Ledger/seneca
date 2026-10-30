import { useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { parseReceiptPrefill, RECEIPT_PREFILL_PARAMS } from './receipt-prefill';
import type { SubscriptionFormData } from './useSubscriptionsPage';

/**
 * Arriving from a receipt's "This is a subscription" opens the add form filled
 * from it. The parameters are cleared through history right away, so a reload
 * does not open the form again.
 */
export function useReceiptPrefill(
  openCreate: () => void,
  setFormData: (form: SubscriptionFormData) => void,
  workspaceCurrency: string,
): void {
  const searchParams = useSearchParams();
  // openCreate changes once the workspace loads; the form must not be refilled over edits.
  const handled = useRef(false);

  useEffect(() => {
    const prefill = searchParams && parseReceiptPrefill(searchParams, workspaceCurrency);
    if (!prefill || handled.current) return;
    handled.current = true;
    const url = new URL(window.location.href);
    for (const name of RECEIPT_PREFILL_PARAMS) url.searchParams.delete(name);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    // After openCreate, so a saved draft does not win over the receipt.
    openCreate();
    setFormData(prefill);
  }, [searchParams, openCreate, setFormData, workspaceCurrency]);
}
