import * as Schema from 'effect/Schema';
import { Timestamp, type Wire } from '../common/wire';

/** `POST /ai-analysis/chats`, and a row of the chat list. */
export const ChatSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  modelId: Schema.String,
  updatedAt: Timestamp,
});

export type ChatSummary = Wire<typeof ChatSummary>;

/** `GET /ai-analysis/chats`: the caller's saved chats, newest first. */
export const AiChatList = Schema.Array(ChatSummary);
export type AiChatList = Wire<typeof AiChatList>;

/** `GET /ai-analysis/chats/:id`. */
export const AiChatTranscript = Schema.Struct({
  ...ChatSummary.fields,
  messages: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      role: Schema.Literals(['user', 'assistant', 'tool']),
      content: Schema.String,
      /** A tool call's arguments or an action the assistant proposed. */
      actionPayload: Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown)),
      createdAt: Timestamp,
    }),
  ),
});
export type AiChatTranscript = Wire<typeof AiChatTranscript>;

/** `GET /ai-analysis/completions/status`: whether a cloud model is set up, and whose key. */
export const ChatCompletionStatus = Schema.Struct({
  configured: Schema.Boolean,
  model: Schema.NullOr(Schema.String),
  source: Schema.Literals(['personal', 'workspace', 'env', 'disabled']),
});
export type ChatCompletionStatus = Wire<typeof ChatCompletionStatus>;

/** `POST /ai-analysis/search`: transactions closest in meaning to the question. */
export const TransactionSearchResult = Schema.Struct({
  hits: Schema.Array(
    Schema.Struct({
      transactionId: Schema.String,
      counterpartyName: Schema.String,
      paymentPurpose: Schema.String,
      transactionDate: Schema.String,
      amount: Schema.NullOr(Schema.Number),
      currency: Schema.String,
      score: Schema.Number,
    }),
  ),
  truncated: Schema.Boolean,
  /** Rows not embedded yet, so not searched. */
  pendingEmbeddings: Schema.Number,
});
export type TransactionSearchResult = Wire<typeof TransactionSearchResult>;
