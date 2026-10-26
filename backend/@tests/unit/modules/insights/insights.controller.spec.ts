import { BadRequestException } from '@nestjs/common';
import { EffectSchemaQueryPipe } from '@/common/effect/schema-query';
import { DailyQuoteQuery, InsightsQuery } from '@/contracts/requests/insights';
import { InsightsController } from '@/modules/insights/insights.controller';

describe('InsightsController', () => {
  it('forwards mandatory workspaceId from guard instead of query param', async () => {
    const insightsService = {
      list: vi.fn(async () => ({ items: [], total: 0, limit: 30, offset: 0 })),
      getSummary: vi.fn(async () => ({ total: 0, byCategory: {} })),
      refresh: vi.fn(async () => ({ created: 1, updated: 0, total: 1 })),
      dismissAll: vi.fn(async () => ({ updated: 3 })),
      dismiss: vi.fn(async () => ({ updated: 1 })),
    };
    const controller = new InsightsController(insightsService as any, {} as any);
    const user = { id: 'u1' } as any;
    const workspaceId = 'ws-1';

    expect(await controller.list(user, workspaceId, { category: 'anomaly', limit: 10, offset: 5 })).toEqual({
      items: [],
      total: 0,
      limit: 30,
      offset: 0,
    });
    expect(await controller.summary(user, workspaceId)).toEqual({ total: 0, byCategory: {} });
    expect(await controller.refresh(user, workspaceId, {})).toEqual({
      created: 1,
      updated: 0,
      total: 1,
    });
    expect(await controller.dismissAll(user, workspaceId, { category: 'anomaly' })).toEqual({ updated: 3 });
    expect(await controller.dismiss(user, workspaceId, { id: 'i1' })).toEqual({ updated: 1 });

    expect(insightsService.list).toHaveBeenCalledWith({
      userId: 'u1',
      workspaceId,
      category: 'anomaly',
      limit: 10,
      offset: 5,
      locale: undefined,
    });
    expect(insightsService.getSummary).toHaveBeenCalledWith('u1', workspaceId);
    expect(insightsService.refresh).toHaveBeenCalledWith('u1', workspaceId, { locale: undefined });
    expect(insightsService.dismissAll).toHaveBeenCalledWith('u1', workspaceId, 'anomaly');
    expect(insightsService.dismiss).toHaveBeenCalledWith('u1', workspaceId, 'i1');
  });

  it('picks the daily quote for the reader own calendar day', async () => {
    const dailyQuoteService = { forUser: vi.fn(async () => ({})) };
    const controller = new InsightsController({} as any, dailyQuoteService as any);

    await controller.dailyQuote({ id: 'user-1' } as any, 'ws-1', { date: '2026-09-29' });
    await controller.dailyQuote({ id: 'user-1' } as any, 'ws-1', {});

    expect(dailyQuoteService.forUser.mock.calls[0][2]).toEqual(new Date(2026, 8, 29, 12));
    expect(dailyQuoteService.forUser.mock.calls[1][2]).toBeInstanceOf(Date);
  });

  it('answers 400 for a day or a category that does not exist', () => {
    const quote = new EffectSchemaQueryPipe(DailyQuoteQuery, 'query');
    const list = new EffectSchemaQueryPipe(InsightsQuery, 'query');

    expect(quote.transform({ date: '2026-09-29', locale: 'de' })).toEqual({
      date: '2026-09-29',
      locale: 'de',
    });
    expect(() => quote.transform({ date: 'not-a-date' })).toThrow(BadRequestException);
    expect(list.transform({ limit: '50', locale: 'en' })).toEqual({ limit: 50, locale: 'en' });
    expect(() => list.transform({ category: 'ops' })).toThrow(BadRequestException);
  });
});
