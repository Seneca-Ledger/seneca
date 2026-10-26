// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { setNetWorthDisplay, useNetWorthDisplay } from './net-worth-display';

const KEY = 'seneca:net-worth-display';

describe('net worth display preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows neither the zero baseline nor the all-time high until asked', () => {
    const { result } = renderHook(() => useNetWorthDisplay());

    // The high in particular: people asked loudly not to be shown it by default.
    expect(result.current).toEqual({ zeroBaseline: false, allTimeHigh: false });
  });

  it('remembers a choice and tells the page about it', () => {
    const { result } = renderHook(() => useNetWorthDisplay());

    act(() => setNetWorthDisplay({ allTimeHigh: true }));

    expect(result.current).toEqual({ zeroBaseline: false, allTimeHigh: true });
    expect(window.localStorage.getItem(KEY)).toContain('"allTimeHigh":true');
  });

  it('reads back what a previous visit stored', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ zeroBaseline: true, allTimeHigh: false }));

    const { result } = renderHook(() => useNetWorthDisplay());

    expect(result.current.zeroBaseline).toBe(true);
  });

  it('falls back to the defaults when the key holds nonsense', () => {
    window.localStorage.setItem(KEY, 'not json');

    const { result } = renderHook(() => useNetWorthDisplay());

    expect(result.current).toEqual({ zeroBaseline: false, allTimeHigh: false });
  });
});
