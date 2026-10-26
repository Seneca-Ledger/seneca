/**
 * Browser storage keys started with "lumio" before the product was renamed.
 * Moves each one to its "seneca" name once, so filters, columns and tour
 * progress survive the upgrade. A key already present under the new name wins.
 */
export function migrateLegacyStorageKeys(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key?.startsWith('lumio')) continue;
    const value = storage.getItem(key);
    const renamed = `seneca${key.slice('lumio'.length)}`;
    if (value !== null && storage.getItem(renamed) === null) storage.setItem(renamed, value);
    storage.removeItem(key);
  }
}
