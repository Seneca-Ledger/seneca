import { Controller, Delete, Get, Headers, HttpCode, Patch, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { IdempotencyService } from '../../common/services/idempotency.service';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CreateJournalEntryBody,
  JournalEntriesQuery,
  JournalEntryDetail,
  JournalEntryPage,
  LedgerRecordParams,
  ReverseJournalEntryBody,
  UpdateJournalEntryBody,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import type { User } from '../../entities/user.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type {
  JournalEntryResponseDto,
  PaginatedJournalEntriesDto,
} from './dto/journal-entry-response.dto';
import { LedgerEntriesService } from './ledger-entries.service';

/**
 * The journal. Drafts are edited freely; `post` freezes one for good, and
 * `reverse` is the only way to correct a posted entry.
 */
@Controller('ledger/entries')
export class LedgerEntriesController {
  constructor(
    private readonly entriesService: LedgerEntriesService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  @SchemaResponse(JournalEntryPage)
  async list(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(JournalEntriesQuery) query: JournalEntriesQuery,
  ): Promise<PaginatedJournalEntriesDto> {
    return this.entriesService.list(workspaceId, query);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.LEDGER_VIEW)
  @SchemaResponse(JournalEntryDetail)
  async findOne(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(LedgerRecordParams) { id }: LedgerRecordParams,
  ): Promise<JournalEntryResponseDto> {
    return this.entriesService.findOne(workspaceId, id);
  }

  /** Creates a draft. Send `idempotency-key` to make a retried request return the first draft. */
  @Post()
  @WorkspaceAuth(Permission.LEDGER_POST)
  @Audit({ entityType: EntityType.JOURNAL_ENTRY, includeDiff: true })
  @SchemaResponse(JournalEntryDetail)
  async create(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateJournalEntryBody) dto: CreateJournalEntryBody,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<JournalEntryResponseDto> {
    // Namespaced: the key table is shared by every endpoint that takes one.
    const key = idempotencyKey ? `ledger-entry:${idempotencyKey}` : null;
    if (key) {
      const cached = await this.idempotencyService.checkKey(key, user.id, workspaceId);
      if (cached) {
        return cached.data as JournalEntryResponseDto;
      }
    }
    const entry = await this.entriesService.createDraft(workspaceId, user.id, dto);
    if (key) {
      await this.idempotencyService.storeKey(key, user.id, workspaceId, entry);
    }
    return entry;
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.LEDGER_POST)
  @Audit({ entityType: EntityType.JOURNAL_ENTRY, includeDiff: true, includeBody: true })
  @SchemaResponse(JournalEntryDetail)
  async update(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(LedgerRecordParams) { id }: LedgerRecordParams,
    @SchemaBody(UpdateJournalEntryBody) dto: UpdateJournalEntryBody,
  ): Promise<JournalEntryResponseDto> {
    return this.entriesService.updateDraft(workspaceId, id, dto);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.LEDGER_POST)
  @Audit({ entityType: EntityType.JOURNAL_ENTRY })
  async remove(
    @WorkspaceId() workspaceId: string,
    @SchemaParams(LedgerRecordParams) { id }: LedgerRecordParams,
  ) {
    await this.entriesService.removeDraft(workspaceId, id);
    return deletedResponse('Journal entry');
  }

  /** Books a draft; safe to retry. Audited by the service, which knows it was a posting. */
  @Post(':id/post')
  @HttpCode(200)
  @WorkspaceAuth(Permission.LEDGER_POST)
  @SchemaResponse(JournalEntryDetail)
  async post(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(LedgerRecordParams) { id }: LedgerRecordParams,
  ): Promise<JournalEntryResponseDto> {
    return this.entriesService.post(workspaceId, id, user.id);
  }

  /** Returns the reversal entry; safe to retry. */
  @Post(':id/reverse')
  @HttpCode(200)
  @WorkspaceAuth(Permission.LEDGER_POST)
  @SchemaResponse(JournalEntryDetail)
  async reverse(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(LedgerRecordParams) { id }: LedgerRecordParams,
    @SchemaBody(ReverseJournalEntryBody) dto: ReverseJournalEntryBody,
  ): Promise<JournalEntryResponseDto> {
    return this.entriesService.reverse(workspaceId, id, user.id, dto);
  }
}
