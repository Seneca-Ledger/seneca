import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

export const GoalItemStatus = Schema.Literals(['planned', 'paid']);
export type GoalItemStatus = Wire<typeof GoalItemStatus>;

const Name = Schema.String.check(Schema.isBetweenLength(1, 150));
const Amount = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0));
const Currency = Schema.String.check(Schema.isBetweenLength(3, 3));
/** `YYYY-MM`, the month the money is expected to leave. */
const DueMonth = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'dueMonth must be in YYYY-MM format' }),
);
const Note = Schema.String.check(Schema.isMaxLength(1000));

export const GoalItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  estimatedAmount: Schema.Number,
  actualAmount: Schema.NullOr(Schema.Number),
  currency: Schema.String,
  dueMonth: Schema.NullOr(Schema.String),
  status: GoalItemStatus,
  note: Schema.NullOr(Schema.String),
  /** ISO timestamp. */
  createdAt: Schema.String,
});
export type GoalItem = Wire<typeof GoalItem>;

/** Every goal-item route answers with the whole list, so writes refresh the cache in one go. */
export const GoalItemsResponse = Schema.Struct({
  /** The goal's currency. Every figure in `summary` is converted into it. */
  currency: Schema.String,
  items: Schema.Array(GoalItem),
  summary: Schema.Struct({
    /** What the lines were expected to cost. */
    estimatedTotal: Schema.Number,
    /** The best current number per line: the actual once known, the estimate until then. */
    committedTotal: Schema.Number,
    /** Of that, what has already been paid. */
    paidTotal: Schema.Number,
    outstanding: Schema.Number,
    /** The goal's declared target, for comparison with the estimate. */
    targetAmount: Schema.Number,
    /** Target minus estimate. Negative means the estimate has outgrown the goal. */
    unallocated: Schema.Number,
  }),
});
export type GoalItemsResponse = Wire<typeof GoalItemsResponse>;

/**
 * Only the fields that can be cleared take null: `actualAmount` (not paid
 * yet), `dueMonth` and `note`. Omitting a field leaves it alone on update.
 */
export const CreateGoalItemBody = Schema.Struct({
  name: Name,
  estimatedAmount: Amount,
  actualAmount: Schema.optional(Schema.NullOr(Amount)),
  /** Defaults to the goal's currency. */
  currency: Schema.optional(Currency),
  dueMonth: Schema.optional(Schema.NullOr(DueMonth)),
  status: Schema.optional(GoalItemStatus),
  note: Schema.optional(Schema.NullOr(Note)),
});
export type CreateGoalItemBody = Wire<typeof CreateGoalItemBody>;

export const UpdateGoalItemBody = Schema.Struct({
  ...CreateGoalItemBody.fields,
  name: Schema.optional(Name),
  estimatedAmount: Schema.optional(Amount),
});
export type UpdateGoalItemBody = Wire<typeof UpdateGoalItemBody>;
