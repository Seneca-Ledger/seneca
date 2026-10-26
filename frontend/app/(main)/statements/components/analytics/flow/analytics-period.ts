'use client';

import { createContext, useContext } from 'react';

/** A date range set by the page above, with how to name it ("Jan 1 – Oct 15, 2026"). */
export type AnalyticsPeriod = { from: string; to: string; label: string };

/**
 * The period of the Cash flow tab. When set, the leaderboards under it show
 * this range instead of stepping through months of their own: one period for
 * the whole page, not a year-to-date total above three single months.
 */
export const AnalyticsPeriodContext = createContext<AnalyticsPeriod | null>(null);

export function useAnalyticsPeriod(): AnalyticsPeriod | null {
  return useContext(AnalyticsPeriodContext);
}
