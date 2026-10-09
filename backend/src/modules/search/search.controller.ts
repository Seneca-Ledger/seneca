import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  // Без значения по умолчанию у параметра: babel не умеет транспилировать
  // параметр-декоратор вместе с default value и выдаёт синтаксически битый JS.
  async search(@WorkspaceId() workspaceId: string, @Query('q') q?: string) {
    return this.searchService.search(workspaceId, q ?? '');
  }

  @Get('recent')
  async recent(@WorkspaceId() workspaceId: string) {
    return this.searchService.recent(workspaceId);
  }
}
