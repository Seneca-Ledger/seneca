import { EffectSchemaQueryPipe } from '@/common/effect/schema-query';
import { DashboardQuery, DashboardTrendsQuery } from '@/contracts/requests/dashboard';
import { DashboardController } from '@/modules/dashboard/dashboard.controller';

describe('DashboardController', () => {
  it('uses active workspace id from guard for dashboard data', async () => {
    const dashboardService = {
      getDashboard: vi.fn(async () => ({ ok: true })),
      getTrends: vi.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    const result = await controller.getDashboard(user, activeWorkspaceId, { range: '30d' });

    expect(result).toEqual({ ok: true });
    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      activeWorkspaceId,
      '30d',
      undefined,
      null,
    );
  });

  it('accepts range=month and passes it through unchanged', async () => {
    const dashboardService = {
      getDashboard: vi.fn(async () => ({ ok: true })),
      getTrends: vi.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    await controller.getDashboard(user, activeWorkspaceId, { range: 'month', date: '2026-03-01' });

    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      activeWorkspaceId,
      'month',
      '2026-03-01',
      null,
    );
  });

  it('defaults to 30d and refuses an unrecognized range value', async () => {
    const dashboardService = { getDashboard: vi.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const query = new EffectSchemaQueryPipe(DashboardQuery, 'query');

    await controller.getDashboard(user, 'active-workspace', query.transform({}));

    expect(dashboardService.getDashboard).toHaveBeenCalledWith(
      'user-1',
      'active-workspace',
      '30d',
      undefined,
      null,
    );
    expect(() => query.transform({ range: 'bogus' })).toThrow();
  });

  it('uses active workspace id from guard for dashboard trends', async () => {
    const dashboardService = {
      getDashboard: vi.fn(async () => ({ ok: true })),
      getTrends: vi.fn(async () => ({ ok: true })),
    };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1', workspaceId: 'default-workspace' } as any;
    const activeWorkspaceId = 'active-workspace';

    const result = await controller.getTrends(user, activeWorkspaceId, {});

    expect(result).toEqual({ ok: true });
    expect(dashboardService.getTrends).toHaveBeenCalledWith(activeWorkspaceId, 30, undefined, null);
  });

  it('passes a picked month to trends and rejects a malformed one', async () => {
    const dashboardService = { getTrends: vi.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);
    const user = { id: 'user-1' } as any;

    await controller.getTrends(user, 'active-workspace', { days: 30, month: '2026-07' });
    expect(dashboardService.getTrends).toHaveBeenCalledWith('active-workspace', 30, '2026-07', null);

    const query = new EffectSchemaQueryPipe(DashboardTrendsQuery, 'query');
    expect(() => query.transform({ month: 'July' })).toThrow();
  });

  it('defaults the monthly cash flow to 12 months for the active workspace', async () => {
    const dashboardService = { getMonthlyCashFlow: vi.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);

    await controller.getCashFlow('active-workspace', {});

    expect(dashboardService.getMonthlyCashFlow).toHaveBeenCalledWith(
      'active-workspace',
      '12m',
      undefined,
    );
  });

  it('passes an explicit cash flow range and picked month through', async () => {
    const dashboardService = { getMonthlyCashFlow: vi.fn(async () => ({ ok: true })) };
    const controller = new DashboardController(dashboardService as any);

    await controller.getCashFlow('active-workspace', { range: 'all', month: '2025-07' });

    expect(dashboardService.getMonthlyCashFlow).toHaveBeenCalledWith(
      'active-workspace',
      'all',
      '2025-07',
    );
  });
});
