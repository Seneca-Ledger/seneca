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
  | 'deleteSelected'
  | 'previousMonth'
  | 'nextMonth'
  | 'clearSelection'
  | 'selectByCategory'
  | 'selectDuplicates'
  | 'setCategory'
  | 'createTable'
  | 'addToTable'
  | 'markDuplicate'
  | 'mergeDuplicates'
  | 'dismissDuplicates'
  | 'selectionActions';

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
/** Opens the shortcuts modal from outside the provider that owns it (the Help panel). */
export const SHORTCUT_SHOW_SHORTCUTS = 'shortcuts:show-shortcuts';
export const SHORTCUT_PREVIOUS_MONTH = 'shortcuts:previous-month';
export const SHORTCUT_NEXT_MONTH = 'shortcuts:next-month';

// Bindings shared by the global handler and the palette's hint chips
export const NOTIFICATIONS_BINDING = 'Shift+KeyN';
export const SETTINGS_BINDING = '$mod+Comma';
export const PREVIOUS_MONTH_BINDING = 'ArrowLeft';
export const NEXT_MONTH_BINDING = 'ArrowRight';

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
  '/review': 'KeyG KeyV',
  '/accounts': 'KeyG KeyM',
  '/custom-tables': 'KeyG KeyT',
  '/reports': 'KeyG KeyR',
  '/workspaces': 'KeyG KeyW',
  '/budgets': 'KeyG KeyB',
  '/advice': 'KeyG KeyA',
  '/goals': 'KeyG KeyG',
  '/invoices': 'KeyG KeyI',
  '/net-worth': 'KeyG KeyN',
  '/crypto': 'KeyG KeyC',
  '/tax-declaration': 'KeyG KeyX',
  '/forecast': 'KeyG KeyF',
  '/roi': 'KeyG KeyE',
  '/subscriptions': 'KeyG KeyU',
  '/integrations': 'KeyG KeyK',
  '/plugins': 'KeyG KeyP',
  '/admin': 'KeyG KeyL',
};

export const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  { binding: '$mod+KeyK', labelKey: 'openPalette', category: 'action' },
  { binding: 'Shift+Slash', labelKey: 'showShortcuts', category: 'action' },
  { binding: 'Shift+KeyA', labelKey: 'openUpload', category: 'action' },
  { binding: 'BracketLeft', labelKey: 'toggleLeftNav', category: 'action' },
  { binding: 'Alt+Shift+KeyT', labelKey: 'toggleTheme', category: 'action' },
];

/**
 * The Documents list's selection: pick rows, then act on them. Chords group the
 * family — S… selects, T… sends to a table — and Shift acts on what is selected.
 */
export const DOCUMENT_BINDINGS = {
  selectAll: '$mod+KeyA',
  // Gmail's "More actions" key: opens the menu of everything the selection can do.
  selectionActions: 'Period',
  clearSelection: 'Escape',
  selectByCategory: 'KeyS KeyC',
  selectDuplicates: 'KeyS KeyD',
  setCategory: 'Shift+KeyC',
  createTable: 'KeyT KeyN',
  addToTable: 'KeyT KeyA',
  export: 'Shift+KeyE',
  markDuplicate: 'Shift+KeyD',
  mergeDuplicates: 'Shift+KeyM',
  deleteSelected: 'Shift+Delete',
} as const satisfies Partial<Record<ShortcutLabelKey, string>>;

/** Only the Documents list listens for these, so they live in its group. */
export const STATEMENTS_SHORTCUTS: ShortcutEntry[] = [
  { binding: 'Shift+KeyF', labelKey: 'openFilters', category: 'action' },
  { binding: 'Slash', labelKey: 'focusSearch', category: 'action' },
  ...Object.entries(DOCUMENT_BINDINGS).map(([labelKey, binding]) => ({
    binding,
    labelKey: labelKey as keyof typeof DOCUMENT_BINDINGS,
    category: 'action' as const,
  })),
];

/** The dashboard's month strip listens for these; arrows elsewhere keep scrolling. */
export const DASHBOARD_SHORTCUTS: ShortcutEntry[] = [
  { binding: PREVIOUS_MONTH_BINDING, labelKey: 'previousMonth', category: 'action' },
  { binding: NEXT_MONTH_BINDING, labelKey: 'nextMonth', category: 'action' },
];
