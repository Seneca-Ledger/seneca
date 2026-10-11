import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import type { Wire } from '../common/wire';

export const NoteTargetInput = Schema.Struct({
  entityType: Schema.Literals(['statement', 'receipt', 'transaction', 'budget', 'goal', 'invoice']),
  entityId: Schema.String.check(Schema.isUUID()),
});
export type NoteTargetInput = Wire<typeof NoteTargetInput>;

export const CreateNoteBody = NoteTargetInput.mapFields(
  Struct.assign({
    body: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(4000)),
    mentionedUserIds: Schema.optional(
      Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(10)),
    ),
  }),
);
export type CreateNoteBody = Wire<typeof CreateNoteBody>;

export const ListNoteCountsBody = Schema.Struct({
  entityType: Schema.Literals(['statement', 'receipt', 'transaction', 'budget', 'goal', 'invoice']),
  entityIds: Schema.Array(Schema.String.check(Schema.isUUID())).check(Schema.isMaxLength(200)),
});
export type ListNoteCountsBody = Wire<typeof ListNoteCountsBody>;

export const SetNoteResolvedBody = Schema.Struct({
  resolved: Schema.Boolean,
});
export type SetNoteResolvedBody = Wire<typeof SetNoteResolvedBody>;
