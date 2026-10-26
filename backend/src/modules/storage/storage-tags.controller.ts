import { Controller, Delete, Get, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WorkspaceContextGuard } from '../../common/guards/workspace-context.guard';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CreateTagBody,
  MessageResult,
  StorageIdParams,
  StorageTag,
  StorageTagList,
  UpdateTagBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TagsService } from '../tags/tags.service';

/** The record's uuid in `:id`. */
const StorageId = () => SchemaParams(StorageIdParams);

/** The `/storage/tags` routes, kept for old clients; the tags live in TagsService. */
@Controller('storage')
@UseGuards(JwtAuthGuard)
@UseInterceptors(HideInternalColumnsInterceptor)
export class StorageTagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * Create tag
   * POST /api/v1/storage/tags
   */
  @Post('tags')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageTag)
  async createTag(
    @SchemaBody(CreateTagBody) dto: CreateTagBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.tagsService.create(dto, workspaceId);
  }

  /**
   * List tags
   * GET /api/v1/storage/tags
   */
  @Get('tags')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageTagList)
  async listTags(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return await this.tagsService.list(workspaceId);
  }

  /**
   * Update tag
   * PATCH /api/v1/storage/tags/:id
   */
  @Patch('tags/:id')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(StorageTag)
  async updateTag(
    @StorageId() { id: tagId }: StorageIdParams,
    @SchemaBody(UpdateTagBody) dto: UpdateTagBody,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    return await this.tagsService.update(tagId, dto, workspaceId);
  }

  /**
   * Delete tag
   * DELETE /api/v1/storage/tags/:id
   */
  @Delete('tags/:id')
  @UseGuards(WorkspaceContextGuard)
  @SchemaResponse(MessageResult)
  async deleteTag(
    @StorageId() { id: tagId }: StorageIdParams,
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
  ) {
    await this.tagsService.remove(tagId, workspaceId);
    return deletedResponse('Tag');
  }
}
