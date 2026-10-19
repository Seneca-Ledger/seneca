'use client';

import { useIntlayer } from '@/app/i18n';
import type { StoicClass } from './useStoicBalance';

type Segment = StoicClass | 'unclassified';

/** The budgets dictionary plus the class names and hints, keyed by class. */
export function useClassText(): {
  t: ReturnType<typeof useIntlayer<'budgetsPage'>>;
  names: Record<Segment, string>;
  hints: Record<StoicClass, string>;
} {
  const t = useIntlayer('budgetsPage');
  const names: Record<Segment, string> = {
    necessity: t.classNecessity.value,
    work: t.classWork.value,
    virtue: t.classVirtue.value,
    leisure: t.classLeisure.value,
    unclassified: t.unclassified.value,
  };
  const hints: Record<StoicClass, string> = {
    necessity: t.hintNecessity.value,
    work: t.hintWork.value,
    virtue: t.hintVirtue.value,
    leisure: t.hintLeisure.value,
  };
  return { t, names, hints };
}
