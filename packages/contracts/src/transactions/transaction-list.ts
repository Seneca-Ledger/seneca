import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';
import { PayeeRef } from '../payees/payees';
import { PaymentType } from './payment-type';

export const TransactionType = Schema.Literals(['income', 'expense']);
export type TransactionType = Wire<typeof TransactionType>;

const Named = Schema.Struct({ id: Schema.String, name: Schema.String });

/**
 * Which step set a row's category. On a row nobody confirmed yet, every source
 * but `manual`, `rule` and `default` is a suggestion the person still accepts.
 */
export const TransactionCategorySource = Schema.Literals([
  'manual',
  'rule',
  'keyword',
  'learned',
  'history',
  'ai',
  'default',
  'kind',
  'brand',
  'receipt',
]);
export type TransactionCategorySource = Wire<typeof TransactionCategorySource>;

/**
 * One row of `GET /transactions` (inside the `{ data }` envelope). Money and
 * rates are decimal strings: read them with `Number(...)`. Private rows arrive
 * with placeholder counterparty text, never null.
 */
export const TransactionListItem = Schema.Struct({
  id: Schema.String,
  statementId: Schema.NullOr(Schema.String),
  /** Set when the row came from a synced crypto wallet instead of a statement. */
  cryptoWalletId: Schema.NullOr(Schema.String),
  transactionDate: DateOnly,
  transactionType: TransactionType,
  isVerified: Schema.Boolean,
  documentNumber: Schema.NullOr(Schema.String),
  counterpartyName: Schema.String,
  counterpartyBin: Schema.NullOr(Schema.String),
  counterpartyAccount: Schema.NullOr(Schema.String),
  counterpartyBank: Schema.NullOr(Schema.String),
  paymentPurpose: Schema.String,
  /** How the bank says the money moved; empty unless the statement's parser sets it. */
  paymentType: Schema.optional(Schema.NullOr(PaymentType)),
  debit: Schema.NullOr(DecimalString),
  credit: Schema.NullOr(DecimalString),
  currency: Schema.String,
  exchangeRate: Schema.NullOr(DecimalString),
  amountForeign: Schema.NullOr(DecimalString),
  categoryId: Schema.NullOr(Schema.String),
  branchId: Schema.NullOr(Schema.String),
  walletId: Schema.NullOr(Schema.String),
  article: Schema.NullOr(Schema.String),
  comments: Schema.NullOr(Schema.String),
  category: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      isEnabled: Schema.Boolean,
      isSystem: Schema.Boolean,
      source: Schema.Literals(['system', 'user', 'parsing']),
    }),
  ),
  branch: Schema.NullOr(Named),
  wallet: Schema.NullOr(Named),
  /** The signed amount in the row's currency; `debit`/`credit` say which side. */
  amount: Schema.NullOr(DecimalString),
  /** Whose row it is; null when it belongs to the household. */
  ownerMemberId: Schema.NullOr(Schema.String),
  /** Hidden from everyone but its owner, who alone still sees the merchant. */
  isPrivate: Schema.Boolean,
  /** The owner's real category of a private row; null for everybody else. */
  privateCategoryId: Schema.NullOr(Schema.String),
  transferPairId: Schema.NullOr(Schema.String),
  transferPairSource: Schema.NullOr(Schema.Literals(['auto', 'manual', 'rejected'])),
  transferPairKind: Schema.NullOr(Schema.Literals(['transfer', 'reimbursement', 'investment'])),
  /** The expense this income pays back. */
  reimbursementOfId: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type TransactionListItem = Wire<typeof TransactionListItem>;

export const TransactionList = Schema.Array(TransactionListItem);
export type TransactionList = Wire<typeof TransactionList>;

/**
 * A row of `GET /transactions`, with the expense it pays back named by id only:
 * that other row may be private, and its merchant is not this answer's to give.
 */
const ListedTransaction = Schema.Struct({
  ...TransactionListItem.fields,
  reimbursementOf: Schema.NullOr(Schema.Struct({ id: Schema.String })),
  /**
   * The wallet's balance right after this row, with `running_balance=1`; null
   * for a row without a wallet or one that does not count yet.
   */
  runningBalance: Schema.optional(Schema.NullOr(DecimalString)),
  /** The other leg's wallet of a transfer, with `running_balance=1`. */
  transferPairWallet: Schema.optional(Schema.NullOr(Named)),
  /** Who was paid; null on another member's private row. Groups a statement's rows by payee. */
  payee: Schema.optional(Schema.NullOr(PayeeRef)),
  /** Which step set the category; tells a suggestion from a decision. */
  categorySource: Schema.optional(Schema.NullOr(TransactionCategorySource)),
});

/** The rows of `GET /transactions`, read out of the `{ data }` envelope. */
export const ListedTransactions = Schema.Array(ListedTransaction);
export type ListedTransactions = Wire<typeof ListedTransactions>;

/** `GET /transactions` as a page, envelope and all. `items` repeats `data` for older clients. */
export const TransactionListPage = Schema.Struct({
  data: Schema.Array(ListedTransaction),
  items: Schema.Array(ListedTransaction),
  total: Schema.Number,
  page: Schema.Number,
  limit: Schema.Number,
});
export type TransactionListPage = Wire<typeof TransactionListPage>;

/**
 * `GET /transactions/:id/transfer-candidates` and `/reimbursement-candidates`:
 * rows that could be the other side, without their category, branch or wallet.
 */
export const TransactionCandidates = Schema.Struct({
  data: Schema.Array(TransactionListItem.mapFields(Struct.omit(['category', 'branch', 'wallet']))),
});
export type TransactionCandidates = Wire<typeof TransactionCandidates>;

const DuplicateRow = Schema.Struct({
  id: Schema.String,
  date: DateOnly,
  amount: Schema.NullOr(DecimalString),
  counterparty: Schema.String,
  purpose: Schema.String,
  statementId: Schema.NullOr(Schema.String),
});

/** `GET /transactions/duplicates/detect`: groups of rows that look like one payment. */
export const DuplicateGroups = Schema.Struct({
  totalGroups: Schema.Number,
  groups: Schema.Array(
    Schema.Struct({
      master: DuplicateRow,
      duplicates: Schema.Array(
        Schema.Struct({
          ...DuplicateRow.fields,
          similarity: Schema.Number,
          matchType: Schema.Literals(['exact', 'fuzzy', 'semantic', 'hybrid']),
          matchedFields: Schema.Array(Schema.String),
        }),
      ),
      confidence: Schema.Number,
    }),
  ),
});
export type DuplicateGroups = Wire<typeof DuplicateGroups>;
