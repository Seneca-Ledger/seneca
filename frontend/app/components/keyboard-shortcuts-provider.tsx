'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useMemo, useState } from 'react';
import CommandPalette from '@/app/components/command-palette/CommandPalette';
import { toggleCommandPalette } from '@/app/components/command-palette/command-palette-store';
import { toggleSidebarCollapsed } from '@/app/components/navigation/sidebar-collapsed-store';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import {
  NAV_BINDINGS,
  SHORTCUT_EXPORT,
  SHORTCUT_FOCUS_SEARCH,
  SHORTCUT_OPEN_FILTERS,
} from '@/app/lib/keyboard-shortcuts';
import { STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT } from '@/app/lib/statement-expense-drawer';
import { KeyboardShortcutsModal } from './keyboard-shortcuts-modal';

export function KeyboardShortcutsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);

  // Built once: the hook registers bindings on mount and never re-reads the map.
  const bindings = useMemo(() => {
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
        window.dispatchEvent(
          new CustomEvent(STATEMENTS_OPEN_EXPENSE_DRAWER_EVENT, { detail: { mode: 'scan' } }),
        );
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
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      },
    };
    for (const [path, binding] of Object.entries(NAV_BINDINGS)) {
      map[binding] = event => {
        event.preventDefault();
        router.push(path);
      };
    }
    return map;
  }, [router, resolvedTheme, setTheme]);

  useKeyboardShortcuts(bindings, true, { allowInEditable: ['$mod+KeyK'] });

  return (
    <>
      {children}
      <CommandPalette onOpenHelp={() => setHelpOpen(true)} />
      <KeyboardShortcutsModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}
