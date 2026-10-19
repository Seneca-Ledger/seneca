import { Controller, Get, Query } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { SearchResponse } from '../../contracts';
import { SearchService } from './search.service';

/** Results span these kinds of records, so a scoped API key needs to read all of them. */
const SEARCH_PERMISSIONS = [
  Permission.TRANSACTION_VIEW,
  Permission.STATEMENT_VIEW,
  Permission.PAYABLE_VIEW,
  Permission.CATEGORY_VIEW,
];

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @WorkspaceAuth(...SEARCH_PERMISSIONS)
  // Без значения по умолчанию у параметра: babel не умеет транспилировать
  // параметр-декоратор вместе с default value и выдаёт синтаксически битый JS.
  @SchemaResponse(SearchResponse)
  async search(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @Query('q') q?: string,
  ) {
    return this.searchService.search(workspaceId, q ?? '', selfMemberId);
  }

  @Get('recent')
  @WorkspaceAuth(...SEARCH_PERMISSIONS)
  @SchemaResponse(SearchResponse)
  async recent(@WorkspaceId() workspaceId: string) {
    return this.searchService.recent(workspaceId);
  }
}
