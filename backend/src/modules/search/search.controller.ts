import { Controller, Get } from '@nestjs/common';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { SearchResponse } from '../../contracts';
import { SearchQuery } from '../../contracts/requests/search';
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
  // Без значения по умолчанию у параметра: Babel, которым раньше собирались тесты,
  // не умел транспилировать параметр-декоратор вместе с default value.
  @SchemaResponse(SearchResponse)
  async search(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() selfMemberId: string | null,
    @SchemaQuery(SearchQuery) { q }: SearchQuery,
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
