import { Schema } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { CategoryList } from '../../../contracts';
import type { CategoryType } from '../../../entities/category.entity';
import type { CategoriesService } from '../../categories/categories.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described } from './inputs';

export function categoryTools(categories: CategoriesService): McpTool[] {
  return [
    defineTool({
      name: 'list_categories',
      description:
        'The workspace categories as a tree (`children`), with their ids for filtering and categorising transactions.',
      input: Schema.Struct({
        type: Schema.optionalKey(
          described(
            Schema.Literals(['income', 'expense']),
            'Only income or only expense categories',
          ),
        ),
      }),
      permissions: [Permission.CATEGORY_VIEW],
      output: CategoryList,
      readOnly: true,
      run: (ctx, args) =>
        categories.findAll(ctx.workspaceId, args.type as CategoryType | undefined),
    }),
  ];
}
