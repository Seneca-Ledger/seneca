import type { ReceiptDocument, Transaction } from '../types/statement-types';

/**
 * Only what a person confirmed counts in the numbers. A transaction counts once
 * it was confirmed in Review; a receipt counts once approved (its transaction
 * then carries it, and the record mappers drop the duplicate).
 */
export function keepConfirmed(data: { transactions: Transaction[]; receipts: ReceiptDocument[] }): {
  transactions: Transaction[];
  receipts: ReceiptDocument[];
} {
  return {
    transactions: data.transactions.filter(transaction => transaction.isVerified === true),
    receipts: data.receipts.filter(receipt => receipt.status === 'approved'),
  };
}
