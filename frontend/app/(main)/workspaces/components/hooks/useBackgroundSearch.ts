'use client';

import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import apiClient from '@/app/lib/api';

export interface BackgroundSearchResult {
  id: string;
  title: string;
  creator: string | null;
  license: string;
  /** The credit line Openverse composes; shown verbatim, never recomposed here. */
  attribution: string;
  sourceUrl: string | null;
}

interface BackgroundSearchPage {
  results: BackgroundSearchResult[];
  page: number;
  hasMore: boolean;
}

interface UseBackgroundSearchState {
  results: BackgroundSearchResult[];
  /** The term the results belong to, so a suggestion can show as active. */
  term: string | null;
  isPending: boolean;
  error: string | null;
  hasMore: boolean;
  runSearch: (term: string) => void;
  loadMore: () => void;
}

/**
 * A mutation rather than a query: a search runs on a tap or a submit, never per
 * keystroke. The anonymous Openverse allowance is shared by the whole
 * deployment, so nothing is fetched while someone is still typing.
 */
export function useBackgroundSearch(): UseBackgroundSearchState {
  const [results, setResults] = useState<BackgroundSearchResult[]>([]);
  const [term, setTerm] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (request: { term: string; page: number }) => {
      const response = await apiClient.get<BackgroundSearchPage>('/workspaces/backgrounds/search', {
        params: { q: request.term, page: request.page },
      });
      return response.data;
    },
    onSuccess: (result, request) => {
      setResults(previous =>
        request.page === 1 ? result.results : appendUnique(previous, result.results),
      );
      setPage(result.page);
      setHasMore(result.hasMore);
      setError(null);
    },
    onError: (requestError: unknown, request) => {
      if (request.page === 1) {
        setResults([]);
      }
      setHasMore(false);
      // The server tells "allowance used up" from "search is down"; that
      // difference is the whole point of the message, so it is passed through.
      setError(messageOf(requestError));
    },
  });

  const runSearch = useCallback(
    (nextTerm: string) => {
      setTerm(nextTerm);
      mutation.mutate({ term: nextTerm, page: 1 });
    },
    [mutation.mutate],
  );

  const loadMore = useCallback(() => {
    if (term) {
      mutation.mutate({ term, page: page + 1 });
    }
  }, [mutation.mutate, term, page]);

  return { results, term, isPending: mutation.isPending, error, hasMore, runSearch, loadMore };
}

/** Openverse can repeat an image across pages; a repeated key would break the grid. */
function appendUnique(
  previous: BackgroundSearchResult[],
  next: BackgroundSearchResult[],
): BackgroundSearchResult[] {
  const seen = new Set(previous.map(result => result.id));
  return [...previous, ...next.filter(result => !seen.has(result.id))];
}

function messageOf(error: unknown): string {
  const payload = (
    error as { response?: { data?: { message?: unknown; error?: { message?: unknown } } } }
  )?.response?.data;
  const message = payload?.message ?? payload?.error?.message;
  return typeof message === 'string' ? message : 'Image search is unavailable';
}
