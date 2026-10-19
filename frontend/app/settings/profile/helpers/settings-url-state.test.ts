import { describe, expect, it } from 'vitest';
import {
  LEGACY_HASH_TARGETS,
  SETTINGS_SECTIONS,
  buildSettingsHref,
  parseSettingsSection,
  parseSettingsTab,
  withSettingsParams,
} from './settings-url-state';

const LEGACY_SECTION_IDS = [
  'profile',
  'appearance',
  'sessions',
  'email',
  'password',
  'security',
  'processing',
  'notifications',
  'changelog',
  'sync',
  'my-data',
  'experimental',
  'telegram',
];

describe('settings-url-state', () => {
  it('falls back to general for unknown tabs', () => {
    expect(parseSettingsTab('security')).toBe('security');
    expect(parseSettingsTab('advanced')).toBe('advanced');
    expect(parseSettingsTab('nope')).toBe('general');
    expect(parseSettingsTab(null)).toBe('general');
  });

  it('only accepts sections that belong to the given tab', () => {
    expect(parseSettingsSection('security', 'sessions')).toBe('sessions');
    expect(parseSettingsSection('general', 'sessions')).toBeNull();
    expect(parseSettingsSection('general', null)).toBeNull();
    expect(parseSettingsSection('data', 'receipt-location')).toBe('receipt-location');
  });

  it('patches the query string and removes keys set to null', () => {
    expect(withSettingsParams('tab=security', { section: 'sessions' })).toBe(
      'tab=security&section=sessions',
    );
    expect(withSettingsParams('tab=security&section=sessions', { section: null })).toBe(
      'tab=security',
    );
    expect(withSettingsParams('', { tab: undefined })).toBe('');
  });

  it('omits the default tab from hrefs', () => {
    expect(buildSettingsHref('general')).toBe('/settings/profile');
    expect(buildSettingsHref('security')).toBe('/settings/profile?tab=security');
    expect(buildSettingsHref('security', 'sessions')).toBe(
      '/settings/profile?tab=security&section=sessions',
    );
  });

  it('maps every legacy hash to a section on its own tab', () => {
    for (const id of LEGACY_SECTION_IDS) {
      const target = LEGACY_HASH_TARGETS[id];
      expect(target, id).toBeDefined();
      if (target.section) {
        expect(SETTINGS_SECTIONS[target.tab] as readonly string[]).toContain(target.section);
      }
    }
  });
});
