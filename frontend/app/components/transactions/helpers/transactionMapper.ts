import type { StatementTransaction } from '@/app/lib/contracts';
import type { Transaction } from '../types';

export type TransactionApiRecord = Partial<Transaction> & {
  id: string;
  transactionDate: string;
  counterpartyName: string;
  paymentPurpose: string;
  debit?: number | null;
  credit?: number | null;
};

const decimal = (value: string | null): number | undefined =>
  value === null ? undefined : Number(value);

type Relations = 'category' | 'branch' | 'wallet';

/** A transaction row off the wire; candidate lists come without the relations. */
type WireTransactionRow = Omit<StatementTransaction, Relations | 'amount'> &
  Partial<Pick<StatementTransaction, Relations | 'amount'>>;

/** A row off the wire (money as decimal strings, nulls) in the shape the mapper takes. */
export function fromStatementTransaction(tx: WireTransactionRow): TransactionApiRecord {
  return {
    ...tx,
    documentNumber: tx.documentNumber ?? undefined,
    counterpartyBin: tx.counterpartyBin ?? undefined,
    article: tx.article ?? undefined,
    debit: decimal(tx.debit),
    credit: decimal(tx.credit),
    // Recomputed from debit and credit by the mapper.
    amount: undefined,
    exchangeRate: decimal(tx.exchangeRate),
    amountForeign: decimal(tx.amountForeign),
    category: tx.category ?? undefined,
    branch: tx.branch ?? undefined,
    wallet: tx.wallet ?? undefined,
  };
}

export function mapApiRecordToTransaction(tx: TransactionApiRecord): Transaction {
  return {
    id: tx.id,
    transactionDate: tx.transactionDate,
    documentNumber: tx.documentNumber,
    counterpartyName: tx.counterpartyName,
    counterpartyBin: tx.counterpartyBin,
    paymentPurpose: tx.paymentPurpose,
    paymentType: tx.paymentType,
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
    walletId: tx.walletId ?? null,
    ownerMemberId: tx.ownerMemberId ?? null,
    isPrivate: tx.isPrivate ?? false,
    splitGroupId: tx.splitGroupId,
    splitIndex: tx.splitIndex,
    categorySource: tx.categorySource,
    categoryReason: tx.categoryReason,
    transferPairId: tx.transferPairId,
    transferPairSource: tx.transferPairSource,
    transferPairKind: tx.transferPairKind,
    investmentAccountId: tx.investmentAccountId ?? null,
    reimbursementOfId: tx.reimbursementOfId,
    reimbursementOf: tx.reimbursementOf,
    isVerified: tx.isVerified,
  };
}
