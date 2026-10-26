import { PassThrough } from 'stream';
import { ExportFormat } from '@/modules/reports/dto/export-report.dto';
import { WorkspaceExportFormat } from '@/modules/reports/dto/workspace-export.dto';
import { ReportsController } from '@/modules/reports/reports.controller';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    createReadStream: vi.fn(),
    unlinkSync: vi.fn(),
  };
});

describe('ReportsController', () => {
  it('getDailyReport resolves latest when date=latest', async () => {
    const reportsService = {
      getStatementsSummary: vi.fn(),
      getCustomTablesSummary: vi.fn(),
      getLatestTransactionDate: vi.fn(async () => '2025-01-02'),
      generateDailyReport: vi.fn(async () => ({ day: 'ok' })),
      getLatestTransactionPeriod: vi.fn(async () => ({
        year: 2025,
        month: 1,
      })),
      generateMonthlyReport: vi.fn(),
      generateCustomReport: vi.fn(),
      exportReport: vi.fn(),
    };
    const controller = new ReportsController(reportsService as any);
    const workspaceId = 'ws-1';

    const result = await controller.getDailyReport({ id: 'u1' } as any, workspaceId, {
      date: 'latest',
    });

    expect(result).toEqual({ day: 'ok' });
    expect(reportsService.generateDailyReport).toHaveBeenCalledWith(workspaceId, '2025-01-02', null);
  });

  it('exportReport sets headers and schedules cleanup', async () => {
    const fs = await import('fs');
    const stream = new PassThrough();
    (fs.createReadStream as any).mockReturnValue(stream);

    const reportsService = {
      getStatementsSummary: vi.fn(),
      getCustomTablesSummary: vi.fn(),
      getLatestTransactionDate: vi.fn(),
      generateDailyReport: vi.fn(async () => ({ day: 'ok' })),
      getLatestTransactionPeriod: vi.fn(async () => ({
        year: 2025,
        month: 1,
      })),
      generateMonthlyReport: vi.fn(),
      generateCustomReport: vi.fn(async () => ({ ok: true })),
      exportReport: vi.fn(async () => ({
        filePath: '/tmp/report.csv',
        fileName: 'r.csv',
      })),
    };
    const res = new PassThrough() as any;
    res.setHeader = vi.fn();
    const controller = new ReportsController(reportsService as any);
    const workspaceId = 'ws-1';

    await controller.exportReport(
      { id: 'u1' } as any,
      workspaceId,
      { format: ExportFormat.CSV } as any,
      res,
    );

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/report.csv');

    stream.emit('end');
    expect(fs.unlinkSync as any).toHaveBeenCalledWith('/tmp/report.csv');
  });

  it('generateReport passes workspace and user ids, and keeps the file', async () => {
    const fs = await import('fs');
    const stream = new PassThrough();
    (fs.createReadStream as any).mockReturnValue(stream);
    (fs.unlinkSync as any).mockClear();

    const reportsService = {
      generateFromTemplate: vi.fn(async () => ({
        filePath: '/uploads/reports/pnl.xlsx',
        fileName: 'pnl.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })),
    };
    const res = new PassThrough() as any;
    res.setHeader = vi.fn();
    const controller = new ReportsController(reportsService as any);
    const dto = {
      templateId: 'pnl',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31',
      format: 'excel',
    } as any;

    await controller.generateReport({ id: 'u1' } as any, 'ws-1', dto, res);

    // The service resolves data by workspace and stamps history rows with the user.
    expect(reportsService.generateFromTemplate).toHaveBeenCalledWith('ws-1', 'u1', dto);

    // The file backs a History row, so it must survive the response stream.
    stream.emit('end');
    expect(fs.unlinkSync as any).not.toHaveBeenCalled();
  });

  it('getHistory is scoped by workspace, not by user', async () => {
    const reportsService = { getReportHistory: vi.fn(async () => []) };
    const controller = new ReportsController(reportsService as any);

    await controller.getHistory({ id: 'u1' } as any, 'ws-1');

    expect(reportsService.getReportHistory).toHaveBeenCalledWith('ws-1');
  });

  it('downloadHistoryReport streams stored report file', async () => {
    const fs = await import('fs');
    const stream = new PassThrough();
    (fs.createReadStream as any).mockReturnValue(stream);

    const reportsService = {
      getStatementsSummary: vi.fn(),
      getCustomTablesSummary: vi.fn(),
      getLatestTransactionDate: vi.fn(),
      generateDailyReport: vi.fn(),
      getLatestTransactionPeriod: vi.fn(),
      generateMonthlyReport: vi.fn(),
      generateCustomReport: vi.fn(),
      exportReport: vi.fn(),
      downloadHistoryReport: vi.fn(async () => ({
        filePath: '/tmp/history.xlsx',
        fileName: 'history.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })),
    };
    const res = new PassThrough() as any;
    res.setHeader = vi.fn();
    const controller = new ReportsController(reportsService as any);
    const workspaceId = 'ws-1';

    await (controller as any).downloadHistoryReport(
      { id: 'u1' } as any,
      workspaceId,
      { reportId: 'report-1' },
      res,
    );

    expect(reportsService.downloadHistoryReport).toHaveBeenCalledWith(workspaceId, 'report-1');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/history.xlsx');

    stream.emit('end');
    expect(fs.unlinkSync as any).not.toHaveBeenCalledWith('/tmp/history.xlsx');
  });

  it('exportWorkspaceTransactions streams generated workspace export file', async () => {
    const fs = await import('fs');
    const stream = new PassThrough();
    (fs.createReadStream as any).mockReturnValue(stream);

    const reportsService = {
      getStatementsSummary: vi.fn(),
      getCustomTablesSummary: vi.fn(),
      getLatestTransactionDate: vi.fn(),
      generateDailyReport: vi.fn(),
      getLatestTransactionPeriod: vi.fn(),
      generateMonthlyReport: vi.fn(),
      generateCustomReport: vi.fn(),
      exportReport: vi.fn(),
      exportWorkspaceTransactions: vi.fn(async () => ({
        filePath: '/tmp/workspace.docx',
        fileName: 'workspace.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })),
    };
    const res = new PassThrough() as any;
    res.setHeader = vi.fn();
    const controller = new ReportsController(reportsService as any);

    await (controller as any).exportWorkspaceTransactions(
      'ws-1',
      { format: WorkspaceExportFormat.DOCX },
      res,
    );

    expect(reportsService.exportWorkspaceTransactions).toHaveBeenCalledWith(
      'ws-1',
      WorkspaceExportFormat.DOCX,
      null,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(fs.createReadStream).toHaveBeenCalledWith('/tmp/workspace.docx');

    stream.emit('end');
    expect(fs.unlinkSync as any).toHaveBeenCalledWith('/tmp/workspace.docx');
  });

  it('exportWorkspaceTransactions cleans up temp file on stream error', async () => {
    const fs = await import('fs');
    const stream = new PassThrough();
    (fs.createReadStream as any).mockReturnValue(stream);

    const reportsService = {
      exportWorkspaceTransactions: vi.fn(async () => ({
        filePath: '/tmp/workspace.xlsx',
        fileName: 'workspace.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })),
    };
    const res = new PassThrough() as any;
    res.setHeader = vi.fn();
    const controller = new ReportsController(reportsService as any);

    await (controller as any).exportWorkspaceTransactions(
      'ws-1',
      { format: WorkspaceExportFormat.EXCEL },
      res,
    );

    stream.emit('error', new Error('stream failed'));

    expect(fs.unlinkSync as any).toHaveBeenCalledWith('/tmp/workspace.xlsx');
  });

  it('getTopCategories delegates to reports service', async () => {
    const reportsService = {
      getStatementsSummary: vi.fn(),
      getCustomTablesSummary: vi.fn(),
      getLatestTransactionDate: vi.fn(),
      generateDailyReport: vi.fn(),
      getLatestTransactionPeriod: vi.fn(),
      generateMonthlyReport: vi.fn(),
      generateCustomReport: vi.fn(),
      exportReport: vi.fn(),
      getTopCategoriesReport: vi.fn(async () => ({ categories: [] })),
    };
    const controller = new ReportsController(reportsService as any);
    const workspaceId = 'ws-1';

    const result = await controller.getTopCategories(
      { id: 'u-1' } as any,
      workspaceId,
      { limit: 5, type: 'expense' } as any,
      'member-self',
    );

    expect(result).toEqual({ categories: [] });
    expect(reportsService.getTopCategoriesReport).toHaveBeenCalledWith(
      workspaceId,
      { limit: 5, type: 'expense' },
      'member-self',
    );
  });

  it('getSpendOverTime delegates to reports service', async () => {
    const reportsService = {
      getStatementsSummary: vi.fn(),
      getCustomTablesSummary: vi.fn(),
      getLatestTransactionDate: vi.fn(),
      generateDailyReport: vi.fn(),
      getLatestTransactionPeriod: vi.fn(),
      generateMonthlyReport: vi.fn(),
      generateCustomReport: vi.fn(),
      exportReport: vi.fn(),
      getTopCategoriesReport: vi.fn(),
      getSpendOverTimeReport: vi.fn(async () => ({ points: [] })),
    };
    const controller = new ReportsController(reportsService as any);
    const workspaceId = 'ws-1';

    const result = await (controller as any).getSpendOverTimeReport(
      { id: 'u-9' } as any,
      workspaceId,
      {
        groupBy: 'day',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-03',
      },
      'member-self',
    );

    expect(result).toEqual({ points: [] });
    expect(reportsService.getSpendOverTimeReport).toHaveBeenCalledWith(
      workspaceId,
      {
        groupBy: 'day',
        dateFrom: '2025-01-01',
        dateTo: '2025-01-03',
      },
      'member-self',
    );
  });

  it('getCustomTablesReport delegates to reports service', async () => {
    const reportsService = {
      getCustomTablesReport: vi.fn(async () => ({ aggregatedRows: [] })),
    };
    const controller = new ReportsController(reportsService as any);

    const result = await (controller as any).getCustomTablesReport(
      { id: 'u-1' } as any,
      'ws-1',
      { days: 30, flowType: 'expense' },
    );

    expect(result).toEqual({ aggregatedRows: [] });
    expect(reportsService.getCustomTablesReport).toHaveBeenCalledWith('ws-1', {
      days: 30,
      flowType: 'expense',
    });
  });

  it('getCustomTablesReportDrillDown delegates to reports service', async () => {
    const reportsService = {
      getCustomTablesReportDrillDown: vi.fn(async () => ({ items: [] })),
    };
    const controller = new ReportsController(reportsService as any);

    const result = await (controller as any).getCustomTablesReportDrillDown(
      { id: 'u-1' } as any,
      'ws-1',
      { counterparty: 'Vendor A' },
    );

    expect(result).toEqual({ items: [] });
    expect(reportsService.getCustomTablesReportDrillDown).toHaveBeenCalledWith('ws-1', {
      counterparty: 'Vendor A',
    });
  });

  it('getAvailableCustomTables delegates to reports service', async () => {
    const reportsService = {
      getAvailableCustomTables: vi.fn(async () => [{ id: 'table-1' }]),
    };
    const controller = new ReportsController(reportsService as any);

    const result = await (controller as any).getAvailableCustomTables(
      { id: 'u-1' } as any,
      'ws-1',
    );

    expect(result).toEqual([{ id: 'table-1' }]);
    expect(reportsService.getAvailableCustomTables).toHaveBeenCalledWith('ws-1');
  });
});
