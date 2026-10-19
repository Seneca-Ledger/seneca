/**
 * Settings state that lives in the URL (`?tab=security&section=sessions`) so a
 * reload or a shared link restores the same view. Pure helpers, no React.
 */

export const SETTINGS_TABS = [
  'general',
  'security',
  'notifications',
  'data',
  'advanced',
  'versions',
] as const;
export type SettingsTabId = (typeof SETTINGS_TABS)[number];
export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'general';

/** Accordion panels per tab, in display order. */
export const SETTINGS_SECTIONS = {
  general: ['profile', 'appearance'],
  security: ['email', 'password', 'two-factor', 'sessions'],
  notifications: ['telegram', 'push'],
  data: [
    'workspace-profile',
    'processing',
    'exchange-rates',
    'receipt-location',
    'sync',
    'my-data',
  ],
  advanced: ['changelog'],
  versions: ['versions'],
} as const satisfies Record<SettingsTabId, readonly string[]>;
export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[SettingsTabId][number];

export const SETTINGS_PATH = '/settings/profile';

/** Panel to open on load: the deep-linked one, otherwise the first on the tab. */
export function resolveOpenSection(
  tab: SettingsTabId,
  section: SettingsSectionId | null,
): SettingsSectionId {
  return section ?? SETTINGS_SECTIONS[tab][0];
}

export function parseSettingsTab(value: string | null | undefined): SettingsTabId {
  return (SETTINGS_TABS as readonly string[]).includes(value ?? '')
    ? (value as SettingsTabId)
    : DEFAULT_SETTINGS_TAB;
}

/** A section is only meaningful on its own tab; anything else is `null`. */
export function parseSettingsSection(
  tab: SettingsTabId,
  value: string | null | undefined,
): SettingsSectionId | null {
  const allowed = SETTINGS_SECTIONS[tab] as readonly string[];
  return value && allowed.includes(value) ? (value as SettingsSectionId) : null;
}

/** Applies a patch to the current query; `null` removes a key. Returns the query string without `?`. */
export function withSettingsParams(
  current: URLSearchParams | string,
  patch: { tab?: string | null; section?: string | null },
): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next.toString();
}

/** Full href for a tab; the default tab is left implicit so `/settings/profile` stays canonical. */
export function buildSettingsHref(tab: SettingsTabId, section?: SettingsSectionId | null): string {
  const query = withSettingsParams('', {
    tab: tab === DEFAULT_SETTINGS_TAB ? null : tab,
    section: section ?? null,
  });
  return query ? `${SETTINGS_PATH}?${query}` : SETTINGS_PATH;
}

/**
 * Old `#<id>` anchors from the sidebar era, plus `telegram` for the page that
 * was folded in. Kept so bookmarks and in-app links keep landing on the right panel.
 */
export const LEGACY_HASH_TARGETS: Record<
  string,
  { tab: SettingsTabId; section?: SettingsSectionId }
> = {
  profile: { tab: 'general' },
  appearance: { tab: 'general', section: 'appearance' },
  email: { tab: 'security', section: 'email' },
  password: { tab: 'security', section: 'password' },
  security: { tab: 'security', section: 'two-factor' },
  sessions: { tab: 'security', section: 'sessions' },
  notifications: { tab: 'notifications' },
  telegram: { tab: 'notifications', section: 'telegram' },
  processing: { tab: 'data', section: 'processing' },
  sync: { tab: 'data', section: 'sync' },
  'my-data': { tab: 'data', section: 'my-data' },
  changelog: { tab: 'advanced', section: 'changelog' },
  experimental: { tab: 'advanced' },
};
