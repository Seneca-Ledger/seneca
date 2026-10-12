import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaQuery } from '../../common/effect/schema-query';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import { TaxPackQuery, TaxYearReportQuery } from '../../contracts';
import { TaxPackService } from './tax-pack.service';

@Controller('tax')
export class TaxPackController {
  constructor(private readonly taxPackService: TaxPackService) {}

  /** The year's tax-relevant rows, by category, with how many documents back them. */
  @Get('year-report')
  @WorkspaceAuth(Permission.REPORT_VIEW, Permission.TRANSACTION_VIEW)
  async yearReport(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @SchemaQuery(TaxYearReportQuery) query: TaxYearReportQuery,
  ) {
    return this.taxPackService.yearReport(workspaceId, query.year, memberId ?? null);
  }

  /**
   * Rows, totals and every document behind them, as one ZIP. A file that
   * leaves the app, so it takes the export permission: a member, an
   * accountant or an owner, not a viewer.
   */
  @Get('pack')
  @WorkspaceAuth(Permission.REPORT_EXPORT, Permission.TRANSACTION_VIEW, Permission.STATEMENT_VIEW)
  async pack(
    @WorkspaceId() workspaceId: string,
    @WorkspaceMemberId() memberId: string | null,
    @SchemaQuery(TaxPackQuery) query: TaxPackQuery,
    @Res() res: Response,
  ): Promise<void> {
    const scope = query.scope ?? 'relevant';
    const fileName = `tax-pack_${query.from}_${query.to}${scope === 'all' ? '_all' : ''}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    await this.taxPackService.writePack(
      workspaceId,
      { from: query.from, to: query.to, scope },
      memberId ?? null,
      res,
    );
  }
}
