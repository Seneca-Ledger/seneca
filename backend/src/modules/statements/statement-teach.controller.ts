import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  StatementLayoutWords,
  StatementParams,
  StatementWritten,
  TeachLayoutBody,
  TeachLayoutPreview,
  TeachShareInfo,
  TeachShareResult,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LayoutShareService } from '../parsing/services/layout-share.service';
import { LayoutTemplateService } from '../parsing/services/layout-template.service';
import { StatementsService } from './statements.service';

/**
 * Teaching the parser a layout it could not read: the file's words for the
 * marking view, a reading of the marked areas, and saving them as the
 * workspace's layout before the statement is read again.
 */
@Controller('statements')
export class StatementTeachController {
  constructor(
    private readonly layoutTemplates: LayoutTemplateService,
    private readonly statementsService: StatementsService,
    private readonly layoutShare: LayoutShareService,
  ) {}

  @Get(':id/teach/share')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: "What sharing the statement's taught layout with the project sends" })
  @SchemaResponse(TeachShareInfo)
  shareInfo(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.layoutShare.info(id, workspaceId);
  }

  @Post(':id/teach/share')
  @HttpCode(200)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({
    summary: "Send the statement's taught layout to the project, at the user's request",
  })
  @SchemaResponse(TeachShareResult)
  share(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.layoutShare.share(id, workspaceId);
  }

  @Get(':id/layout-words')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: "Every word of the statement's PDF the parser reads, where it sits" })
  @SchemaResponse(StatementLayoutWords)
  layoutWords(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @WorkspaceId() workspaceId: string,
  ) {
    return this.layoutTemplates.words(id, workspaceId);
  }

  @Post(':id/teach/preview')
  @HttpCode(200)
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({ summary: 'How the statement reads with the marked areas; nothing is saved' })
  @SchemaResponse(TeachLayoutPreview)
  preview(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(TeachLayoutBody) { regions }: TeachLayoutBody,
  ) {
    return this.layoutTemplates.preview(id, workspaceId, regions);
  }

  @Post(':id/teach')
  @WorkspaceAuth(Permission.STATEMENT_EDIT)
  @ApiOperation({
    summary: "Save the marked areas as the workspace's layout and read the statement again",
  })
  @SchemaResponse(StatementWritten)
  async teach(
    @SchemaParams(StatementParams) { id }: StatementParams,
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(TeachLayoutBody) { regions }: TeachLayoutBody,
  ) {
    await this.layoutTemplates.teach(id, workspaceId, user.id, regions);
    return this.statementsService.reprocess(id, user.id, workspaceId, 'replace');
  }
}
