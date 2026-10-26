import { Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import {
  CopyWorkspaceVersionBody,
  OpenedWorkspaceVersion,
  WorkspaceVersion,
  WorkspaceVersionList,
  WorkspaceVersionParams,
} from '../../contracts';
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

  /** Opens a version read only; also asked from inside another opened version. */
  @Post(':id/open')
  @WorkspaceAuth()
  @AllowInVersion()
  @HttpCode(200)
  @SchemaResponse(OpenedWorkspaceVersion)
  async open(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceVersionParams) { id }: WorkspaceVersionParams,
  ) {
    const workspace = await this.versionsService.open(id, user.id);
    return { workspaceId: workspace.id, name: workspace.name };
  }

  /** "Save as copy": asked from inside the opened version the person is looking at. */
  @Post(':id/copy')
  @WorkspaceAuth()
  @AllowInVersion()
  @HttpCode(200)
  @SchemaResponse(OpenedWorkspaceVersion)
  async copy(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceVersionParams) { id }: WorkspaceVersionParams,
    @SchemaBody(CopyWorkspaceVersionBody) body: CopyWorkspaceVersionBody,
  ) {
    const workspace = await this.versionsService.copy(id, user.id, body.name);
    return { workspaceId: workspace.id, name: workspace.name };
  }

  @Delete(':id/open')
  @WorkspaceAuth()
  @AllowInVersion()
  @HttpCode(204)
  close(
    @CurrentUser() user: User,
    @SchemaParams(WorkspaceVersionParams) { id }: WorkspaceVersionParams,
  ) {
    return this.versionsService.close(id, user.id);
  }
}
