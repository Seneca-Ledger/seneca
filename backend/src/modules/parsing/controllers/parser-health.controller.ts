import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SchemaResponse } from '../../../common/effect/schema-response';
import { InstanceAdminGuard } from '../../../common/guards/instance-admin.guard';
import { ParserHealth } from '../../../contracts';
import { ParserHealthService } from '../services/parser-health.service';

/** Instance-wide, not per workspace: only users with the `admin` role (see ParserHealthService). */
@Controller('parsing/health')
@UseGuards(InstanceAdminGuard)
export class ParserHealthController {
  constructor(private readonly parserHealthService: ParserHealthService) {}

  @Get()
  @ApiOperation({
    summary: "Each bank's parse outcomes and statement layouts over the last 30 days",
  })
  @ApiResponse({ status: 200, description: 'ParserHealth' })
  @SchemaResponse(ParserHealth)
  @ApiResponse({ status: 403, description: 'INSTANCE_ADMIN_ONLY' })
  getHealth() {
    return this.parserHealthService.health();
  }
}
