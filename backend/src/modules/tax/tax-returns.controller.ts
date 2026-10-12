import { BadRequestException, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { TaxReturnPeriodBody } from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaxReturnsService } from './tax-returns.service';

@Controller('tax/returns')
export class TaxReturnsController {
  constructor(private readonly taxReturnsService: TaxReturnsService) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.taxReturnsService.findAll(workspaceId);
  }

  /** Draft for a period, recomputed on every read until it is filed. */
  @Get('period')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async getForPeriod(
    @WorkspaceId() workspaceId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.taxReturnsService.getForPeriod(workspaceId, periodStart, periodEnd);
  }

  /** The lines behind a period, without persisting anything. */
  @Get('preview')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async preview(
    @WorkspaceId() workspaceId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.taxReturnsService.computeTotals(workspaceId, periodStart, periodEnd);
  }

  // Filing locks transactions and records a submission, so it sits behind
  // settings management rather than the view permission.
  @Post('file')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async file(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(TaxReturnPeriodBody) dto: TaxReturnPeriodBody,
    @CurrentUser() user: User,
  ) {
    return this.taxReturnsService.file(workspaceId, dto.periodStart, dto.periodEnd, user.id);
  }

  @Post('reopen')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  async reopen(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(TaxReturnPeriodBody) dto: TaxReturnPeriodBody,
    @CurrentUser() user: User,
  ) {
    return this.taxReturnsService.reopen(workspaceId, dto.periodStart, dto.periodEnd, user.id);
  }

  /**
   * The return as a document. A draft is rendered from current data and marked
   * as a draft; a filed one is rendered from its snapshot, so the file shows
   * what was actually submitted.
   */
  @Get('export')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  async export(
    @WorkspaceId() workspaceId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    if (format !== 'pdf' && format !== 'xlsx') {
      throw new BadRequestException("Format must be 'pdf' or 'xlsx'");
    }

    const { buffer, fileName, contentType } = await this.taxReturnsService.export(
      workspaceId,
      periodStart,
      periodEnd,
      format,
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    res.send(buffer);
  }
}
