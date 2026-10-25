import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';
import { ReconciliationResponse } from './ledger';

/** `GET /reconciliation/ageing`: the ageing part of `GET /reconciliation`, in the workspace currency. */
export const ReconciliationAgeing = Schema.Struct({
  currency: Schema.String,
  ageing: ReconciliationResponse.fields.ageing,
});
export type ReconciliationAgeing = Wire<typeof ReconciliationAgeing>;

/** `GET /reconciliation/duplicates`: open items that look entered twice. */
export const ReconciliationDuplicates = ReconciliationResponse.fields.duplicates;
export type ReconciliationDuplicates = Wire<typeof ReconciliationDuplicates>;
