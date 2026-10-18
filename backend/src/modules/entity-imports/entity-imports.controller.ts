import { Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  EntityImportResult,
  ImportSuggestion,
  RunEntityImportBody,
  SuggestImportBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EntityImportService } from './entity-import.service';
import { ImportSuggestService } from './import-suggest.service';

/** Spreadsheet rows → payables, subscriptions, invoices, budgets or a statement. */
@Controller('entity-imports')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class EntityImportsController {
  constructor(
    private readonly entityImport: EntityImportService,
    private readonly suggest: ImportSuggestService,
  ) {}

  @Post('suggest')
  @SchemaResponse(ImportSuggestion)
  suggestTarget(@SchemaBody(SuggestImportBody) dto: SuggestImportBody) {
    return this.suggest.suggest(dto);
  }

  @Post()
  @SchemaResponse(EntityImportResult)
  run(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(RunEntityImportBody) dto: RunEntityImportBody,
  ) {
    return this.entityImport.run(user.id, workspaceId, dto);
  }

  @Delete(':batchId')
  undo(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Param('batchId', new ParseUUIDPipe()) batchId: string,
  ) {
    return this.entityImport.undo(user.id, workspaceId, batchId);
  }
}
