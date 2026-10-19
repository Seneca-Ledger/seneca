'use client';

import { useEffect, useState } from 'react';
import { type ImportSuggestion, suggestImport } from './import-wizard-api';
import { prepareSheet } from './import-wizard-utils';

/** Confidence under which the custom-tables import dialog stays quiet. */
const BANNER_THRESHOLD = 0.7;

/**
 * Asks the server what a pasted or uploaded sheet looks like, so the
 * custom-tables import dialog can offer the entity import instead.
 */
export function useImportSuggestion(rows: string[][], enabled: boolean): ImportSuggestion | null {
  const [suggestion, setSuggestion] = useState<ImportSuggestion | null>(null);

  useEffect(() => {
    if (!(enabled && rows.length)) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    const sheet = prepareSheet(rows);
    if (!sheet.rows.length) {
      setSuggestion(null);
      return;
    }
    suggestImport(sheet.headers, sheet.samples)
      .then(next => {
        if (!cancelled) {
          setSuggestion(
            next.target !== 'table' && next.confidence >= BANNER_THRESHOLD ? next : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestion(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rows, enabled]);

  return suggestion;
}
