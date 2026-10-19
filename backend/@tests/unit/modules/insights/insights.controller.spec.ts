import { InsightsController } from '@/modules/insights/insights.controller';

describe('InsightsController', () => {
  it('forwards mandatory workspaceId from guard instead of query param', async () => {
    const insightsService = {
      list: jest.fn(async () => ({ items: [], total: 0, limit: 30, offset: 0 })),
      getSummary: jest.fn(async () => ({ total: 0, byCategory: {} })),
      refresh: jest.fn(async () => ({ created: 1, updated: 0, total: 1 })),
      dismissAll: jest.fn(async () => ({ updated: 3 })),
      dismiss: jest.fn(async () => ({ updated: 1 })),
    };
    const controller = new InsightsController(insightsService as any, {} as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.list(user, workspaceId, 'ops', '10', '5')).toEqual({
      items: [],
      total: 0,
      limit: 30,
      offset: 0,
    });
    expect(await controller.summary(user, workspaceId)).toEqual({ total: 0, byCategory: {} });
    expect(await controller.refresh(user, workspaceId)).toEqual({
      created: 1,
      updated: 0,
      total: 1,
    });
    expect(await controller.dismissAll(user, workspaceId, 'ops')).toEqual({ updated: 3 });
    expect(await controller.dismiss(user, workspaceId, 'i1')).toEqual({ updated: 1 });

    expect(insightsService.list).toHaveBeenCalledWith({
      userId: 'u1',
      workspaceId,
      category: 'ops',
      limit: 10,
      offset: 5,
      locale: undefined,
    });
    expect(insightsService.getSummary).toHaveBeenCalledWith('u1', workspaceId);
    expect(insightsService.refresh).toHaveBeenCalledWith('u1', workspaceId, { locale: undefined });
    expect(insightsService.dismissAll).toHaveBeenCalledWith('u1', workspaceId, 'ops');
    expect(insightsService.dismiss).toHaveBeenCalledWith('u1', workspaceId, 'i1');
  });

  it('picks the daily quote for the reader own calendar day', async () => {
    const dailyQuoteService = { forUser: jest.fn(async () => ({})) };
    const controller = new InsightsController({} as any, dailyQuoteService as any);

    await controller.dailyQuote({ id: 'user-1' } as any, 'ws-1', '2026-09-29');
    await controller.dailyQuote({ id: 'user-1' } as any, 'ws-1', 'not-a-date');

    expect(dailyQuoteService.forUser.mock.calls[0][2]).toEqual(new Date(2026, 8, 29, 12));
    expect(dailyQuoteService.forUser.mock.calls[1][2]).toBeInstanceOf(Date);
  });
});
