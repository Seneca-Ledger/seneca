import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import { Timestamp, type Wire } from '../common/wire';
import { TransactionListItem } from '../transactions/transaction-list';

/** One test a rule runs on a transaction, as stored. */
const ClassificationCondition = Schema.Struct({
  field: Schema.Literals([
    'counterparty_name',
    'payment_purpose',
    'amount',
    'counterparty_bin',
    'document_number',
    'owner',
    'direction',
    'payment_type',
    'wallet',
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
  value: Schema.Union([Schema.String, Schema.Number]),
});

/** What a matching rule sets on the transaction; a key it leaves out is left alone. */
const ClassificationResult = Schema.Struct({
  categoryId: Schema.optional(Schema.String),
  branchId: Schema.optional(Schema.String),
  walletId: Schema.optional(Schema.String),
  article: Schema.optional(Schema.String),
  activityType: Schema.optional(Schema.String),
  /** One member, or the household with `null`. */
  ownerMemberId: Schema.optional(Schema.NullOr(Schema.String)),
  /** Tags added to a matching row; the ones it already has stay. */
  tagIds: Schema.optional(Schema.Array(Schema.String)),
});

/** `GET /categorization-rules/:id`, and what creating or updating one answers. */
export const CategorizationRule = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.NullOr(Schema.String),
  conditions: Schema.Array(ClassificationCondition),
  result: ClassificationResult,
  priority: Schema.Number,
  isActive: Schema.Boolean,
  matchCount: Schema.Number,
  lastMatchedAt: Schema.NullOr(Timestamp),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type CategorizationRule = Wire<typeof CategorizationRule>;

/** `GET /categorization-rules`: every rule of the workspace, highest priority first. */
export const CategorizationRuleList = Schema.Struct({
  data: Schema.Array(CategorizationRule),
  total: Schema.Number,
});
export type CategorizationRuleList = Wire<typeof CategorizationRuleList>;

/**
 * `POST /categorization-rules/test`: what a rule would match, before it is saved,
 * among the given transactions or the workspace's recent ones.
 */
export const CategorizationRuleTestResult = Schema.Struct({
  totalTransactions: Schema.Number,
  matchedTransactions: Schema.Number,
  /** Matches whose category was not chosen by hand, so applying the rule may change them. */
  overridable: Schema.Number,
  /** More rows exist than the preview looked at; the counts are a lower bound. */
  truncated: Schema.Boolean,
  matches: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      date: Schema.NullOr(Schema.String),
      /** The debit, else the credit, else the signed amount: a decimal string. */
      amount: Schema.NullOr(Schema.String),
      counterparty: Schema.String,
      purpose: Schema.String,
      matchReason: Schema.String,
      direction: Schema.NullOr(Schema.Literals(['income', 'expense'])),
      currency: Schema.String,
      categoryId: Schema.NullOr(Schema.String),
      /** A person (or a rule) chose the category, so applying leaves it. */
      decided: Schema.Boolean,
      /** A rule ranked above this one that matches the row too, and so files it instead. */
      wonBy: Schema.NullOr(Schema.Struct({ id: Schema.String, name: Schema.String })),
    }),
  ),
  /** Matches a higher-ranked rule takes first. */
  shadowed: Schema.Number,
});
export type CategorizationRuleTestResult = Wire<typeof CategorizationRuleTestResult>;

/** `POST /categorization-rules/:id/apply`: rows refiled, rows whose hand-picked category stayed, rows tagged. */
export const CategorizationRuleApplyResult = Schema.Struct({
  applied: Schema.Number,
  skippedManual: Schema.Number,
  /** Rows that got at least one of the rule's tags, filed by hand or not. */
  tagged: Schema.Number,
});
export type CategorizationRuleApplyResult = Wire<typeof CategorizationRuleApplyResult>;

/**
 * `GET /categorization-rules/suggestions`: payees filed under the same category
 * by hand again and again, with the rule that would do it for them.
 */
export const CategorizationRuleSuggestionList = Schema.Struct({
  data: Schema.Array(
    Schema.Struct({
      payeeId: Schema.String,
      payeeName: Schema.String,
      categoryId: Schema.String,
      /** How many rows of the payee a person filed under the category. */
      decidedCount: Schema.Number,
      conditions: Schema.Array(ClassificationCondition),
    }),
  ),
});
export type CategorizationRuleSuggestionList = Wire<typeof CategorizationRuleSuggestionList>;

/**
 * `POST /classification/transaction/:id`: the row as stored after the rules ran
 * (unchanged when its category was picked by hand), without its relations.
 */
export const ClassifiedTransaction = TransactionListItem.mapFields(
  Struct.omit(['category', 'branch', 'wallet']),
);
export type ClassifiedTransaction = Wire<typeof ClassifiedTransaction>;

/**
 * `POST /classification/statements/:id/suggestions`: rows of a statement given
 * a fresh suggestion (or a rule's category), and rows left as they were.
 */
export const StatementSuggestionsResult = Schema.Struct({
  suggested: Schema.Number,
  unchanged: Schema.Number,
});
export type StatementSuggestionsResult = Wire<typeof StatementSuggestionsResult>;

/** `POST /classification/bulk`: how the re-run went, row by row for the failures. */
export const ClassifyBulkResult = Schema.Struct({
  total: Schema.Number,
  successful: Schema.Number,
  failed: Schema.Number,
  notFound: Schema.Number,
  /** Rows whose category the user picked by hand; the re-run never touches them. */
  keptManual: Schema.Number,
  errors: Schema.Array(Schema.Struct({ transactionId: Schema.String, error: Schema.String })),
});
export type ClassifyBulkResult = Wire<typeof ClassifyBulkResult>;
