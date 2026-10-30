'use client';

import {
  type UseViewPreferenceResult,
  useViewPreference,
} from '@/app/components/transactions/hooks/useViewPreference';

export type SavedOverviewLayout = { overviewRows: unknown; hiddenSections?: string[] };

/** The saved rows as stored; `normalizeRows` decides what of them is still usable. */
const readOverviewLayout = (saved: Readonly<Record<string, unknown>>): SavedOverviewLayout => ({
  overviewRows: saved.overviewRows,
  hiddenSections: Array.isArray(saved.hiddenSections)
    ? saved.hiddenSections.filter((id): id is string => typeof id === 'string')
    : [],
});

/**
 * How this person arranged the Overview. `state` is `undefined` until it has
 * loaded: the page keeps its skeleton until then rather than drawing the
 * default arrangement and rearranging a moment later.
 */
export function useOverviewLayoutState(): UseViewPreferenceResult<SavedOverviewLayout> {
  return useViewPreference('dashboard', readOverviewLayout);
}
