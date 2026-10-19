import { beforeEach, describe, expect, it } from 'vitest';
import { migrateLegacyStorageKeys } from './legacy-storage-keys';

describe('migrateLegacyStorageKeys', () => {
  beforeEach(() => localStorage.clear());

  it('moves every lumio-prefixed key to the seneca prefix', () => {
    localStorage.setItem('lumio_tour_state', '{"done":true}');
    localStorage.setItem('lumio:currencyDisplay', 'original');
    localStorage.setItem('lumio-statement-columns', '["date"]');

    migrateLegacyStorageKeys(localStorage);

    expect(localStorage.getItem('seneca_tour_state')).toBe('{"done":true}');
    expect(localStorage.getItem('seneca:currencyDisplay')).toBe('original');
    expect(localStorage.getItem('seneca-statement-columns')).toBe('["date"]');
    expect(localStorage.getItem('lumio_tour_state')).toBeNull();
    expect(localStorage.getItem('lumio:currencyDisplay')).toBeNull();
  });

  it('keeps a value already saved under the new name and leaves other keys alone', () => {
    localStorage.setItem('lumio:currencyDisplay', 'old');
    localStorage.setItem('seneca:currencyDisplay', 'new');
    localStorage.setItem('theme', 'dark');

    migrateLegacyStorageKeys(localStorage);

    expect(localStorage.getItem('seneca:currencyDisplay')).toBe('new');
    expect(localStorage.getItem('lumio:currencyDisplay')).toBeNull();
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
