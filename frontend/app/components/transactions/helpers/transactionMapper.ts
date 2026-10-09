import type { Transaction } from '../types';

export type TransactionApiRecord = Partial<Transaction> & {
  id: string;
  transactionDate: string;
  counterpartyName: string;
  paymentPurpose: string;
  debit?: number | null;
  credit?: number | null;
};

export function mapApiRecordToTransaction(tx: TransactionApiRecord): Transaction {
  return {
    id: tx.id,
    transactionDate: tx.transactionDate,
    documentNumber: tx.documentNumber,
    counterpartyName: tx.counterpartyName,
    counterpartyBin: tx.counterpartyBin,
    paymentPurpose: tx.paymentPurpose,
    debit: tx.debit || 0,
    credit: tx.credit || 0,
    amount: tx.debit ? -Math.abs(tx.debit) : Math.abs(tx.credit || 0),
    transactionType: tx.transactionType || (tx.debit ? 'expense' : 'income'),
    currency: tx.currency,
    exchangeRate: tx.exchangeRate,
    article: tx.article,
    amountForeign: tx.amountForeign,
    convertedAmount: tx.convertedAmount,
    conversionRate: tx.conversionRate,
    convertedCurrency: tx.convertedCurrency,
    category: tx.category,
    branch: tx.branch,
    wallet: tx.wallet,
    ownerMemberId: tx.ownerMemberId ?? null,
    isPrivate: tx.isPrivate ?? false,
    splitGroupId: tx.splitGroupId,
    splitIndex: tx.splitIndex,
    categorySource: tx.categorySource,
    categoryReason: tx.categoryReason,
    transferPairId: tx.transferPairId,
    transferPairSource: tx.transferPairSource,
    transferPairKind: tx.transferPairKind,
    reimbursementOfId: tx.reimbursementOfId,
    reimbursementOf: tx.reimbursementOf,
  };
}
