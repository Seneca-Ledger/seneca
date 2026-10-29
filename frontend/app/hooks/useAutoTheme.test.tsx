import type { ThemePreference } from '@/app/lib/theme-preference';
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoTheme } from './useAutoTheme';

const setThemeMock = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
  }),
}));

function Harness({ preference }: { preference: ThemePreference }) {
  useAutoTheme(preference);
  return null;
}

describe('useAutoTheme', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    setThemeMock.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
  });

  it('hands the system mode to next-themes', async () => {
    await act(async () => {
      root.render(<Harness preference="system" />);
    });

    expect(setThemeMock).toHaveBeenCalledWith('system');
  });

  it('applies manual theme immediately', async () => {
    await act(async () => {
      root.render(<Harness preference="dark" />);
    });

    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });
});
