'use client';

import { useCallback } from 'react';
import { useIntlayer } from '@/app/i18n';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';

const useDictionary = () => useIntlayer('settingsProfilePage');
export type SettingsText = ReturnType<typeof useDictionary>;
export type Tx = (path: string[]) => string;

/**
 * The settings dictionary plus a reader for keys picked by a path that is only
 * known at runtime: `tx(['notificationsCard', 'channels', channel])`.
 */
export function useSettingsText(): { t: SettingsText; tx: Tx } {
  const t = useDictionary();
  const tx = useCallback<Tx>(path => resolveLabel(getNestedValue(t, path)), [t]);
  return { t, tx };
}
