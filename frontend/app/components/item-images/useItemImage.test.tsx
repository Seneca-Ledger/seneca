// @vitest-environment jsdom
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHookWithQuery } from '@/app/test/query-wrapper';
import { useItemVisual } from './useItemImage';

const { apiQueryDecoded } = vi.hoisted(() => ({ apiQueryDecoded: vi.fn() }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'workspace-1' }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded, checkContract: vi.fn() }));

const FIRST = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';

describe('useItemVisual', () => {
  beforeEach(() => apiQueryDecoded.mockReset());

  it('asks once for every row that renders together', async () => {
    const image = { subjectId: FIRST, url: '/uploads/item-images/a.png', label: 'Example Mini' };
    const vendor = { subjectId: SECOND, name: 'Example Stream', domain: 'example.com' };
    apiQueryDecoded.mockResolvedValue({
      images: [image],
      vendors: [vendor],
      kinds: [{ subjectId: SECOND, kind: 'desktop' }],
    });

    const { result } = renderHookWithQuery(() => [
      useItemVisual('transaction', FIRST),
      useItemVisual('transaction', SECOND),
    ]);

    await waitFor(() => expect(result.current[1].isSuccess).toBe(true));
    expect(apiQueryDecoded).toHaveBeenCalledTimes(1);
    expect(apiQueryDecoded.mock.calls[0][0]).toMatchObject({
      url: '/item-images/transactions',
      params: { ids: `${FIRST},${SECOND}` },
    });
    expect(result.current[0].data).toEqual({ image, vendor: null, kind: null });
    expect(result.current[1].data).toEqual({ image: null, vendor, kind: 'desktop' });
  });
});
