import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { SearchResponse } from '../../../contracts';
import type { SearchService } from '../../search/search.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described } from './inputs';

export function searchTools(search: SearchService): McpTool[] {
  return [
    defineTool({
      name: 'search',
      description:
        'Search documents and transactions by merchant, note, file name or amount, as the app’s search box does.',
      input: Schema.Struct({
        q: described(
          Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
          'Search text',
        ),
      }),
      // The REST route checks membership only; what it searches is transactions.
      permissions: [Permission.TRANSACTION_VIEW],
      output: SearchResponse,
      readOnly: true,
      run: (ctx, args) => search.search(ctx.workspaceId, args.q),
    }),
  ];
}
