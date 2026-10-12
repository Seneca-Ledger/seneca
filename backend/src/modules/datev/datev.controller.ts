import { Controller, Get, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { SaveDatevSettingsBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DatevService } from './datev.service';
import { DatevMappingQueryDto, DatevPeriodDto } from './dto/datev.dto';

/**
 * The DATEV export for a German or Austrian tax adviser. Its settings and the
 * category → account mapping only shape the export, so whoever may export —
 * a member, the accountant, the owner — may set them.
 */
@Controller('tax/datev')
export class DatevController {
  constructor(private readonly datevService: DatevService) {}

  @Get('settings')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getSettings(@WorkspaceId() workspaceId: string) {
    return this.datevService.getSettings(workspaceId);
  }

  @Put('settings')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async saveSettings(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(SaveDatevSettingsBody) dto: SaveDatevSettingsBody,
    @CurrentUser() user: User,
  ) {
    return this.datevService.saveSettings(workspaceId, dto, user.id);
  }

  @Get('mapping')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async mapping(@WorkspaceId() workspaceId: string, @Query() query: DatevMappingQueryDto) {
    return this.datevService.getMapping(workspaceId, query.year);
  }

  /** What the file for a period would hold, and what it would leave out and why. */
  @Get('preview')
  @WorkspaceAuth(Permission.REPORT_EXPORT, Permission.TRANSACTION_VIEW)
  async preview(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @Query() query: DatevPeriodDto,
  ) {
    return this.datevService.preview(workspaceId, query.from, query.to, memberId ?? null);
  }

  @Get('export')
  @WorkspaceAuth(Permission.REPORT_EXPORT, Permission.TRANSACTION_VIEW)
  async export(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @Query() query: DatevPeriodDto,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName } = await this.datevService.exportFile(
      workspaceId,
      query.from,
      query.to,
      memberId ?? null,
    );
    res.setHeader('Content-Type', 'text/csv; charset=windows-1252');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(buffer);
  }
}
