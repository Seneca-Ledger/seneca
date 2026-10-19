import { Schema, Struct } from 'effect';
import { Permission } from '../../../common/enums/permissions.enum';
import { CategoryList, CreateCategoryBody, UpdateCategoryBody } from '../../../contracts';
import type { CategoryType } from '../../../entities/category.entity';
import type { CategoriesService } from '../../categories/categories.service';
import { defineTool, type McpTool } from '../mcp-tool';
import { described, Uuid } from './inputs';

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
    defineTool({
      name: 'create_category',
      description:
        'Create an income or expense category, optionally under a parent. Logged as this API key and undoable from the activity log.',
      input: CreateCategoryBody,
      permissions: [Permission.CATEGORY_CREATE],
      readOnly: false,
      run: (ctx, args) => categories.create(ctx.workspaceId, ctx.user.id, args),
    }),
    defineTool({
      name: 'update_category',
      description:
        'Rename, recolour, move or switch off a category. Logged as this API key and undoable from the activity log.',
      input: UpdateCategoryBody.mapFields(Struct.assign({ id: Uuid })),
      permissions: [Permission.CATEGORY_EDIT],
      readOnly: false,
      run: (ctx, { id, ...changes }) =>
        categories.update(id, ctx.workspaceId, ctx.user.id, changes),
    }),
  ];
}
