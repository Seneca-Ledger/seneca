import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RunEntityImportDto } from './dto/run-entity-import.dto';
import { SuggestImportDto } from './dto/suggest-import.dto';
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
  suggestTarget(@WorkspaceId() workspaceId: string, @Body() dto: SuggestImportDto) {
    return this.suggest.suggest(workspaceId, dto);
  }

  @Post()
  run(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: RunEntityImportDto,
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
