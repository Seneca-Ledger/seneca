'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export interface DailyQuote {
  date: string;
  quote: { id: string; text: string; author: string; source: string; sourceUrl: string };
  theme: string | null;
  reason: { insightId: string; type: string; title: string } | null;
  vote: QuoteVote;
}

/** 1 thumb up, -1 thumb down, null none. */
export type QuoteVote = 1 | -1 | null;

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

/**
 * Puts a thumb on today's quote, or takes it back with null. The banner shows
 * it pressed at once; a failed request puts the previous thumb back.
 */
export function useQuoteVote(): (quoteId: string, vote: QuoteVote) => void {
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const { locale } = useLocale();

  return (quoteId: string, vote: QuoteVote): void => {
    const date = todayKey();
    const key = queryKeys.dailyQuote(workspaceId, date, locale);
    const previous = queryClient.getQueryData<DailyQuote>(key);
    const setVote = (next: QuoteVote): void => {
      queryClient.setQueryData<DailyQuote>(key, current =>
        current?.quote.id === quoteId ? { ...current, vote: next } : current,
      );
    };
    setVote(vote);
    const url = `/insights/daily-quote/${quoteId}/vote`;
    apiClient
      .put(url, { vote: vote ?? 0, date } satisfies ContractInput<'QuoteVoteBody'>)
      .then(response => checkContract('QuoteVote', response.data, url))
      .then(stored => setVote(stored.vote))
      .catch(() => setVote(previous?.vote ?? null));
  };
}
