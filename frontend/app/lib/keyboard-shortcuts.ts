import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';

export type ShortcutCategory = 'navigation' | 'action';

/** Key into the `keyboardShortcutsModal` dictionary's `labels`. */
export type ShortcutLabelKey =
  | 'openPalette'
  | 'showShortcuts'
  | 'openUpload'
  | 'openFilters'
  | 'export'
  | 'focusSearch'
  | 'toggleLeftNav'
  | 'toggleTheme'
  | 'selectAll'
  | 'deleteSelected';

export type ShortcutEntry = {
  /** tinykeys syntax — the same string drives the handler and the hint chips. */
  binding: string;
  labelKey: ShortcutLabelKey;
  category: ShortcutCategory;
};

// Event names for page-level shortcut listeners
export const SHORTCUT_OPEN_FILTERS = 'shortcuts:open-filters';
export const SHORTCUT_EXPORT = 'shortcuts:export';
export const SHORTCUT_FOCUS_SEARCH = 'shortcuts:focus-search';
export const SHORTCUT_SELECT_ALL = 'shortcuts:select-all';
export const SHORTCUT_DELETE_SELECTED = 'shortcuts:delete-selected';

/**
 * Bindings name physical keys (`KeyG`, `Slash`) rather than characters. tinykeys
 * matches a character spec against `event.key`, which is the wrong thing twice
 * over: Shift turns `/` into `?`, and a Cyrillic layout turns `a` into `ф`, so
 * every letter shortcut dies the moment the layout is not US English.
 *
 * Navigation lives on `G` chords rather than its own label keys: the route is
 * the key, and the visible name comes from the `navigation` dictionary that the
 * sidebar already translates. Routes missing here simply have no shortcut.
 */
export const NAV_BINDINGS: Record<string, string> = {
  [DEFAULT_APP_ROUTE]: 'KeyG KeyD',
  '/statements': 'KeyG KeyS',
  '/custom-tables': 'KeyG KeyT',
  '/reports': 'KeyG KeyR',
  '/workspaces': 'KeyG KeyW',
  '/budgets': 'KeyG KeyB',
  '/advice': 'KeyG KeyA',
  '/goals': 'KeyG KeyG',
  '/invoices': 'KeyG KeyI',
  '/net-worth': 'KeyG KeyN',
  '/crypto': 'KeyG KeyC',
};

export const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  { binding: '$mod+KeyK', labelKey: 'openPalette', category: 'action' },
  { binding: 'Shift+Slash', labelKey: 'showShortcuts', category: 'action' },
  { binding: 'Shift+KeyA', labelKey: 'openUpload', category: 'action' },
  { binding: 'Shift+KeyF', labelKey: 'openFilters', category: 'action' },
  { binding: 'Shift+KeyE', labelKey: 'export', category: 'action' },
  { binding: 'Slash', labelKey: 'focusSearch', category: 'action' },
  { binding: 'BracketLeft', labelKey: 'toggleLeftNav', category: 'action' },
  { binding: 'Alt+Shift+KeyT', labelKey: 'toggleTheme', category: 'action' },
];

export const STATEMENTS_SHORTCUTS: ShortcutEntry[] = [
  { binding: 'Shift+KeyX', labelKey: 'selectAll', category: 'action' },
  { binding: 'Shift+Delete', labelKey: 'deleteSelected', category: 'action' },
];
