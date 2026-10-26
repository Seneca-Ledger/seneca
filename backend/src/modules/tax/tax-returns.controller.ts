import { Controller, Get, Post, StreamableFile } from '@nestjs/common';
import { WorkspaceId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  TaxReturnExportQuery,
  TaxReturnPeriodBody,
  TaxReturnPeriodQuery,
  TaxReturnPreview,
  TaxReturnRecord,
  TaxReturnRecordList,
  UstvaResult,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TaxReturnsService } from './tax-returns.service';
import { UstvaService } from './ustva/ustva.service';

@Controller('tax/returns')
export class TaxReturnsController {
  constructor(
    private readonly taxReturnsService: TaxReturnsService,
    private readonly ustvaService: UstvaService,
  ) {}

  @Get()
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxReturnRecordList)
  async findAll(@WorkspaceId() workspaceId: string) {
    return this.taxReturnsService.findAll(workspaceId);
  }

  /** Draft for a period, recomputed on every read until it is filed. */
  @Get('period')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxReturnRecord)
  async getForPeriod(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(TaxReturnPeriodQuery) { periodStart, periodEnd }: TaxReturnPeriodQuery,
  ) {
    return this.taxReturnsService.getForPeriod(workspaceId, periodStart, periodEnd);
  }

  /** The lines behind a period, without persisting anything. */
  @Get('preview')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(TaxReturnPreview)
  async preview(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(TaxReturnPeriodQuery) { periodStart, periodEnd }: TaxReturnPeriodQuery,
  ) {
    return this.taxReturnsService.computeTotals(workspaceId, periodStart, periodEnd);
  }

  /**
   * The period on the lines of Germany's Umsatzsteuer-Voranmeldung (USt 1 A),
   * Kennzahl by Kennzahl, for entering in Mein ELSTER.
   */
  @Get('ustva')
  @WorkspaceAuth(Permission.CATEGORY_VIEW)
  @SchemaResponse(UstvaResult)
  async ustva(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(TaxReturnPeriodQuery) { periodStart, periodEnd }: TaxReturnPeriodQuery,
  ) {
    return this.ustvaService.build(workspaceId, periodStart, periodEnd);
  }

  // Filing locks transactions and records a submission, so it sits behind
  // settings management rather than the view permission.
  @Post('file')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxReturnRecord)
  async file(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(TaxReturnPeriodBody) dto: TaxReturnPeriodBody,
    @CurrentUser() user: User,
  ) {
    return this.taxReturnsService.file(workspaceId, dto.periodStart, dto.periodEnd, user.id);
  }

  @Post('reopen')
  @WorkspaceAuth(Permission.WORKSPACE_SETTINGS_MANAGE)
  @SchemaResponse(TaxReturnRecord)
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
    @SchemaQuery(TaxReturnExportQuery) { periodStart, periodEnd, format }: TaxReturnExportQuery,
  ): Promise<StreamableFile> {
    const { buffer, fileName, contentType } = await this.taxReturnsService.export(
      workspaceId,
      periodStart,
      periodEnd,
      format,
    );

    return new StreamableFile(buffer, {
      type: contentType,
      disposition: buildContentDisposition('attachment', fileName),
    });
  }
}
