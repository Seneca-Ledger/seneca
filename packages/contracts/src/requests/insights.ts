import * as Schema from 'effect/Schema';
import { DateOnlyInput, NumericInput } from '../common/requests';
import type { Wire } from '../common/wire';

/** The backend `InsightCategory` enum. */
const InsightCategory = Schema.Literals([
  'pattern',
  'anomaly',
  'operational',
  'trend',
  'workflow',
  'stoic',
  'expert',
]);

/** The interface language; one without translations falls back to English. */
const Locale = Schema.String.check(Schema.isMaxLength(16));

/** `GET /insights` (30 from the start when absent). */
export const InsightsQuery = Schema.Struct({
  category: Schema.optional(InsightCategory),
  limit: Schema.optional(NumericInput),
  offset: Schema.optional(NumericInput),
  locale: Schema.optional(Locale),
});
export type InsightsQuery = Wire<typeof InsightsQuery>;

/** `GET /insights/daily-quote`: `date` is the reader's own calendar day. */
export const DailyQuoteQuery = Schema.Struct({
  date: Schema.optional(DateOnlyInput),
  locale: Schema.optional(Locale),
});
export type DailyQuoteQuery = Wire<typeof DailyQuoteQuery>;

/** `PUT /insights/daily-quote/:quoteId/vote`: a catalogue id, as the quote came. */
export const QuoteVoteParams = Schema.Struct({
  quoteId: Schema.String.check(Schema.isPattern(/^[a-z0-9-]{1,80}$/)),
});
export type QuoteVoteParams = Wire<typeof QuoteVoteParams>;

/** Thumb up (1), thumb down (-1), or 0 to take it back; `date` is the reader's day. */
export const QuoteVoteBody = Schema.Struct({
  vote: Schema.Literals([1, -1, 0]),
  date: Schema.optional(DateOnlyInput),
});
export type QuoteVoteBody = Wire<typeof QuoteVoteBody>;

/** `POST /insights/refresh`. */
export const InsightsRefreshQuery = Schema.Struct({ locale: Schema.optional(Locale) });
export type InsightsRefreshQuery = Wire<typeof InsightsRefreshQuery>;

/** `POST /insights/dismiss-all`: every category when absent. */
export const InsightsDismissAllQuery = Schema.Struct({
  category: Schema.optional(InsightCategory),
});
export type InsightsDismissAllQuery = Wire<typeof InsightsDismissAllQuery>;

/** `POST /insights/:id/dismiss`. */
export const InsightIdParams = Schema.Struct({ id: Schema.String.check(Schema.isUUID()) });
export type InsightIdParams = Wire<typeof InsightIdParams>;
