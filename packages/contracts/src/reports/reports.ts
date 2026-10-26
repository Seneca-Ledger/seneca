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

/** `GET /reports/cash-flow-map`: the map, or with `?format=csv` its table as CSV text. */
export const CashFlowMapAnswer = Schema.Union([CashFlowMap, Schema.String]);
export type CashFlowMapAnswer = Wire<typeof CashFlowMapAnswer>;

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
      kind: Schema.Literals(['total', 'category', 'subcategory', 'merchant', 'tag', 'other']),
      name: Schema.NullOr(Schema.String),
      amount: Schema.Number,
      share: Schema.Number,
      color: Schema.NullOr(Schema.String),
      /** How many small merchants (or tags) an `other` node stands for. */
      mergedCount: Schema.optional(Schema.Number),
    }),
  ),
  links: Schema.Array(FlowLink),
});
export type SpendFlow = Wire<typeof SpendFlow>;

const ReportCell = Schema.Union([Schema.String, Schema.Number]);

/** `POST /reports/preview`: the first rows of a report, as it would print. */
export const ReportPreview = Schema.Struct({
  title: Schema.String,
  subtitle: Schema.String,
  sections: Schema.Array(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      columns: Schema.Array(Schema.String),
      rows: Schema.Array(Schema.Array(ReportCell)),
      total: Schema.optional(Schema.Array(ReportCell)),
    }),
  ),
  /** Caveats about the figures, e.g. amounts left out for want of an exchange rate. */
  notes: Schema.optional(Schema.Array(Schema.String)),
  footer: Schema.optional(Schema.Array(Schema.Array(ReportCell))),
  /** More rows exist than the preview shows. */
  truncated: Schema.Boolean,
});
export type ReportPreview = Wire<typeof ReportPreview>;

const ReportTrend = Schema.Literals(['up', 'down', 'flat']);

/** `POST /reports/custom-tables/report`: money in the custom tables, by counterparty. */
export const CustomTablesReport = Schema.Struct({
  totals: Schema.Struct({
    total: Schema.Number,
    manualTotal: Schema.Number,
    operations: Schema.Number,
  }),
  comparison: Schema.Struct({
    totalDelta: Schema.Number,
    totalPercentage: Schema.Number,
    totalTrend: ReportTrend,
    manualDelta: Schema.Number,
    manualPercentage: Schema.Number,
    manualTrend: ReportTrend,
    operationsDelta: Schema.Number,
    operationsPercentage: Schema.Number,
    operationsTrend: ReportTrend,
  }),
  timeseries: Schema.Array(Schema.Struct({ date: Schema.String, amount: Schema.Number })),
  sourceSplit: Schema.Struct({ manual: Schema.Number }),
  aggregatedRows: Schema.Array(
    Schema.Struct({
      counterparty: Schema.String,
      source: Schema.Literal('manual'),
      tableId: Schema.String,
      tableName: Schema.String,
      count: Schema.Number,
      total: Schema.Number,
      average: Schema.Number,
      lastDate: Schema.NullOr(Schema.String),
      currency: Schema.NullOr(Schema.String),
    }),
  ),
  tables: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      source: Schema.Literal('manual'),
      total: Schema.Number,
      rows: Schema.Number,
    }),
  ),
});
export type CustomTablesReport = Wire<typeof CustomTablesReport>;

/** `POST /reports/custom-tables/report/drill-down`: one counterparty's rows. */
export const CustomTablesReportDrillDown = Schema.Struct({
  counterparty: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      rowId: Schema.String,
      tableId: Schema.String,
      tableName: Schema.String,
      source: Schema.Literal('manual'),
      date: Schema.NullOr(Schema.String),
      amount: Schema.Number,
      category: Schema.NullOr(Schema.String),
      currency: Schema.NullOr(Schema.String),
    }),
  ),
});
export type CustomTablesReportDrillDown = Wire<typeof CustomTablesReportDrillDown>;
