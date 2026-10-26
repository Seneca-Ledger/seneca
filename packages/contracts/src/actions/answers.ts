import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** A write that answers with a sentence for the person: email and password changes. */
export const MessageResult = Schema.Struct({ message: Schema.String });
export type MessageResult = Wire<typeof MessageResult>;

/** A write that answers only that it went through: deletes and reorders. */
export const OkResult = Schema.Struct({ ok: Schema.Literal(true) });
export type OkResult = Wire<typeof OkResult>;

/** `POST /investments/refresh-prices` and `POST /metals/refresh-prices`. */
export const PriceRefreshResult = Schema.Struct({ updated: Schema.Number });
export type PriceRefreshResult = Wire<typeof PriceRefreshResult>;

/** `POST /crypto/import`: an exchange's CSV booked into one wallet. */
export const ExchangeImportResult = Schema.Struct({
  exchange: Schema.Literals(['Coinbase', 'Binance', 'Kraken']),
  imported: Schema.Number,
  skipped: Schema.Number,
  walletId: Schema.String,
});
export type ExchangeImportResult = Wire<typeof ExchangeImportResult>;

/** `POST /ledger/revaluations`: the entry posted, or why there was none. */
export const RevaluationResult = Schema.Union([
  Schema.Struct({
    status: Schema.Literals(['posted', 'unchanged']),
    revaluation: Schema.Struct({
      entryId: Schema.String,
      entryNo: Schema.NullOr(Schema.String),
      entryDate: Schema.String,
      postedAt: Schema.NullOr(Timestamp),
      gain: Schema.String,
      loss: Schema.String,
    }),
  }),
  Schema.Struct({ status: Schema.Literal('nothing_to_revalue'), entryDate: Schema.String }),
]);
export type RevaluationResult = Wire<typeof RevaluationResult>;

/** `GET /dashboard/setup-progress`: which first steps the workspace has taken. */
export const SetupProgress = Schema.Struct({
  hasUpload: Schema.Boolean,
  hasWallet: Schema.Boolean,
  hasCustomCategories: Schema.Boolean,
  hasBudget: Schema.Boolean,
  hasGoal: Schema.Boolean,
  telegramAvailable: Schema.Boolean,
  hasTelegram: Schema.Boolean,
});
export type SetupProgress = Wire<typeof SetupProgress>;

/** `GET /view-preferences/:scope`: how the person left the page; the page reads its own keys. */
export const ViewPreferenceState = Schema.Struct({
  state: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
});
export type ViewPreferenceState = Wire<typeof ViewPreferenceState>;

/** `PUT /transactions/:id/payee`: the row's payee, and the category that came with it. */
export const TransactionPayeeResult = Schema.Struct({
  id: Schema.String,
  payee: Schema.Struct({ id: Schema.String, name: Schema.String }),
  categoryId: Schema.NullOr(Schema.String),
  categorySource: Schema.NullOr(
    Schema.Literals(['manual', 'rule', 'keyword', 'learned', 'history', 'ai', 'default']),
  ),
});
export type TransactionPayeeResult = Wire<typeof TransactionPayeeResult>;

/** `POST /users/me/welcome-tutorial`. */
export const WelcomeTutorialSeen = Schema.Struct({
  welcomeTutorialSeenAt: Schema.NullOr(Timestamp),
});
export type WelcomeTutorialSeen = Wire<typeof WelcomeTutorialSeen>;

/** `POST` and `DELETE /users/me/page-hints`: page id → the highest hint version seen there. */
export const PageHintsSeen = Schema.Struct({
  pageHintsSeen: Schema.Record(Schema.String, Schema.Number),
});
export type PageHintsSeen = Wire<typeof PageHintsSeen>;

/** `POST /receipts/place-suggestions`: shops near a fix, when the scan still needs a place. */
export const PlaceSuggestions = Schema.Union([
  Schema.Struct({ needed: Schema.Literal(false) }),
  Schema.Struct({
    needed: Schema.Literal(true),
    receiptId: Schema.String,
    vendor: Schema.NullOr(Schema.String),
    amount: Schema.NullOr(Schema.Number),
    currency: Schema.NullOr(Schema.String),
    date: Schema.NullOr(Schema.String),
    candidates: Schema.Array(
      Schema.Struct({
        lat: Schema.Number,
        lng: Schema.Number,
        name: Schema.String,
        category: Schema.String,
        type: Schema.String,
        address: Schema.NullOr(Schema.String),
        locality: Schema.NullOr(Schema.String),
        /** Nominatim's `osm_type`; the pick is sent back as a `ReceiptPlace`. */
        osmType: Schema.Literals(['node', 'way', 'relation']),
        osmId: Schema.String,
        distanceM: Schema.Number,
        matchesVendor: Schema.Boolean,
      }),
    ),
  }),
]);
export type PlaceSuggestions = Wire<typeof PlaceSuggestions>;

/** `POST /transactions/duplicates/mark`. */
export const DuplicatesMarked = Schema.Struct({
  success: Schema.Boolean,
  markedCount: Schema.Number,
});
export type DuplicatesMarked = Wire<typeof DuplicatesMarked>;
