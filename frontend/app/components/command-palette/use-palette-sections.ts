'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, FileText, Tag, Wallet } from '@/app/components/icons';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useExperimentalMode } from '@/app/lib/experimental-mode';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import type { Command, CommandGroup } from './command-registry';

export type SearchResultKind = 'transaction' | 'statement' | 'payable' | 'receivable' | 'category';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export type PaletteRow =
  | { kind: 'command'; id: string; command: Command }
  | { kind: 'result'; id: string; result: SearchResult };

export type SectionGroup = CommandGroup | 'results' | 'recent';

export interface PaletteSection {
  group: SectionGroup;
  rows: PaletteRow[];
}

/** Matches the backend's MIN_QUERY_LENGTH — no point sending shorter needles. */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 250;

const GROUP_ORDER: CommandGroup[] = ['actions', 'navigation', 'settings', 'help'];

export const KIND_ICONS: Record<SearchResultKind, React.ReactNode> = {
  transaction: React.createElement(ArrowLeftRight, { size: 18 }),
  statement: React.createElement(FileText, { size: 18 }),
  payable: React.createElement(Wallet, { size: 18 }),
  receivable: React.createElement(Wallet, { size: 18 }),
  category: React.createElement(Tag, { size: 18 }),
};

function matches(command: Command, needle: string): boolean {
  if (!needle) {
    return true;
  }
  const haystack = [command.label, ...(command.keywords ?? [])].join(' ').toLowerCase();
  return haystack.includes(needle);
}

export function usePaletteSections(
  input: string,
  commands: Command[],
): {
  sections: PaletteSection[];
  rows: PaletteRow[];
  isSearchError: boolean;
} {
  const workspaceId = useWorkspaceId();
  const { hasPermission } = usePermissions();
  const experimentalMode = useExperimentalMode();
  const [query, setQuery] = useState('');

  // Only the backend call waits: static commands filter on every keystroke, so
  // the palette feels instant even while the search request is still in flight.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const searching = query.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: queryKeys.search({ workspaceId, q: query }),
    queryFn: ({ signal }) =>
      apiQuery<SearchResponse>({ url: '/search', params: { q: query }, signal }),
    enabled: searching,
    placeholderData: keepPreviousData,
  });

  const recentQuery = useQuery({
    queryKey: queryKeys.searchRecent(workspaceId),
    queryFn: ({ signal }) => apiQuery<SearchResponse>({ url: '/search/recent', signal }),
    enabled: input.trim().length === 0,
  });

  const needle = input.trim().toLowerCase();

  const sections = useMemo(() => {
    const visible = commands.filter(
      command =>
        (!command.permission || hasPermission(command.permission)) &&
        (!command.experimental || experimentalMode) &&
        matches(command, needle),
    );

    const grouped: PaletteSection[] = GROUP_ORDER.map(group => ({
      group,
      rows: visible
        .filter(command => command.group === group)
        .map(command => ({ kind: 'command' as const, id: command.id, command })),
    }));

    // Results go last so a landing debounce never shifts the rows above the cursor.
    const results = searching ? (searchQuery.data?.results ?? []) : [];
    const recent = needle === '' ? (recentQuery.data?.results ?? []) : [];
    const tail = searching
      ? [{ group: 'results' as const, rows: toResultRows(results) }]
      : [{ group: 'recent' as const, rows: toResultRows(recent) }];

    return [...grouped, ...tail].filter(section => section.rows.length > 0);
  }, [
    commands,
    hasPermission,
    experimentalMode,
    needle,
    searching,
    searchQuery.data,
    recentQuery.data,
  ]);

  const rows = useMemo(() => sections.flatMap(section => section.rows), [sections]);

  return { sections, rows, isSearchError: searchQuery.isError };
}

function toResultRows(results: SearchResult[]): PaletteRow[] {
  return results.map(result => ({
    kind: 'result' as const,
    id: `${result.kind}:${result.id}`,
    result,
  }));
}
