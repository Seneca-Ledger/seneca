import { Controller, Get, Put } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { FiledElsewhereBody, TaxDeadlineList } from '../../contracts';
import { TaxDeadlinesService } from './tax-deadlines.service';

@Controller('tax')
export class TaxDeadlinesController {
  constructor(private readonly deadlinesService: TaxDeadlinesService) {}

  /** The workspace's VAT and income-tax returns around today, with their due dates. */
  @Get('deadlines')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(TaxDeadlineList)
  async upcoming(@WorkspaceId() workspaceId: string) {
    return this.deadlinesService.getUpcoming(workspaceId);
  }

  /** "I filed this one outside Seneca": stops its reminders. */
  @Put('deadlines/filed-elsewhere')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxDeadlineList)
  async setFiledElsewhere(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(FiledElsewhereBody) dto: FiledElsewhereBody,
  ) {
    await this.deadlinesService.setFiledElsewhere(workspaceId, dto.kind, dto.periodEnd, dto.filed);
    return this.deadlinesService.getUpcoming(workspaceId);
  }
}
