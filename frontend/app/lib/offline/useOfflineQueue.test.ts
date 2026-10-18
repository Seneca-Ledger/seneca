import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore, type OfflineEntry, replay } from './offline-queue';
import { sendOfflineEntry } from './useOfflineQueue';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/app/lib/api', () => ({ default: { post } }));

const entry: OfflineEntry = {
  id: 'e1',
  kind: 'manual-expense',
  createdAt: '2026-10-01T08:00:00.000Z',
  fields: { amount: '12' },
  files: [],
  attempts: 0,
};

const refusal = (code: string) => ({
  isAxiosError: true,
  response: { status: 403, data: { error: { code, message: 'refused' } } },
});

describe('sendOfflineEntry inside a past version', () => {
  it('keeps an entry a past version refused, for the live workspace', async () => {
    post.mockRejectedValue(refusal('VERSION_READ_ONLY'));
    const store = createMemoryStore([entry]);

    await replay(store, sendOfflineEntry);

    expect((await store.list()).map(e => e.id)).toEqual(['e1']);
  });

  it('still drops an entry the server rejected for good', async () => {
    post.mockRejectedValue(refusal('FORBIDDEN'));
    const store = createMemoryStore([entry]);

    await replay(store, sendOfflineEntry);

    expect(await store.list()).toEqual([]);
  });
});
