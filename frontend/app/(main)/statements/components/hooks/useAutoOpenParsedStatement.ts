'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useEffect, useRef } from 'react';

/**
 * Открывает первую распарсенную выписку. Это реакция на данные, а не часть их
 * загрузки, поэтому живёт отдельно от запроса.
 */
export function useAutoOpenParsedStatement({
  statements,
  enabled,
  router,
}: {
  statements: Array<{ id: string; status: string }>;
  enabled: boolean;
  router: AppRouterInstance;
}): void {
  const lastAutoOpenedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const firstFinished = statements.find(s => s.status === 'parsed');
    if (firstFinished && lastAutoOpenedIdRef.current !== firstFinished.id) {
      lastAutoOpenedIdRef.current = firstFinished.id;
      router.push(`/statements/${firstFinished.id}/edit`);
    }
  }, [statements, enabled, router]);
}
