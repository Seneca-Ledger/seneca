'use client';

import { useQuery } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useLocale } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export interface DailyQuote {
  date: string;
  quote: { id: string; text: string; author: string; source: string; sourceUrl: string };
  theme: string | null;
  reason: { insightId: string; type: string; title: string } | null;
}

/** Today's date on the user's clock, the unit a quote lives for. */
export function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

export function useDailyQuote({ enabled = true }: { enabled?: boolean } = {}): {
  quote: DailyQuote | null;
} {
  const workspaceId = useWorkspaceId();
  const date = todayKey();
  // The quote comes in the interface language, not the profile's.
  const { locale } = useLocale();
  const query = useQuery({
    queryKey: queryKeys.dailyQuote(workspaceId, date, locale),
    // The reader's own day: the server's clock may already be on another one.
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/insights/daily-quote',
        params: { date, locale },
        signal,
        contract: 'DailyQuote',
      }),
    enabled: enabled && Boolean(workspaceId),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return { quote: query.data ?? null };
}
