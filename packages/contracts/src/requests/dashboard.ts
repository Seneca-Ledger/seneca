import * as Schema from 'effect/Schema';
import { IsoDateString, NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

const Days = NumericInput.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1));

/** `GET /dashboard`: the window (default `30d`), ending on `date` (default today). */
export const DashboardQuery = Schema.Struct({
  range: Schema.optional(Schema.Literals(['7d', '30d', '90d', 'month'])),
  date: Schema.optional(IsoDateString),
});
export type DashboardQuery = Wire<typeof DashboardQuery>;

/** `GET /dashboard/trends`: the last `days` (default 30), or one month. */
export const DashboardTrendsQuery = Schema.Struct({
  days: Schema.optional(Days),
  month: Schema.optional(
    Schema.String.check(
      Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be YYYY-MM' }),
    ),
  ),
});
export type DashboardTrendsQuery = Wire<typeof DashboardTrendsQuery>;

/** `GET /dashboard/commitments`: what falls due in the next `days` (default 60). */
export const DashboardCommitmentsQuery = Schema.Struct({ days: Schema.optional(Days) });
export type DashboardCommitmentsQuery = Wire<typeof DashboardCommitmentsQuery>;
