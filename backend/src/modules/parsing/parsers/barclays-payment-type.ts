import type { PaymentType } from '../../../contracts/transactions/payment-type';

/**
 * How a Barclays line starts, by payment type. `card` and `bank_transfer_in`
 * are read off a real statement; the other six are assumed wording and are
 * tested on invented text only. The prefixes are mutually exclusive.
 */
export const BARCLAYS_PREFIXES: Record<PaymentType, readonly string[]> = {
  card: ['Card Payment to'],
  bank_transfer_in: ['Received from'],
  bank_transfer_out: ['Sent to', 'Bill Payment to'],
  direct_debit: ['Direct Debit to'],
  standing_order: ['Standing Order to'],
  cash: ['Cash Withdrawal'],
  fee: ['Monthly Account Fee', 'Overdraft Fee'],
  interest: ['Credit Interest', 'Debit Interest'],
};

const ENTRIES = Object.entries(BARCLAYS_PREFIXES) as Array<[PaymentType, readonly string[]]>;

/** The payment type a description starts with, or null when none of the wordings does. */
export function barclaysPaymentType(text: string): PaymentType | null {
  const clean = text.replace(/\s+/g, ' ').trim().toLowerCase();
  const hit = ENTRIES.find(([, prefixes]) =>
    prefixes.some(prefix => clean.startsWith(prefix.toLowerCase())),
  );
  return hit ? hit[0] : null;
}
