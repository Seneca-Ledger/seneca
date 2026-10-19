'use client';

import { useCallback } from 'react';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';

const useDictionary = () => useIntlayer('settingsProfilePage');
export type SettingsText = ReturnType<typeof useDictionary>;
export type Tx = (path: string[], fallback: string) => string;

/**
 * The settings dictionary plus a forgiving reader for keys that may not exist
 * in every locale yet: `tx(['card', 'title'], 'Fallback')`.
 */
export function useSettingsText(): { t: SettingsText; tx: Tx } {
  const t = useDictionary();
  const tx = useCallback<Tx>(
    (path, fallback) => resolveLabel(getNestedValue(t, path), fallback),
    [t],
  );
  return { t, tx };
}
