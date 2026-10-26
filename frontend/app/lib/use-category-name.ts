'use client';

import { useCallback } from 'react';
import { useLocale } from '@/app/i18n';
import { localizeStatementCategoryName } from './statement-categories';

/**
 * A stored category name as the reader should see it. System categories are
 * stored by their English name; anything that is not one comes back as is.
 * Keys, links and icon lookups keep using the stored name.
 */
export function useCategoryName(): (name: string) => string {
  const { locale } = useLocale();
  return useCallback((name: string) => localizeStatementCategoryName(name, locale), [locale]);
}
