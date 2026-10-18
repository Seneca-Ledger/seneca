// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The store lives for the page's lifetime, so each test loads a fresh copy.
const loadStore = () => import('./welcome-tutorial-store');

describe('welcome tutorial store', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('opens the welcome window and the guide separately, one at a time', async () => {
    const store = await loadStore();
    const { result } = renderHook(() => store.useWelcomeTutorialView());
    expect(result.current).toBeNull();

    act(() => store.openWelcome());
    expect(result.current).toBe('welcome');

    act(() => store.openGuide());
    expect(result.current).toBe('guide');

    act(() => store.closeWelcomeTutorial());
    expect(result.current).toBeNull();
  });

  it('keeps the Settings link’s name for the guide', async () => {
    const store = await loadStore();
    const { result } = renderHook(() => store.useWelcomeTutorialView());

    act(() => store.openWelcomeTutorial());
    expect(result.current).toBe('guide');
  });

  it('opens the guide on one page, and forgets the page when it closes', async () => {
    const store = await loadStore();
    const view = renderHook(() => store.useWelcomeTutorialView());
    const page = renderHook(() => store.useGuidePage());

    act(() => store.openGuidePage('budgets'));
    expect(view.result.current).toBe('guide');
    expect(page.result.current).toBe('budgets');

    act(() => store.closeWelcomeTutorial());
    expect(page.result.current).toBeNull();

    act(() => store.openGuide());
    expect(page.result.current).toBeNull();
  });

  it('allows one automatic opening per page load', async () => {
    const store = await loadStore();
    expect(store.claimAutoOpen()).toBe(true);
    expect(store.claimAutoOpen()).toBe(false);
  });
});
