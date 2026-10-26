'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CommandPalette from '@/app/components/command-palette/CommandPalette';
import { toggleCommandPalette } from '@/app/components/command-palette/command-palette-store';
import { useThemeToggle } from '@/app/components/navigation/hooks/useThemeToggle';
import { toggleSidebarCollapsed } from '@/app/components/navigation/sidebar-collapsed-store';
import { openAppPanel } from '@/app/components/panels/app-panels-store';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import {
  NAV_BINDINGS,
  NOTIFICATIONS_BINDING,
  SETTINGS_BINDING,
  SHORTCUT_EXPORT,
  SHORTCUT_FOCUS_SEARCH,
  SHORTCUT_OPEN_FILTERS,
  SHORTCUT_SHOW_SHORTCUTS,
} from '@/app/lib/keyboard-shortcuts';
import { openScanUpload } from '@/app/lib/statement-expense-drawer';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';
import { closeAllDrawers } from './ui/drawer-shell';

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const toggleTheme = useThemeToggle();
  const [helpOpen, setHelpOpen] = useState(false);

  // Built once: the hook registers bindings on mount and never re-reads the map.
  const bindings = useMemo(() => {
    // A jump lands on the page itself, not behind a drawer left open on top.
    const navigate = (href: string): void => {
      closeAllDrawers();
      router.push(href);
    };
    const map: Record<string, (event: KeyboardEvent) => void> = {
      '$mod+KeyK': event => {
        // Without this the browser's own Ctrl/⌘K (the omnibox) fires too.
        event.preventDefault();
        toggleCommandPalette();
      },
      'Shift+Slash': event => {
        event.preventDefault();
        setHelpOpen(true);
      },
      'Shift+KeyA': event => {
        event.preventDefault();
        openScanUpload(navigate);
      },
      [NOTIFICATIONS_BINDING]: event => {
        event.preventDefault();
        openAppPanel('notifications');
      },
      [SETTINGS_BINDING]: event => {
        // Also keeps the browser from acting on Ctrl/⌘ + comma.
        event.preventDefault();
        navigate('/settings/profile');
      },
      'Shift+KeyF': event => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(SHORTCUT_OPEN_FILTERS));
      },
      'Shift+KeyE': event => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(SHORTCUT_EXPORT));
      },
      Slash: event => {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(SHORTCUT_FOCUS_SEARCH));
      },
      BracketLeft: event => {
        event.preventDefault();
        toggleSidebarCollapsed();
      },
      'Alt+Shift+KeyT': event => {
        event.preventDefault();
        toggleTheme();
      },
    };
    for (const [path, binding] of Object.entries(NAV_BINDINGS)) {
      map[binding] = event => {
        event.preventDefault();
        navigate(path);
      };
    }
    return map;
  }, [router, toggleTheme]);

  useKeyboardShortcuts(bindings, true, { allowInEditable: ['$mod+KeyK'] });

  useEffect(() => {
    const show = (): void => setHelpOpen(true);
    window.addEventListener(SHORTCUT_SHOW_SHORTCUTS, show);
    return () => window.removeEventListener(SHORTCUT_SHOW_SHORTCUTS, show);
  }, []);

  return (
    <>
      {children}
      <CommandPalette onOpenHelp={() => setHelpOpen(true)} />
      <KeyboardShortcutsModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
