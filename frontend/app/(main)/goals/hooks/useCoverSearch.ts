'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import apiClient from '@/app/lib/api';

export interface CoverSearchResult {
  id: string;
  title: string;
  creator: string | null;
  license: string;
  licenseUrl: string | null;
  /** The credit line Openverse composes; shown verbatim, never recomposed here. */
  attribution: string;
  sourceUrl: string | null;
}

interface CoverSearchPage {
  results: CoverSearchResult[];
  page: number;
  hasMore: boolean;
}

interface UseCoverSearchState {
  results: CoverSearchResult[];
  isPending: boolean;
  error: string | null;
  /** False until the first search runs, which is what tells the hint from "nothing found". */
  hasSearched: boolean;
  runSearch: (term: string) => void;
}

/**
 * A mutation rather than a query: the search runs when the person presses the
 * button, not when a key changes, so nothing is fetched while they are still
 * typing. The daily allowance upstream is small enough that it matters.
 */
export function useCoverSearch(): UseCoverSearchState {
  const [results, setResults] = useState<CoverSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const mutation = useMutation({
    mutationFn: async (term: string) => {
      const response = await apiClient.get<CoverSearchPage>('/goals/covers/search', {
        params: { q: term },
      });
      return response.data;
    },
    onSuccess: page => {
      setResults(page.results);
      setError(null);
    },
    onError: (requestError: unknown) => {
      setResults([]);
      // The server distinguishes "allowance used up" from "search is down", and
      // that difference is the whole point of the message — pass it through.
      setError(messageOf(requestError));
    },
  });

  const runSearch = useCallback(
    (term: string) => {
      setHasSearched(true);
      mutation.mutate(term);
    },
    [mutation.mutate],
  );

  return { results, isPending: mutation.isPending, error, hasSearched, runSearch };
}

function messageOf(error: unknown): string {
  const payload = (error as { response?: { data?: { message?: unknown } } })?.response?.data;
  return typeof payload?.message === 'string' ? payload.message : 'Image search is unavailable';
}
