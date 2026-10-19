import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { BooleanInput, IsoDateString, NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';
import { CaptureLocationFieldsInput } from './receipts';

export const UploadStatementBody = Schema.Struct({
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
  branchId: optionalNullable(Schema.String.check(Schema.isUUID())),
  allowDuplicates: optionalNullable(BooleanInput),
  requireManualCategorySelection: optionalNullable(BooleanInput),
});
export type UploadStatementBody = Wire<typeof UploadStatementBody>;

export const CreateManualExpenseBody = Schema.Struct({
  amount: Schema.String.check(Schema.isMinLength(1)),
  currency: optionalNullable(Schema.String),
  merchant: Schema.String.check(Schema.isMinLength(1)),
  description: optionalNullable(Schema.String),
  categoryId: Schema.String.check(Schema.isMinLength(1)),
  taxRateId: optionalNullable(Schema.String),
  date: IsoDateString,
  allowDuplicates: optionalNullable(BooleanInput),
});
export type CreateManualExpenseBody = Wire<typeof CreateManualExpenseBody>;

export const UploadReceiptScanBody = CaptureLocationFieldsInput.mapFields(
  Struct.assign({
    language: optionalNullable(Schema.String),
  }),
);
export type UploadReceiptScanBody = Wire<typeof UploadReceiptScanBody>;

export const UpdateStatementStageBody = Schema.Struct({
  statementIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(500),
  ),
  stage: Schema.Literals(['submit', 'approve', 'pay']),
});
export type UpdateStatementStageBody = Wire<typeof UpdateStatementStageBody>;

export const UpdateStatementBody = Schema.Struct({
  balanceStart: optionalNullable(NumericInput),
  balanceEnd: optionalNullable(NumericInput),
  statementDateFrom: optionalNullable(IsoDateString),
  statementDateTo: optionalNullable(IsoDateString),
});
export type UpdateStatementBody = Wire<typeof UpdateStatementBody>;

export const ConvertDroppedSampleTransactionInput = Schema.Struct({
  transactionDate: IsoDateString,
  debit: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(0.01))),
  credit: optionalNullable(NumericInput.check(Schema.isGreaterThanOrEqualTo(0.01))),
  counterpartyName: optionalNullable(Schema.String),
  paymentPurpose: optionalNullable(Schema.String),
  currency: optionalNullable(Schema.String),
  documentNumber: optionalNullable(Schema.String),
  counterpartyBin: optionalNullable(Schema.String),
  counterpartyAccount: optionalNullable(Schema.String),
  counterpartyBank: optionalNullable(Schema.String),
  article: optionalNullable(Schema.String),
  comments: optionalNullable(Schema.String),
  categoryId: optionalNullable(Schema.String.check(Schema.isUUID())),
  branchId: optionalNullable(Schema.String.check(Schema.isUUID())),
  walletId: optionalNullable(Schema.String.check(Schema.isUUID())),
});
export type ConvertDroppedSampleTransactionInput = Wire<
  typeof ConvertDroppedSampleTransactionInput
>;

export const ConvertDroppedSampleBody = Schema.Struct({
  index: NumericInput.check(Schema.isGreaterThanOrEqualTo(0)),
  warning: optionalNullable(Schema.String),
  transaction: ConvertDroppedSampleTransactionInput,
});
export type ConvertDroppedSampleBody = Wire<typeof ConvertDroppedSampleBody>;
