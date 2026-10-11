import { IsEnum, IsUUID } from 'class-validator';
import { NoteEntityType } from '../../../entities/note.entity';

/** The thread a GET /notes asks for; the request bodies live in packages/contracts. */
export class NoteTargetDto {
  @IsEnum(NoteEntityType)
  entityType: NoteEntityType;

  @IsUUID()
  entityId: string;
}
