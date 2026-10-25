import { Controller, Delete, Get, Patch, Post } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import {
  CreateReportScheduleBody,
  ReportScheduleItem,
  ReportScheduleList,
  ReportScheduleParams,
  UpdateReportScheduleActiveBody,
} from '../../contracts';
import { ReportScheduleRemoved } from '../../contracts/reports/report-summaries';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ReportSchedulesService } from './report-schedules.service';

/** Reports e-mailed on a cadence. */
@Controller('reports/schedules')
export class ReportSchedulesController {
  constructor(private readonly reportSchedules: ReportSchedulesService) {}

  @Get()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ReportScheduleList)
  async listSchedules(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportSchedules.list(workspaceId);
  }

  @Post()
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  @SchemaResponse(ReportScheduleItem)
  async createSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateReportScheduleBody) dto: CreateReportScheduleBody,
  ) {
    return this.reportSchedules.create(workspaceId, user.id, dto);
  }

  @Patch(':scheduleId')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  @SchemaResponse(ReportScheduleItem)
  async updateScheduleActive(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(ReportScheduleParams) { scheduleId }: ReportScheduleParams,
    @SchemaBody(UpdateReportScheduleActiveBody) dto: UpdateReportScheduleActiveBody,
  ) {
    return this.reportSchedules.setActive(workspaceId, scheduleId, dto.isActive);
  }

  @Delete(':scheduleId')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  @SchemaResponse(ReportScheduleRemoved)
  async deleteSchedule(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(ReportScheduleParams) { scheduleId }: ReportScheduleParams,
  ) {
    await this.reportSchedules.remove(workspaceId, scheduleId);
    return { success: true };
  }
}
