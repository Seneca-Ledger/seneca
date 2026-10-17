import { Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import {
  BackfillEmbeddingsBody,
  SearchTransactionsBody,
  TransactionSearchResult,
} from '../../contracts';
import { TransactionSearchService } from './transaction-search.service';

@Controller('ai-analysis/search')
@UseGuards(JwtAuthGuard, WorkspaceContextGuard)
export class TransactionSearchController {
  constructor(private readonly searchService: TransactionSearchService) {}

  /**
   * POST rather than GET: the query is free text that may contain a merchant
   * name or amount, and query strings end up in access logs and browser history.
   */
  // Tighter than the global 500/min: each call runs a transformer forward pass
  // on the API process, so this is CPU the whole deployment shares.
  @Post()
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @SchemaResponse(TransactionSearchResult)
  search(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SearchTransactionsBody) body: SearchTransactionsBody,
  ) {
    return this.searchService.search(workspaceId, body.query, body.limit ?? undefined);
  }

  // Tighter still: one call embeds up to a few hundred transactions.
  @Post('backfill')
  @Throttle({ default: { limit: 6, ttl: 60000 } })
  backfill(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(BackfillEmbeddingsBody) body: BackfillEmbeddingsBody,
  ) {
    return this.searchService.backfill(workspaceId, body.batchSize ?? undefined);
  }
}
