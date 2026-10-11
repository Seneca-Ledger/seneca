import * as Schema from 'effect/Schema';
import { DateOnly, DecimalString, Timestamp, type Wire } from '../common/wire';
import { CategoryRef } from '../reference/reference';

export const BudgetPeriodType = Schema.Literals(['weekly', 'monthly', 'quarterly', 'annual']);
export type BudgetPeriodType = Wire<typeof BudgetPeriodType>;

export const BudgetRolloverMode = Schema.Literals(['none', 'carry', 'refill']);
export type BudgetRolloverMode = Wire<typeof BudgetRolloverMode>;

/** One row of `GET /budgets`: the budget, its category and the current period's figures. */
export const BudgetItem = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  name: Schema.String,
  categoryId: Schema.String,
  category: CategoryRef,
  limitAmount: DecimalString,
  currency: Schema.String,
  periodType: BudgetPeriodType,
  rolloverMode: BudgetRolloverMode,
  currentPeriodStart: DateOnly,
  /** The window the budget applies in; both null means it runs forever. */
  startsOn: Schema.NullOr(DateOnly),
  endsOn: Schema.NullOr(DateOnly),
  /** The goal this budget serves; null when it stands on its own. */
  goalId: Schema.NullOr(Schema.String),
  createdById: Schema.NullOr(Schema.String),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  spentAmount: Schema.Number,
  percentUsed: Schema.Number,
  /** What the period has to spend once rollover is settled; equals the limit without rollover. */
  availableAmount: Schema.Number,
  /** availableAmount minus the limit: positive = leftover carried in, negative = overspend. */
  carriedAmount: Schema.Number,
  /** Whether today falls inside the budget's window. */
  isActive: Schema.Boolean,
});
export type BudgetItem = Wire<typeof BudgetItem>;

export const BudgetList = Schema.Array(BudgetItem);
export type BudgetList = Wire<typeof BudgetList>;
