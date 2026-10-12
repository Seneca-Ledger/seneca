import * as Schema from 'effect/Schema';
import { NumericInput, optionalNullable } from '../common/requests';
import type { Wire } from '../common/wire';

export const CreateAiChatBody = Schema.Struct({
  modelId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  firstQuestion: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(20000)),
});
export type CreateAiChatBody = Wire<typeof CreateAiChatBody>;

export const AppendAiChatMessageBody = Schema.Struct({
  role: Schema.Literals(['user', 'assistant', 'tool']),
  content: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(20000)),
  /** Structured action record for tool turns; absent on plain text messages. */
  actionPayload: optionalNullable(Schema.Record(Schema.String, Schema.Unknown)),
});
export type AppendAiChatMessageBody = Wire<typeof AppendAiChatMessageBody>;

export const RenameAiChatBody = Schema.Struct({
  title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
});
export type RenameAiChatBody = Wire<typeof RenameAiChatBody>;

export const SaveAiInsightBody = Schema.Struct({
  title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(255)),
  message: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4000)),
  /**
   * Period the summary covers, e.g. `2026-08`. Constrained so it cannot be used
   * to mint unlimited distinct deduplication keys and fill the insights table.
   */
  periodKey: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}$/, { message: 'periodKey must look like 2026-08' }),
  ),
  modelId: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
});
export type SaveAiInsightBody = Wire<typeof SaveAiInsightBody>;

export const ChatCompletionMessageInput = Schema.Struct({
  role: Schema.Literals(['system', 'user', 'assistant']),
  content: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(40000)),
});
export type ChatCompletionMessageInput = Wire<typeof ChatCompletionMessageInput>;

export const CreateChatCompletionBody = Schema.Struct({
  messages: Schema.Array(ChatCompletionMessageInput).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(50),
  ),
});
export type CreateChatCompletionBody = Wire<typeof CreateChatCompletionBody>;

export const SearchTransactionsBody = Schema.Struct({
  query: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
  limit: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(25),
    ),
  ),
});
export type SearchTransactionsBody = Wire<typeof SearchTransactionsBody>;

export const BackfillEmbeddingsBody = Schema.Struct({
  batchSize: optionalNullable(
    NumericInput.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(500),
    ),
  ),
});
export type BackfillEmbeddingsBody = Wire<typeof BackfillEmbeddingsBody>;
