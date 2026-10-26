'use client';

import { useCallback, useState } from 'react';
import {
  forgetImportMapping,
  type ImportTarget,
  matchImportMapping,
  saveImportMapping,
} from './import-wizard-api';

export interface SavedMapping {
  /** Id of the remembered mapping now applied, null when none is. */
  savedId: string | null;
  /** The mapping remembered for this header row, or null. */
  lookUp: (target: ImportTarget, headers: string[]) => Promise<Record<string, number> | null>;
  /** Remembers the mapping of a finished import for the next file with these headers. */
  remember: (
    target: ImportTarget,
    headers: string[],
    mapping: Record<string, number>,
  ) => Promise<void>;
  forget: () => Promise<void>;
}

/**
 * Column mappings remembered per header row: looked up when a sheet opens,
 * saved after an import succeeds. Best effort: when the lookup or the save
 * fails, the user maps the columns by hand, as without it.
 */
export function useSavedMapping(): SavedMapping {
  const [savedId, setSavedId] = useState<string | null>(null);

  const lookUp = useCallback(async (target: ImportTarget, headers: string[]) => {
    setSavedId(null);
    try {
      const saved = await matchImportMapping(target, headers);
      setSavedId(saved?.id ?? null);
      return saved?.mapping ?? null;
    } catch {
      return null;
    }
  }, []);

  const remember = useCallback(
    async (target: ImportTarget, headers: string[], mapping: Record<string, number>) => {
      try {
        setSavedId((await saveImportMapping(target, headers, mapping)).id);
      } catch {
        // The import itself succeeded; only the shortcut for next time is missing.
      }
    },
    [],
  );

  const forget = useCallback(async () => {
    if (!savedId) {
      return;
    }
    try {
      await forgetImportMapping(savedId);
      setSavedId(null);
    } catch {
      // Still remembered; the hint stays so the user can try again.
    }
  }, [savedId]);

  return { savedId, lookUp, remember, forget };
}
