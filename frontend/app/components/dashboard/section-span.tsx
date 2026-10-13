'use client';

import { createContext, useContext } from 'react';
import { GRID_COLUMNS } from './overview-layout';

/**
 * How many of the Overview's twelve columns the enclosing section spans, so a
 * card can show more when it has the row to itself. Outside the Overview a
 * card has its container to itself, which reads as the full width.
 */
const SectionSpanContext = createContext<number>(GRID_COLUMNS);

export const SectionSpanProvider = SectionSpanContext.Provider;

export function useSectionSpan(): number {
  return useContext(SectionSpanContext);
}

/** A card with the whole row: room for its fuller version. */
export function useIsWideSection(): boolean {
  return useSectionSpan() >= GRID_COLUMNS;
}
