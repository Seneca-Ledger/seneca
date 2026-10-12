import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const ConfirmReconciliationBody = Schema.Struct({
  payableId: Schema.String.check(Schema.isUUID()),
  transactionId: Schema.String.check(Schema.isUUID()),
});
export type ConfirmReconciliationBody = Wire<typeof ConfirmReconciliationBody>;
