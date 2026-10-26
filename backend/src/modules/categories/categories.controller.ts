import { Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CategoriesQuery,
  CategoryItem,
  CategoryList,
  CategoryParams,
  CategoryUsageCount,
  CategoryUsageCounts,
  CreateCategoryBody,
  MessageResult,
  UpdateCategoryBody,
} from '../../contracts';
import { CategoryType } from '../../entities/category.entity';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @WorkspaceAuth(Permission.CATEGORY_CREATE)
  @SchemaResponse(CategoryItem)
  async create(
    @SchemaBody(CreateCategoryBody) createDto: CreateCategoryBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    const created = await this.categoriesService.create(workspaceId, user.id, createDto);
    // As the list reads it: with its parent and children, defaults filled.
    return this.categoriesService.findOne(created.id, workspaceId);
  }

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategoryList)
  async findAll(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CategoriesQuery) query: CategoriesQuery,
  ) {
    return this.categoriesService.findAll(workspaceId, toEnum(CategoryType, query.type));
  }

  @Get('usage/counts')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategoryUsageCounts)
  async getWorkspaceUsageCounts(@WorkspaceId() workspaceId: string) {
    return this.categoriesService.getWorkspaceCategoryUsageCounts(workspaceId);
  }

  @Get(':id/usage-count')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategoryUsageCount)
  async getUsageCount(
    @SchemaParams(CategoryParams) { id }: CategoryParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.categoriesService.getCategoryUsageCount(id, workspaceId);
  }

  @Get(':id')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(CategoryItem)
  async findOne(
    @SchemaParams(CategoryParams) { id }: CategoryParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.categoriesService.findOne(id, workspaceId);
  }

  @Put(':id')
  @WorkspaceAuth(Permission.CATEGORY_EDIT)
  @SchemaResponse(CategoryItem)
  async update(
    @SchemaParams(CategoryParams) { id }: CategoryParams,
    @SchemaBody(UpdateCategoryBody) updateDto: UpdateCategoryBody,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.categoriesService.update(id, workspaceId, user.id, updateDto);
    return this.categoriesService.findOne(id, workspaceId);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.CATEGORY_DELETE)
  @SchemaResponse(MessageResult)
  async remove(
    @SchemaParams(CategoryParams) { id }: CategoryParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.categoriesService.remove(id, workspaceId, user.id);
    return deletedResponse('Category');
  }
}
