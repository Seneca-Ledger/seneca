// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { setPrivacyMode, usePrivacyMode } from './privacy-mode';
import { PRIVACY_BOOT_SCRIPT, PRIVACY_STORAGE_KEY } from './privacy-mode-boot';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.privacy;
});

describe('privacy mode', () => {
  it('turns on for this device: stored, on <html>, and seen by the hook', () => {
    const { result } = renderHook(() => usePrivacyMode());
    expect(result.current).toBe(false);

    act(() => setPrivacyMode(true));

    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('on');
    expect(document.documentElement.dataset.privacy).toBe('on');
    expect(result.current).toBe(true);

    act(() => setPrivacyMode(false));

    expect(window.localStorage.getItem(PRIVACY_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.privacy).toBeUndefined();
    expect(result.current).toBe(false);
  });

  it('follows a switch made in another tab', () => {
    const { result } = renderHook(() => usePrivacyMode());

    act(() => {
      window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'on');
      window.dispatchEvent(new StorageEvent('storage', { key: PRIVACY_STORAGE_KEY }));
    });

    expect(result.current).toBe(true);
    expect(document.documentElement.dataset.privacy).toBe('on');
  });

  it('sets the attribute before paint from the stored choice', () => {
    window.localStorage.setItem(PRIVACY_STORAGE_KEY, 'on');

    // biome-ignore lint/security/noGlobalEval: the very string the layout inlines
    new Function(PRIVACY_BOOT_SCRIPT)();

    expect(document.documentElement.dataset.privacy).toBe('on');
  });
});
