import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { SearchResponse } from '../../contracts';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  // Без значения по умолчанию у параметра: babel не умеет транспилировать
  // параметр-декоратор вместе с default value и выдаёт синтаксически битый JS.
  @SchemaResponse(SearchResponse)
  async search(@WorkspaceId() workspaceId: string, @Query('q') q?: string) {
    return this.searchService.search(workspaceId, q ?? '');
  }

  @Get('recent')
  @SchemaResponse(SearchResponse)
  async recent(@WorkspaceId() workspaceId: string) {
    return this.searchService.recent(workspaceId);
  }
}
