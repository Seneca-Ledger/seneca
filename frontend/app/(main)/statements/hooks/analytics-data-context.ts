'use client';

import { createContext } from 'react';
import type { UseAnalyticsDataResult } from './useAnalyticsData';

/**
 * Set by `AnalyticsDataProvider` so several analytics views on one page share
 * a single fetch. `null` means every `useAnalyticsData` call fetches its own.
 */
export const AnalyticsDataContext = createContext<UseAnalyticsDataResult | null>(null);
