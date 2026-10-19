import { describe, expect, it, vi } from 'vitest';
import { createMemoryStore, enqueue, isNetworkFailure, type OfflineEntry, replay } from './offline-queue';

const entry = (id: string, createdAt: string): OfflineEntry => ({
  id,
  kind: 'manual-expense',
  createdAt,
  fields: { amount: '5' },
  files: [],
  attempts: 0,
});

describe('offline queue', () => {
  it('sends oldest first and drops what went through', async () => {
    const store = createMemoryStore([entry('b', '2026-10-01T10:00:00Z'), entry('a', '2026-10-01T09:00:00Z')]);
    const sent: string[] = [];
    const result = await replay(store, async item => {
      sent.push(item.id);
      return { ok: true };
    });
    expect(sent).toEqual(['a', 'b']);
    expect(result).toEqual({ sent: 2, kept: 0 });
    expect(await store.list()).toEqual([]);
  });

  it('keeps everything and stops at the first network failure, counting the attempt', async () => {
    const store = createMemoryStore([entry('a', '1'), entry('b', '2'), entry('c', '3')]);
    const send = vi.fn(async (item: OfflineEntry) =>
      item.id === 'b' ? { ok: false as const, status: undefined, error: 'Network Error' } : { ok: true as const },
    );
    const result = await replay(store, send);
    expect(result).toEqual({ sent: 1, kept: 2 });
    expect(send).toHaveBeenCalledTimes(2);
    const left = await store.list();
    expect(left.map(item => item.id).sort()).toEqual(['b', 'c']);
    expect(left.find(item => item.id === 'b')?.attempts).toBe(1);
  });

  it('drops an entry the server rejected, since it would only fail again', async () => {
    const store = createMemoryStore([entry('a', '1'), entry('b', '2')]);
    const result = await replay(store, async item =>
      item.id === 'a' ? { ok: false as const, status: 400, error: 'bad' } : { ok: true as const },
    );
    expect(result).toEqual({ sent: 1, kept: 0 });
    expect(await store.list()).toEqual([]);
  });

  it('enqueues with an id and a timestamp', async () => {
    const store = createMemoryStore();
    const saved = await enqueue(store, { kind: 'receipt-scan', fields: {}, files: [] });
    expect(saved.id).toBeTruthy();
    expect(saved.attempts).toBe(0);
    expect((await store.list())[0].kind).toBe('receipt-scan');
  });

  it('treats only a missing status as a network failure', () => {
    expect(isNetworkFailure(undefined)).toBe(true);
    expect(isNetworkFailure(0)).toBe(true);
    expect(isNetworkFailure(500)).toBe(false);
  });
});
