import { DashboardController } from '@/modules/dashboard/dashboard.controller';

describe('DashboardController', () => {
  it('uses active workspace id from guard for dashboard data', async () => {
    const dashboardService = {
      getDashboard: jest.fn(async () => ({ ok: true })),
      getTrends: jest.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    const result = await controller.getDashboard(user, activeWorkspaceId, '30d');

    expect(result).toEqual({ ok: true });
    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      activeWorkspaceId,
      '30d',
      undefined,
    );
  });

  it('accepts range=month and passes it through unchanged', async () => {
    const dashboardService = {
      getDashboard: jest.fn(async () => ({ ok: true })),
      getTrends: jest.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    await controller.getDashboard(user, activeWorkspaceId, 'month' as any, '2026-03-01');

    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      activeWorkspaceId,
      'month',
      '2026-03-01',
    );
  });

  it('falls back to 30d for an unrecognized range value', async () => {
    const dashboardService = {
      getDashboard: jest.fn(async () => ({ ok: true })),
      getTrends: jest.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    await controller.getDashboard(user, activeWorkspaceId, 'bogus' as any);

    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      activeWorkspaceId,
      '30d',
      undefined,
    );
  });

  it('uses active workspace id from guard for dashboard trends', async () => {
    const dashboardService = {
      getDashboard: jest.fn(async () => ({ ok: true })),
      getTrends: jest.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    const result = await controller.getTrends(user, activeWorkspaceId, 30);

    expect(result).toEqual({ ok: true });
    expect(dashboardService.getTrends).toHaveBeenCalledWith(activeWorkspaceId, 30, undefined);
  });

  it('passes a picked month to trends and rejects a malformed one', async () => {
    const dashboardService = { getTrends: jest.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1' } as any;

    await controller.getTrends(user, 'active-workspace', 30, '2026-07');
    expect(dashboardService.getTrends).toHaveBeenCalledWith('active-workspace', 30, '2026-07');

    await expect(controller.getTrends(user, 'active-workspace', 30, 'July')).rejects.toThrow(
      'month must be YYYY-MM',
    );
  });

  it('defaults the health history to the current year and rejects absurd years', async () => {
    const dashboardService = { getHealthHistory: jest.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);

    await controller.getHealthHistory('active-workspace');
    expect(dashboardService.getHealthHistory).toHaveBeenCalledWith(
      'active-workspace',
      new Date().getFullYear(),
    );

    await controller.getHealthHistory('active-workspace', 2025);
    expect(dashboardService.getHealthHistory).toHaveBeenLastCalledWith('active-workspace', 2025);

    await expect(controller.getHealthHistory('active-workspace', 12)).rejects.toThrow(
      'year is out of range',
    );
  });

  it('defaults the monthly cash flow to 12 months for the active workspace', async () => {
    const dashboardService = { getMonthlyCashFlow: jest.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);

    await controller.getCashFlow('active-workspace', {});

    expect(dashboardService.getMonthlyCashFlow).toHaveBeenCalledWith(
      'active-workspace',
      '12m',
      undefined,
    );
  });

  it('passes an explicit cash flow range and picked month through', async () => {
    const dashboardService = { getMonthlyCashFlow: jest.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);

    await controller.getCashFlow('active-workspace', { range: 'all', month: '2025-07' });

    expect(dashboardService.getMonthlyCashFlow).toHaveBeenCalledWith(
      'active-workspace',
      'all',
      '2025-07',
    );
  });
});
