import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp } from '../common/wire';

export const TransactionType = Schema.Literals(['income', 'expense']);
export type TransactionType = typeof TransactionType.Type;

const Named = Schema.Struct({ id: Schema.String, name: Schema.String });

/**
 * One row of `GET /transactions` (inside the `{ data }` envelope). Money and
 * rates are decimal strings: read them with `Number(...)`. Private rows arrive
 * with placeholder counterparty text, never null.
 */
export const TransactionListItem = Schema.Struct({
  id: Schema.String,
  transactionDate: DateOnly,
  transactionType: TransactionType,
  isVerified: Schema.Boolean,
  documentNumber: Schema.NullOr(Schema.String),
  counterpartyName: Schema.String,
  counterpartyBin: Schema.NullOr(Schema.String),
  counterpartyAccount: Schema.NullOr(Schema.String),
  counterpartyBank: Schema.NullOr(Schema.String),
  paymentPurpose: Schema.String,
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
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type TransactionListItem = typeof TransactionListItem.Type;

export const TransactionList = Schema.Array(TransactionListItem);
export type TransactionList = typeof TransactionList.Type;
