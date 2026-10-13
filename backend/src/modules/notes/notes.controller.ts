import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreateNoteBody,
  ListNoteCountsBody,
  NoteCounts,
  NoteItem,
  NoteList,
  NotesQuery,
  SetNoteResolvedBody,
} from '../../contracts';
import { NoteEntityType } from '../../entities/note.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotesService } from './notes.service';

/**
 * Заметка — средство общения, а не правка финансовых данных, поэтому
 * достаточно права на просмотр объекта: читатель тоже должен уметь задать вопрос.
 */
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(NoteList)
  async listNotes(@WorkspaceId() workspaceId: string, @SchemaQuery(NotesQuery) query: NotesQuery) {
    const items = await this.notesService.listNotes(
      workspaceId,
      toEnum(NoteEntityType, query.entityType),
      query.entityId,
    );
    return { items };
  }

  @Post()
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(NoteItem)
  async createNote(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateNoteBody) dto: CreateNoteBody,
  ) {
    return this.notesService.createNote(
      user.id,
      workspaceId,
      toEnum(NoteEntityType, dto.entityType),
      dto.entityId,
      dto.body,
      dto.mentionedUserIds ?? [],
    );
  }

  @Post('counts')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(NoteCounts)
  async countNotes(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ListNoteCountsBody) dto: ListNoteCountsBody,
  ) {
    const counts = await this.notesService.countOpenByEntity(
      workspaceId,
      toEnum(NoteEntityType, dto.entityType),
      dto.entityIds,
    );
    return { counts };
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  @SchemaResponse(NoteItem)
  async setResolved(
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) noteId: string,
    @SchemaBody(SetNoteResolvedBody) dto: SetNoteResolvedBody,
  ) {
    return this.notesService.setResolved(workspaceId, noteId, dto.resolved);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.STATEMENT_VIEW)
  async deleteNote(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('id', new ParseUUIDPipe()) noteId: string,
  ) {
    await this.notesService.deleteNote(user.id, workspaceId, noteId);
    return { message: 'Note deleted' };
  }
}
