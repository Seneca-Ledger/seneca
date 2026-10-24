import { Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { deletedResponse } from '../../common/utils/responses.util';
import {
  CreateTagBody,
  StorageTag,
  TagList,
  TransactionTagLinks,
  UpdateTagBody,
} from '../../contracts';
import { EntityType } from '../../entities/audit-event.entity';
import { Audit } from '../audit/decorators/audit.decorator';
import { TagsService } from './tags.service';

/** The Tags page: the workspace's tags with how often each is used. */
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  @WorkspaceAuth(Permission.TAG_VIEW)
  @SchemaResponse(TagList)
  async list(@WorkspaceId() workspaceId: string) {
    return this.tagsService.listWithUsage(workspaceId);
  }

  @Get('transaction-links')
  @WorkspaceAuth(Permission.TAG_VIEW)
  @SchemaResponse(TransactionTagLinks)
  async transactionLinks(@WorkspaceId() workspaceId: string) {
    return this.tagsService.transactionLinks(workspaceId);
  }

  @Post()
  @WorkspaceAuth(Permission.TAG_CREATE)
  @Audit({ entityType: EntityType.TAG, includeDiff: true })
  @SchemaResponse(StorageTag)
  async create(@SchemaBody(CreateTagBody) body: CreateTagBody, @WorkspaceId() workspaceId: string) {
    return this.tagsService.create(body, workspaceId);
  }

  @Patch(':id')
  @WorkspaceAuth(Permission.TAG_EDIT)
  @Audit({ entityType: EntityType.TAG, includeDiff: true })
  @SchemaResponse(StorageTag)
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @SchemaBody(UpdateTagBody) body: UpdateTagBody,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.tagsService.update(id, body, workspaceId);
  }

  @Delete(':id')
  @WorkspaceAuth(Permission.TAG_DELETE)
  @Audit({ entityType: EntityType.TAG, includeDiff: false })
  async remove(@Param('id', new ParseUUIDPipe()) id: string, @WorkspaceId() workspaceId: string) {
    await this.tagsService.remove(id, workspaceId);
    return deletedResponse('Tag');
  }
}
