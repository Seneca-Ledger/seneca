import * as Schema from 'effect/Schema';
import type { Wire } from '../common/wire';

/** One test a categorization rule runs on a transaction. */
export const ClassificationConditionInput = Schema.Struct({
  field: Schema.Literals([
    'counterparty_name',
    'payment_purpose',
    'amount',
    'counterparty_bin',
    'document_number',
    'owner',
  ]),
  operator: Schema.Literals([
    'contains',
    'equals',
    'starts_with',
    'ends_with',
    'regex',
    'greater_than',
    'less_than',
  ]),
  value: Schema.Union([Schema.String, Schema.Finite]),
});
export type ClassificationConditionInput = Wire<typeof ClassificationConditionInput>;

/** What a matching rule sets on the transaction. */
export const ClassificationResultInput = Schema.Struct({
  categoryId: Schema.optional(Schema.String),
  branchId: Schema.optional(Schema.String),
  walletId: Schema.optional(Schema.String),
  article: Schema.optional(Schema.String),
  activityType: Schema.optional(Schema.String),
  /** Hands the row to one member, or to the household with `null`. */
  ownerMemberId: Schema.optional(Schema.NullOr(Schema.String)),
});
export type ClassificationResultInput = Wire<typeof ClassificationResultInput>;

export const CreateCategorizationRuleBody = Schema.Struct({
  name: Schema.String.check(Schema.isMinLength(1)),
  description: Schema.optional(Schema.String),
  conditions: Schema.Array(ClassificationConditionInput).check(Schema.isMinLength(1)),
  result: ClassificationResultInput,
  priority: Schema.optional(Schema.Int),
  isActive: Schema.optional(Schema.Boolean),
});
export type CreateCategorizationRuleBody = Wire<typeof CreateCategorizationRuleBody>;

export const UpdateCategorizationRuleBody = Schema.Struct({
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  conditions: Schema.optional(Schema.Array(ClassificationConditionInput)),
  result: Schema.optional(ClassificationResultInput),
  priority: Schema.optional(Schema.Int),
  isActive: Schema.optional(Schema.Boolean),
});
export type UpdateCategorizationRuleBody = Wire<typeof UpdateCategorizationRuleBody>;

export const TestCategorizationRuleBody = Schema.Struct({
  conditions: Schema.Array(ClassificationConditionInput).check(Schema.isMinLength(1)),
  transactionIds: Schema.Array(Schema.String).check(Schema.isMinLength(1)),
});
export type TestCategorizationRuleBody = Wire<typeof TestCategorizationRuleBody>;

/**
 * Inline structural types on a `@Body()` leave the global ValidationPipe with an
 * `Object` metatype, so nothing was validated — `transactionIds` could arrive as
 * anything, including a non-array that then threw deeper in the service.
 */
export const ClassifyBulkBody = Schema.Struct({
  transactionIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMinLength(1)),
});
export type ClassifyBulkBody = Wire<typeof ClassifyBulkBody>;
