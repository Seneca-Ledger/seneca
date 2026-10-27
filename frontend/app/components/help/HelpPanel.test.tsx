// @vitest-environment jsdom
import type React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeAppPanel,
  openAppPanel,
  useAppPanelState,
} from '@/app/components/panels/app-panels-store';
import { useWelcomeTutorialView } from '@/app/components/welcome-tutorial/welcome-tutorial-store';
import { SHORTCUT_SHOW_SHORTCUTS } from '@/app/lib/keyboard-shortcuts';
import { HelpPanel } from './HelpPanel';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    help: {
      title: 'Help',
      documentation: 'Documentation',
      takeTour: 'Take a tour',
      keyboardShortcuts: 'Keyboard shortcuts',
    },
  }),
}));

vi.mock('@/app/components/ui/drawer-shell', () => ({
  DrawerShell: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div data-testid="drawer">{children}</div> : null,
}));

function Probe(): React.JSX.Element {
  const { panel } = useAppPanelState();
  const view = useWelcomeTutorialView();
  return <output data-panel={panel ?? ''} data-view={view ?? ''} />;
}

describe('HelpPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <>
          <HelpPanel />
          <Probe />
        </>,
      );
    });
  });

  afterEach(() => {
    act(() => {
      closeAppPanel();
      root.unmount();
    });
    container.remove();
  });

  it('stays closed until the help panel is opened', () => {
    expect(container.querySelector('[data-testid="drawer"]')).toBeNull();
    act(() => {
      openAppPanel('help');
    });
    expect(container.querySelector('[data-testid="drawer"]')).not.toBeNull();
  });

  it('links to the documentation in a new tab', () => {
    act(() => {
      openAppPanel('help');
    });
    const link = container.querySelector('a');
    expect(link?.textContent).toContain('Documentation');
    expect(link?.getAttribute('href')).toBe(
      'https://stoic-budget.github.io/stoic-budget/docs/getting-started/configuration',
    );
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('closes itself and opens the guide on "Take a tour"', () => {
    act(() => {
      openAppPanel('help');
    });
    const button = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Take a tour'),
    );
    act(() => {
      button?.click();
    });
    const probe = container.querySelector('output');
    expect(probe?.dataset.panel).toBe('');
    expect(probe?.dataset.view).toBe('guide');
  });

  it('closes itself and asks for the shortcuts modal on "Keyboard shortcuts"', () => {
    const heard = vi.fn();
    window.addEventListener(SHORTCUT_SHOW_SHORTCUTS, heard);
    act(() => {
      openAppPanel('help');
    });
    const button = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Keyboard shortcuts'),
    );
    act(() => {
      button?.click();
    });
    window.removeEventListener(SHORTCUT_SHOW_SHORTCUTS, heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(container.querySelector('output')?.dataset.panel).toBe('');
  });
});
