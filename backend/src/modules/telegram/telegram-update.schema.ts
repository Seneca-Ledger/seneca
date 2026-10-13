import { Schema } from 'effect';

/**
 * What the bot reads of a Telegram update, and nothing more. Telegram, not the
 * app, writes these bodies, so the schema lives here rather than in
 * packages/contracts. Ids arrive as numbers; strings are accepted too.
 */
const TelegramId = Schema.Union([Schema.Number, Schema.String]);

const TelegramChat = Schema.Struct({ id: Schema.optional(TelegramId) });

const TelegramFrom = Schema.Struct({
  id: Schema.optional(TelegramId),
  language_code: Schema.optional(Schema.String),
});

export const TelegramDocument = Schema.Struct({
  file_id: Schema.String,
  file_name: Schema.optional(Schema.String),
  mime_type: Schema.optional(Schema.String),
});
export type TelegramDocument = typeof TelegramDocument.Type;

const TelegramPhotoSize = Schema.Struct({
  file_id: Schema.String,
  file_size: Schema.optional(Schema.Number),
  width: Schema.optional(Schema.Number),
  height: Schema.optional(Schema.Number),
});

const TelegramMessage = Schema.Struct({
  chat: Schema.optional(TelegramChat),
  // Telegram's own limits: 4096 characters of text, 1024 of caption.
  text: Schema.optional(Schema.String.check(Schema.isMaxLength(4096))),
  caption: Schema.optional(Schema.String.check(Schema.isMaxLength(1024))),
  from: Schema.optional(TelegramFrom),
  document: Schema.optional(TelegramDocument),
  /** Telegram sends every size of a photo; the last one is the largest. */
  photo: Schema.optional(Schema.Array(TelegramPhotoSize)),
});

export const TelegramCallbackQuery = Schema.Struct({
  id: Schema.String,
  from: Schema.optional(TelegramFrom),
  message: Schema.optional(Schema.Struct({ chat: Schema.optional(TelegramChat) })),
  // At most 64 bytes, by Telegram's rules.
  data: Schema.optional(Schema.String.check(Schema.isMaxLength(64))),
});
export type TelegramCallbackQuery = typeof TelegramCallbackQuery.Type;

export const TelegramUpdate = Schema.Struct({
  /** Telegram resends an update with the same id when the webhook answer is late or fails. */
  update_id: Schema.optional(Schema.Number),
  message: Schema.optional(TelegramMessage),
  callback_query: Schema.optional(TelegramCallbackQuery),
});
export type TelegramUpdate = typeof TelegramUpdate.Type;

/**
 * Decodes an update leniently: Telegram adds fields over time and sends update
 * kinds the bot does not handle (edited messages, channel posts), which pass
 * as an update with neither `message` nor `callback_query`.
 */
export const decodeTelegramUpdate = Schema.decodeUnknownExit(TelegramUpdate, {
  onExcessProperty: 'ignore',
  errors: 'all',
});
