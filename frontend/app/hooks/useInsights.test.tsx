import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiMocks.get,
    post: apiMocks.post,
  },
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ currentWorkspace: { id: 'workspace-1' } }),
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'de' }),
}));

import { createTestQueryClient, renderHookWithQuery } from '../test/query-wrapper';
import { type InsightSeverity, useInsights, useRefreshInsights } from './useInsights';
import { insightPage } from '@/app/test/fixtures/contracts';

function insight(id: string, severity: InsightSeverity) {
  return {
    id,
    type: 'trend.savings_rate',
    category: 'trend',
    severity,
    title: `title-${id}`,
    message: `message-${id}`,
    messageKey: 'trend.savings_rate_down',
    messageParams: { rate: 10, diff: 9 },
    data: null,
    createdAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('useInsights', () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.post.mockReset();
    apiMocks.post.mockResolvedValue({ data: {} });
  });

  it('keeps only the requested severities, so alerts and advice stay apart', async () => {
    apiMocks.get.mockResolvedValue({
      data: insightPage([insight('a', 'warn'), insight('b', 'info'), insight('c', 'critical')]),
    });

    const { result } = renderHookWithQuery(() => useInsights({ severities: ['warn', 'critical'] }));

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map(item => item.id)).toEqual(['a', 'c']);
  });

  it('asks for the feed in the interface language, not the profile one', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([]) });

    const { result } = renderHookWithQuery(() => useInsights({ severities: ['info'] }));

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(apiMocks.get).toHaveBeenCalledWith(
      '/insights',
      expect.objectContaining({ params: { limit: 50, locale: 'de' } }),
    );
  });

  it('serves both consumers of the shared feed from a single request', async () => {
    apiMocks.get.mockResolvedValue({
      data: insightPage([insight('a', 'warn'), insight('b', 'info')]),
    });
    const client = createTestQueryClient();

    const banner = renderHookWithQuery(() => useInsights({ severities: ['warn', 'critical'] }), {
      client,
    });
    const advice = renderHookWithQuery(() => useInsights({ severities: ['info'] }), { client });

    await waitFor(() => expect(banner.result.current.items).toHaveLength(1));
    await waitFor(() => expect(advice.result.current.items).toHaveLength(1));

    // Раньше AlertBanner и страница советов слали два одинаковых запроса.
    expect(apiMocks.get).toHaveBeenCalledTimes(1);
    expect(banner.result.current.items[0]?.id).toBe('a');
    expect(advice.result.current.items[0]?.id).toBe('b');
  });

  it('does not recompute insights when only reading them', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([]) });

    const { result } = renderHookWithQuery(() => useInsights({ severities: ['warn'] }));

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(apiMocks.post).not.toHaveBeenCalled();
  });

  it('recomputes on demand and then re-reads the feed', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([]) });
    const client = createTestQueryClient();

    const feed = renderHookWithQuery(() => useInsights({ severities: ['info'] }), { client });
    await waitFor(() => expect(feed.result.current.isPending).toBe(false));
    apiMocks.get.mockClear();

    const refresh = renderHookWithQuery(() => useRefreshInsights(), { client });
    refresh.result.current.mutate('de');

    await waitFor(() =>
      expect(apiMocks.post).toHaveBeenCalledWith('/insights/refresh', null, {
        params: { locale: 'de' },
      }),
    );
    await waitFor(() => expect(apiMocks.get).toHaveBeenCalled());
  });

  it('removes a dismissed insight from view before the server answers', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([insight('a', 'warn')]) });
    // POST висит: только так наблюдаемо промежуточное оптимистичное состояние.
    let settleDismiss!: () => void;
    apiMocks.post.mockImplementation(
      () =>
        new Promise(resolve => {
          settleDismiss = () => resolve({ data: {} });
        }),
    );

    const { result } = renderHookWithQuery(() => useInsights({ severities: ['warn'] }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    result.current.dismiss('a');

    await waitFor(() => expect(result.current.items).toEqual([]));
    expect(apiMocks.post).toHaveBeenCalledWith('/insights/a/dismiss');
    settleDismiss();
  });

  it('brings a dismissed insight back when the server rejects the dismissal', async () => {
    apiMocks.get.mockResolvedValue({ data: insightPage([insight('a', 'warn')]) });
    apiMocks.post.mockRejectedValue(new Error('nope'));

    const { result } = renderHookWithQuery(() => useInsights({ severities: ['warn'] }));
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    result.current.dismiss('a');

    // Откат снапшота плюс инвалидация: сервер не согласился — элемент возвращается.
    await waitFor(() => expect(apiMocks.post).toHaveBeenCalledWith('/insights/a/dismiss'));
    await waitFor(() => expect(result.current.items.map(i => i.id)).toEqual(['a']));
  });

  it('shows an empty feed rather than failing the page when the request errors', async () => {
    apiMocks.get.mockRejectedValue(new Error('boom'));

    const { result } = renderHookWithQuery(() => useInsights({ severities: ['warn'] }));

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});
