import { Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import { ApiKeyAllowed } from '../../common/decorators/api-key-allowed.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import {
  EntityImportBatchParams,
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
  // Scoped keys are let through: the service checks the scope the target needs.
  @ApiKeyAllowed()
  @SchemaResponse(EntityImportResult)
  run(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(RunEntityImportBody) dto: RunEntityImportBody,
    @Req() req: AuthenticatedRequest,
  ) {
    // Which scope a key needs depends on the target, so the service checks it.
    return this.entityImport.run(user.id, workspaceId, dto, req.apiKey);
  }

  @Delete(':batchId')
  @ApiKeyAllowed()
  undo(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(EntityImportBatchParams) { batchId }: EntityImportBatchParams,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.entityImport.undo(user.id, workspaceId, batchId, req.apiKey);
  }
}
