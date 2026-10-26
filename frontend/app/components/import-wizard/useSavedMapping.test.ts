// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResponse } from '@/app/test/api-response';

const api = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('@/app/lib/api', () => ({ api, default: api }));

import { useSavedMapping } from './useSavedMapping';

const PROFILE_ID = '33333333-3333-4333-8333-333333333333';
const HEADERS = ['Date', 'Payee', 'Debit', 'Credit'];
const MAPPING = { date: 0, merchant: 1, amount: 2, credit: 3 };
const profile = { id: PROFILE_ID, target: 'transactions', mapping: MAPPING };

describe('useSavedMapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hands back the mapping remembered for the header row', async () => {
    api.post.mockResolvedValue(apiResponse({ profile }));
    const { result } = renderHook(() => useSavedMapping());

    let found: Record<string, number> | null = null;
    await act(async () => {
      found = await result.current.lookUp('transactions', HEADERS);
    });

    expect(found).toEqual(MAPPING);
    expect(result.current.savedId).toBe(PROFILE_ID);
    expect(api.post).toHaveBeenCalledWith('/entity-imports/mapping-profiles/match', {
      target: 'transactions',
      headers: HEADERS,
    });
  });

  it('maps by hand when nothing is remembered or the lookup fails', async () => {
    api.post.mockResolvedValueOnce(apiResponse({ profile: null }));
    api.post.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useSavedMapping());

    await act(async () => {
      expect(await result.current.lookUp('transactions', HEADERS)).toBeNull();
      expect(await result.current.lookUp('transactions', HEADERS)).toBeNull();
    });
    expect(result.current.savedId).toBeNull();
  });

  it('remembers a finished import and forgets it on request', async () => {
    api.put.mockResolvedValue(apiResponse(profile));
    api.delete.mockResolvedValue(apiResponse({ ok: true }));
    const { result } = renderHook(() => useSavedMapping());

    await act(async () => {
      await result.current.remember('transactions', HEADERS, MAPPING);
    });
    expect(api.put).toHaveBeenCalledWith('/entity-imports/mapping-profiles', {
      target: 'transactions',
      headers: HEADERS,
      mapping: MAPPING,
    });
    expect(result.current.savedId).toBe(PROFILE_ID);

    await act(async () => {
      await result.current.forget();
    });
    expect(api.delete).toHaveBeenCalledWith(`/entity-imports/mapping-profiles/${PROFILE_ID}`);
    expect(result.current.savedId).toBeNull();
  });
});
