import { Controller, Get, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaResponse } from '../../common/effect/schema-response';
import { WorkspaceVersion, WorkspaceVersionList } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { VersionsService } from './versions.service';

/** Dated versions of the current workspace; the owner's alone, as they hold every row. */
@Controller('versions')
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  @Get()
  @WorkspaceAuth()
  @SchemaResponse(WorkspaceVersionList)
  list(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.versionsService.list(workspaceId, user.id);
  }

  @Post()
  @WorkspaceAuth()
  @SchemaResponse(WorkspaceVersion)
  takeNow(@CurrentUser() user: User, @WorkspaceId() workspaceId: string) {
    return this.versionsService.takeNow(workspaceId, user.id);
  }
}
