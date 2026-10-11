import { Body, Controller, Get, Put } from '@nestjs/common';
import { IsBoolean, IsIn, IsISO8601 } from 'class-validator';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { TaxDeadlinesService } from './tax-deadlines.service';

class FiledElsewhereDto {
  @IsIn(['vat_return', 'income_tax'])
  kind: 'vat_return' | 'income_tax';

  @IsISO8601({ strict: true })
  periodEnd: string;

  @IsBoolean()
  filed: boolean;
}

@Controller('tax')
export class TaxDeadlinesController {
  constructor(private readonly deadlinesService: TaxDeadlinesService) {}

  /** The workspace's VAT and income-tax returns around today, with their due dates. */
  @Get('deadlines')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async upcoming(@WorkspaceId() workspaceId: string) {
    return this.deadlinesService.getUpcoming(workspaceId);
  }

  /** "I filed this one outside Lumio": stops its reminders. */
  @Put('deadlines/filed-elsewhere')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async setFiledElsewhere(@WorkspaceId() workspaceId: string, @Body() dto: FiledElsewhereDto) {
    await this.deadlinesService.setFiledElsewhere(workspaceId, dto.kind, dto.periodEnd, dto.filed);
    return this.deadlinesService.getUpcoming(workspaceId);
  }
}
