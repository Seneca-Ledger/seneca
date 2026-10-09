import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { WorkspaceId, WorkspaceMemberId } from '../../common/decorators/workspace.decorator';
import { WorkspaceAuth } from '../../common/decorators/workspace-auth.decorator';
import { Permission } from '../../common/enums/permissions.enum';
import { buildContentDisposition } from '../../common/utils/http-file.util';
import type { User } from '../../entities/user.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CashFlowMapService } from './cash-flow-map.service';
import { cashFlowMapToCsv } from './cash-flow-map.util';
import { CashFlowMapQueryDto } from './dto/cash-flow-map-query.dto';
import { type CustomReportDto, ReportFormat } from './dto/custom-report.dto';
import {
  CustomTablesReportDrillDownDto,
  CustomTablesReportDto,
} from './dto/custom-tables-report.dto';
import { CustomTablesSummaryDto } from './dto/custom-tables-summary.dto';
import { ExportFormat, type ExportReportDto } from './dto/export-report.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import { CreateReportScheduleDto, UpdateReportScheduleActiveDto } from './dto/report-schedule.dto';
import { SpendFlowQueryDto } from './dto/spend-flow-query.dto';
import { SpendOverTimeQueryDto } from './dto/spend-over-time-query.dto';
import { TopCategoriesQueryDto } from './dto/top-categories-query.dto';
import { type WorkspaceExportDto, WorkspaceExportFormat } from './dto/workspace-export.dto';
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
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days?: number,
  ) {
    return this.reportsService.getStatementsSummary(workspaceId, days);
  }

  /** Income sources → categories → subcategories, a treemap and a period comparison; `format=csv` exports the table. */
  @Get('cash-flow-map')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCashFlowMap(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Query() query: CashFlowMapQueryDto,
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
    @Query() query: TopCategoriesQueryDto,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reportsService.getTopCategoriesReport(workspaceId, query, selfMemberId);
  }

  @Get('spend-flow')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getSpendFlow(
    @WorkspaceId() workspaceId: string,
    @Query() query: SpendFlowQueryDto,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.spendFlowService.getSpendFlow(workspaceId, query, selfMemberId);
  }

  @Get('spend-over-time')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getSpendOverTimeReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query() query: SpendOverTimeQueryDto,
    @WorkspaceMemberId() selfMemberId: string | null,
  ) {
    return this.reportsService.getSpendOverTimeReport(workspaceId, query, selfMemberId);
  }

  @Post('custom-tables/summary')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCustomTablesSummary(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CustomTablesSummaryDto,
  ) {
    return this.reportsService.getCustomTablesSummary(workspaceId, dto);
  }

  @Post('custom-tables/report')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCustomTablesReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CustomTablesReportDto,
  ) {
    return this.reportsService.getCustomTablesReport(workspaceId, dto);
  }

  @Post('custom-tables/report/drill-down')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCustomTablesReportDrillDown(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CustomTablesReportDrillDownDto,
  ) {
    return this.reportsService.getCustomTablesReportDrillDown(workspaceId, dto);
  }

  @Get('custom-tables/available')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getAvailableCustomTables(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportsService.getAvailableCustomTables(workspaceId);
  }

  @Get('daily')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getDailyReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('date') date?: string,
  ) {
    const reportDate =
      date === 'latest'
        ? await this.reportsService.getLatestTransactionDate(workspaceId)
        : date ||
          (await this.reportsService.getLatestTransactionDate(workspaceId)) ||
          new Date().toISOString().split('T')[0];
    return this.reportsService.generateDailyReport(workspaceId, reportDate);
  }

  @Get('monthly')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getMonthlyReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const latest = await this.reportsService.getLatestTransactionPeriod(workspaceId);
    const currentDate = new Date();
    const reportYear = year ? Number.parseInt(year, 10) : latest.year || currentDate.getFullYear();
    const reportMonth = month
      ? Number.parseInt(month, 10)
      : latest.month || currentDate.getMonth() + 1;
    return this.reportsService.generateMonthlyReport(workspaceId, reportYear, reportMonth);
  }

  @Post('custom')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getCustomReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CustomReportDto,
  ) {
    return this.reportsService.generateCustomReport(workspaceId, dto);
  }

  @Post('export')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async exportReport(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: ExportReportDto,
    @Res() res: Response,
  ) {
    // Generate report based on date range
    let reportData: DailyReport | MonthlyReport | CustomReport;

    if (dto.dateFrom && dto.dateTo) {
      // Custom report
      const customDto: CustomReportDto = {
        dateFrom: dto.dateFrom,
        dateTo: dto.dateTo,
        format: dto.format === ExportFormat.EXCEL ? ReportFormat.EXCEL : ReportFormat.CSV,
      };
      reportData = await this.reportsService.generateCustomReport(workspaceId, customDto);
    } else {
      // Daily report for today
      const today = new Date().toISOString().split('T')[0];
      reportData = await this.reportsService.generateDailyReport(workspaceId, today);
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
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async previewReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: GenerateReportDto,
  ) {
    return this.reportsService.previewTemplate(workspaceId, dto);
  }

  @Post('generate')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async generateReport(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: GenerateReportDto,
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
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async exportWorkspaceTransactions(
    @WorkspaceId() workspaceId: string,
    @Body() dto: WorkspaceExportDto,
    @Res() res: Response,
  ) {
    const { filePath, fileName, mimeType } = await this.reportsService.exportWorkspaceTransactions(
      workspaceId,
      dto.format || WorkspaceExportFormat.EXCEL,
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', buildContentDisposition('attachment', fileName));

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    this.scheduleTempFileCleanup(fileStream, filePath);
  }

  @Get('history')
  @WorkspaceAuth(Permission.REPORT_VIEW)
  async getHistory(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportsService.getReportHistory(workspaceId);
  }

  @Get('history/:reportId/download')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async downloadHistoryReport(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('reportId') reportId: string,
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
  async listSchedules(@CurrentUser() _user: User, @WorkspaceId() workspaceId: string) {
    return this.reportSchedules.list(workspaceId);
  }

  @Post('schedules')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async createSchedule(
    @CurrentUser() user: User,
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateReportScheduleDto,
  ) {
    return this.reportSchedules.create(workspaceId, user.id, dto);
  }

  @Patch('schedules/:scheduleId')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async updateScheduleActive(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateReportScheduleActiveDto,
  ) {
    return this.reportSchedules.setActive(workspaceId, scheduleId, dto.isActive);
  }

  @Delete('schedules/:scheduleId')
  @WorkspaceAuth(Permission.REPORT_EXPORT)
  async deleteSchedule(
    @CurrentUser() _user: User,
    @WorkspaceId() workspaceId: string,
    @Param('scheduleId') scheduleId: string,
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
