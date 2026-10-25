import en from '@/.intlayer/dynamic_dictionary/json/settingsProfilePage/en.json';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import type { Tx } from '@/app/settings/profile/hooks/useSettingsText';

/** Test-only `tx` over the built English settings dictionary, so a test sees the real copy. */
export const enTx: Tx = path => resolveLabel(getNestedValue(en.content, path));
