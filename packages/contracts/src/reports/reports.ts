import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** `GET /reports/history`: generated report files. Never their server path. */
export const ReportHistoryList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    templateId: Schema.String,
    templateName: Schema.String,
    dateFrom: Schema.String,
    dateTo: Schema.String,
    format: Schema.String,
    fileName: Schema.String,
    fileSize: Schema.Number,
    generatedAt: Timestamp,
  }),
);
export type ReportHistoryList = Wire<typeof ReportHistoryList>;

/** `GET /reports/schedules`. */
export const ReportScheduleList = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    templateId: Schema.String,
    format: Schema.String,
    cadence: Schema.Literals(['daily', 'weekly', 'monthly']),
    recipients: Schema.Array(Schema.String),
    walletIds: Schema.Array(Schema.String),
    categoryIds: Schema.Array(Schema.String),
    groupBy: Schema.NullOr(Schema.String),
    locale: Schema.NullOr(Schema.String),
    isActive: Schema.Boolean,
    lastRunAt: Schema.NullOr(Timestamp),
    nextRunAt: Timestamp,
    lastError: Schema.NullOr(Schema.String),
    createdAt: Timestamp,
  }),
);
export type ReportScheduleList = Wire<typeof ReportScheduleList>;

const FlowLink = Schema.Struct({
  source: Schema.String,
  target: Schema.String,
  value: Schema.Number,
});

const Period = Schema.Struct({ from: Schema.String, to: Schema.String });

/** `GET /reports/cash-flow-map` (JSON; `format=csv` answers a file instead). */
export const CashFlowMap = Schema.Struct({
  currency: Schema.String,
  period: Period,
  previousPeriod: Schema.NullOr(Period),
  includeTransfers: Schema.Boolean,
  availableCategories: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      parentId: Schema.NullOr(Schema.String),
    }),
  ),
  income: Schema.Struct({
    total: Schema.Number,
    sources: Schema.Array(Schema.Struct({ name: Schema.String, amount: Schema.Number })),
  }),
  expense: Schema.Struct({
    total: Schema.Number,
    categories: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        amount: Schema.Number,
        previousAmount: Schema.NullOr(Schema.Number),
        children: Schema.Array(
          Schema.Struct({
            id: Schema.String,
            name: Schema.String,
            amount: Schema.Number,
            previousAmount: Schema.NullOr(Schema.Number),
          }),
        ),
      }),
    ),
  }),
  transfers: Schema.Number,
  net: Schema.Number,
  previous: Schema.NullOr(
    Schema.Struct({ income: Schema.Number, expense: Schema.Number, net: Schema.Number }),
  ),
  sankey: Schema.Struct({
    nodes: Schema.Array(
      Schema.Struct({
        id: Schema.String,
        name: Schema.String,
        kind: Schema.Literals([
          'source',
          'total',
          'balance',
          'category',
          'subcategory',
          'transfers',
          'saved',
        ]),
      }),
    ),
    links: Schema.Array(FlowLink),
  }),
  treemap: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      value: Schema.Number,
      children: Schema.Array(
        Schema.Struct({ id: Schema.String, name: Schema.String, value: Schema.Number }),
      ),
    }),
  ),
});
export type CashFlowMap = Wire<typeof CashFlowMap>;

/** `GET /reports/spend-flow`: money from the total through categories to merchants. */
export const SpendFlow = Schema.Struct({
  currency: Schema.String,
  type: Schema.Literals(['income', 'expense']),
  dateFrom: Schema.NullOr(Schema.String),
  dateTo: Schema.NullOr(Schema.String),
  total: Schema.Number,
  nodes: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      kind: Schema.Literals(['total', 'category', 'subcategory', 'merchant', 'other']),
      name: Schema.NullOr(Schema.String),
      amount: Schema.Number,
      share: Schema.Number,
      color: Schema.NullOr(Schema.String),
      /** How many small merchants an `other` node stands for. */
      mergedCount: Schema.optional(Schema.Number),
    }),
  ),
  links: Schema.Array(FlowLink),
});
export type SpendFlow = Wire<typeof SpendFlow>;
