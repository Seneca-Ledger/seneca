import { addMonths, format, isValid, parseISO } from 'date-fns';
import type { SubscriptionFormData } from './useSubscriptionsPage';

/** What a receipt hands over when it is marked as a subscription. */
export interface ReceiptPrefill {
  vendor: string;
  amount: number;
  currency: string;
  /** yyyy-MM-dd: the day it was paid. */
  date: string;
  /** The receipt's bank row, linked as the first payment; null when it has none yet. */
  transactionId: string | null;
}

const FROM_PARAM = 'from';
const FROM_RECEIPT = 'receipt';
export const RECEIPT_PREFILL_PARAMS = [FROM_PARAM, 'vendor', 'amount', 'currency', 'date', 'tx'];

export function buildReceiptPrefillParams(prefill: ReceiptPrefill): URLSearchParams {
  const params = new URLSearchParams({
    [FROM_PARAM]: FROM_RECEIPT,
    vendor: prefill.vendor,
    amount: String(prefill.amount),
    currency: prefill.currency,
    date: prefill.date,
  });
  if (prefill.transactionId) params.set('tx', prefill.transactionId);
  return params;
}

/**
 * The add form filled from a receipt: monthly, next charge a month after the
 * receipt, and the receipt itself as the first payment.
 */
export function parseReceiptPrefill(
  params: URLSearchParams,
  fallbackCurrency: string,
): SubscriptionFormData | null {
  if (params.get(FROM_PARAM) !== FROM_RECEIPT) return null;
  const vendor = params.get('vendor') ?? '';
  const amount = Math.abs(Number(params.get('amount')));
  const currency = params.get('currency') || fallbackCurrency;
  const paid = parseISO(params.get('date') ?? '');
  const transactionId = params.get('tx');
  const date = isValid(paid) ? format(paid, 'yyyy-MM-dd') : '';
  const hasAmount = Number.isFinite(amount) && amount > 0;

  return {
    vendorName: vendor,
    amount: hasAmount ? amount : '',
    frequency: 'monthly',
    currency,
    categoryId: '',
    nextChargeDate: date ? format(addMonths(paid, 1), 'yyyy-MM-dd') : '',
    vendorDomain: '',
    budgetId: '',
    payments:
      date && hasAmount
        ? [
            {
              key: transactionId ?? `receipt-${date}`,
              date,
              amount,
              currency,
              linked: transactionId !== null,
              transactionId,
            },
          ]
        : [],
  };
}
