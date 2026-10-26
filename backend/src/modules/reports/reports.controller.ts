import { Controller, Delete, Get, Patch, Post, Res, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { AllowInVersion } from '../../common/decorators/allow-in-version.decorator';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { SchemaBody } from '../../common/effect/schema-body';
import { SchemaParams, SchemaQuery } from '../../common/effect/schema-query';
import { SchemaResponse } from '../../common/effect/schema-response';
import { toEnum } from '../../common/effect/to-enum';
import { Permission } from '../../common/enums/permissions.enum';
import { HideInternalColumnsInterceptor } from '../../common/interceptors/hide-internal-columns.interceptor';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import {
  AvailableCustomTables,
  CashFlowMapAnswer,
  CashFlowMapQuery,
  CreateReportScheduleBody,
  CustomReportBody,
  CustomTablesReport,
  CustomTablesReportBody,
  CustomTablesReportDrillDown,
  CustomTablesReportDrillDownBody,
  CustomTablesSummaryBody,
  DailyReportQuery,
  ExportReportBody,
  GenerateReportBody,
  MonthlyReportQuery,
  ReportHistoryList,
  ReportHistoryParams,
  ReportPreview,
  ReportScheduleList,
  ReportScheduleParams,
  SpendFlow,
  SpendFlowQuery,
  SpendOverTimeQuery,
  StatementsSummaryQuery,
  TopCategoriesQuery,
  UpdateReportScheduleActiveBody,
  WorkspaceExportBody,
} from '../../contracts';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CashFlowMapService } from './cash-flow-map.service';
import { cashFlowMapToCsv } from './cash-flow-map.util';
import { ReportFormat } from './dto/custom-report.dto';
import { ExportFormat } from './dto/export-report.dto';
import { WorkspaceExportFormat } from './dto/workspace-export.dto';
import type { CustomReport } from './interfaces/custom-report.interface';
import type { DailyReport } from './interfaces/daily-report.interface';
import type { MonthlyReport } from './interfaces/monthly-report.interface';
import { ReportSchedulesService } from './report-schedules.service';
import { ReportsService } from './reports.service';
import { SpendFlowService } from './spend-flow.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportSchedules: ReportSchedulesService,
    private readonly spendFlowService: SpendFlowService,
    private readonly cashFlowMapService: CashFlowMapService,
  ) {}

  private scheduleTempFileCleanup(fileStream: fs.ReadStream, filePath: string) {
    const cleanup = () => {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // noop cleanup safeguard
      }
    };

    fileStream.on('end', cleanup);
    fileStream.on('error', cleanup);
  }

  @Get('statements/summary')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getStatementsSummary(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(StatementsSummaryQuery) query: StatementsSummaryQuery,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const days = query.days ?? 30;
    return this.reportsService.getStatementsSummary(workspaceId, days, selfMemberId ?? null);
  }

  /** Income sources → categories → subcategories, a treemap and a period comparison; `format=csv` exports the table. */
  @Get('cash-flow-map')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(CashFlowMapAnswer)
  async getCashFlowMap(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(CashFlowMapQuery) query: CashFlowMapQuery,
    @Res({ passthrough: true }) res: Response,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const map = await this.cashFlowMapService.getMap(
      workspaceId,
      query,
      user.locale,
      selfMemberId ?? null,
    );
    if (query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cash-flow-${map.period.from}-${map.period.to}.csv"`,
      );
      return cashFlowMapToCsv(map, map.currency);
    }
    return map;
  }

  @Get('top-categories')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getTopCategories(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(TopCategoriesQuery) query: TopCategoriesQuery,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reportsService.getTopCategoriesReport(workspaceId, query, selfMemberId);
  }

  @Get('spend-flow')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(SpendFlow)
  async getSpendFlow(
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(SpendFlowQuery) query: SpendFlowQuery,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.spendFlowService.getSpendFlow(workspaceId, query, selfMemberId);
  }

  @Get('spend-over-time')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getSpendOverTimeReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(SpendOverTimeQuery) query: SpendOverTimeQuery,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reportsService.getSpendOverTimeReport(workspaceId, query, selfMemberId);
  }

  @Post('custom-tables/summary')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCustomTablesSummary(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CustomTablesSummaryBody) dto: CustomTablesSummaryBody,
  ) {
    return this.reportsService.getCustomTablesSummary(workspaceId, dto);
  }

  @Post('custom-tables/report')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(CustomTablesReport)
  async getCustomTablesReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CustomTablesReportBody) dto: CustomTablesReportBody,
  ) {
    return this.reportsService.getCustomTablesReport(workspaceId, dto);
  }

  @Post('custom-tables/report/drill-down')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(CustomTablesReportDrillDown)
  async getCustomTablesReportDrillDown(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CustomTablesReportDrillDownBody) dto: CustomTablesReportDrillDownBody,
  ) {
    return this.reportsService.getCustomTablesReportDrillDown(workspaceId, dto);
  }

  @Get('custom-tables/available')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(AvailableCustomTables)
  async getAvailableCustomTables(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportsService.getAvailableCustomTables(workspaceId);
  }

  @Get('daily')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getDailyReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(DailyReportQuery) { date }: DailyReportQuery,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const reportDate =
      date === 'latest'
        ? await this.reportsService.getLatestTransactionDate(workspaceId)
        : date ||
          (await this.reportsService.getLatestTransactionDate(workspaceId)) ||
          new Date().toISOString().split('T')[0];
    return this.reportsService.generateDailyReport(
      workspaceId,
      reportDate ?? '',
      selfMemberId ?? null,
    );
  }

  @Get('monthly')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getMonthlyReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaQuery(MonthlyReportQuery) { year, month }: MonthlyReportQuery,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const latest = await this.reportsService.getLatestTransactionPeriod(workspaceId);
    const currentDate = new Date();
    const reportYear = year ?? (latest.year || currentDate.getFullYear());
    const reportMonth = month ?? (latest.month || currentDate.getMonth() + 1);
    return this.reportsService.generateMonthlyReport(
      workspaceId,
      reportYear,
      reportMonth,
      selfMemberId ?? null,
    );
  }

  @Post('custom')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCustomReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CustomReportBody) dto: CustomReportBody,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    return this.reportsService.generateCustomReport(workspaceId, dto, selfMemberId ?? null);
  }

  @Post('export')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async exportReport(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(ExportReportBody) dto: ExportReportBody,
    @Res() res: Response,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    // Generate report based on date range
    let reportData: DailyReport | MonthlyReport | CustomReport;

    if (dto.dateFrom && dto.dateTo) {
      // Custom report
      const customDto: CustomReportBody = {
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
        format: dto.format === ExportFormat.EXCEL ? ReportFormat.EXCEL : ReportFormat.CSV,
      };
      reportData = await this.reportsService.generateCustomReport(
        workspaceId,
        customDto,
        selfMemberId ?? null,
      );
    } else {
      // Daily report for today
      const today = new Date().toISOString().split('T')[0];
      reportData = await this.reportsService.generateDailyReport(
        workspaceId,
        today,
        selfMemberId ?? null,
      );
    }

    // Export report
    const { filePath, fileName } = await this.reportsService.exportReport(
      workspaceId,
      dto,
      reportData,
      user?.locale,
    );

    // Send file
    res.setHeader(
      'Content-Type',
      dto.format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv',
    );
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    // Clean up file after sending
    this.scheduleTempFileCleanup(fileStream, filePath);
  }

  @Post('preview')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ReportPreview)
  async previewReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(GenerateReportBody) dto: GenerateReportBody,
  ) {
    return this.reportsService.previewTemplate(workspaceId, dto);
  }

  @Post('generate')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async generateReport(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(GenerateReportBody) dto: GenerateReportBody,
    @Res() res: Response,
  ) {
    const { filePath, fileName, contentType } = await this.reportsService.generateFromTemplate(
      workspaceId,
      user.id,
      dto,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    // No cleanup: the file is retained under uploads/reports for the History tab.
    fs.createReadStream(filePath).pipe(res);
  }

  @Post('workspace-export')
  // Reads only: allowed in a past version.
  @AllowInVersion()
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async exportWorkspaceTransactions(
    @WorkspaceId() workspaceId: string,
    @SchemaBody(WorkspaceExportBody) dto: WorkspaceExportBody,
    @Res() res: Response,
    @WorkspaceMemberId() selfMemberId?: string | null,
  ) {
    const { filePath, fileName, mimeType } = await this.reportsService.exportWorkspaceTransactions(
      workspaceId,
      toEnum(WorkspaceExportFormat, dto.format) || WorkspaceExportFormat.EXCEL,
      selfMemberId ?? null,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    this.scheduleTempFileCleanup(fileStream, filePath);
  }

  @Get('history')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @UseInterceptors(HideInternalColumnsInterceptor)
  @SchemaResponse(ReportHistoryList)
  async getHistory(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportsService.getReportHistory(workspaceId);
  }

  @Get('history/:reportId/download')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async downloadHistoryReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(ReportHistoryParams) { reportId }: ReportHistoryParams,
    @Res() res: Response,
  ) {
    const { filePath, fileName, contentType } = await this.reportsService.downloadHistoryReport(
      workspaceId,
      reportId,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Get('schedules')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  @SchemaResponse(ReportScheduleList)
  async listSchedules(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportSchedules.list(workspaceId);
  }

  @Post('schedules')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async createSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaBody(CreateReportScheduleBody) dto: CreateReportScheduleBody,
  ) {
    return this.reportSchedules.create(workspaceId, user.id, dto);
  }

  @Patch('schedules/:scheduleId')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async updateScheduleActive(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(ReportScheduleParams) { scheduleId }: ReportScheduleParams,
    @SchemaBody(UpdateReportScheduleActiveBody) dto: UpdateReportScheduleActiveBody,
  ) {
    return this.reportSchedules.setActive(workspaceId, scheduleId, dto.isActive);
  }

  @Delete('schedules/:scheduleId')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async deleteSchedule(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @SchemaParams(ReportScheduleParams) { scheduleId }: ReportScheduleParams,
  ) {
    await this.reportSchedules.remove(workspaceId, scheduleId);
    return { success: true };
  }

  @Get('latest')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getLatestPeriod(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportsService.getLatestTransactionPeriod(workspaceId);
  }
}
