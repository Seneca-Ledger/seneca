'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { checkContract } from '@/app/lib/query-fn-schema';
import {
  isAreaBigEnough,
  missingGroups,
  nextTag,
  type TeachPreview,
  type TeachRegion,
  type TeachTag,
} from './teach-utils';

/** Marks settle for this long before the file is read with them. */
const PREVIEW_DELAY_MS = 450;

export interface TeachSession {
  words: ReturnType<typeof useLayoutWords>['data'];
  regions: TeachRegion[];
  activeTag: TeachTag;
  setActiveTag: (tag: TeachTag) => void;
  addRegion: (region: Omit<TeachRegion, 'tag'>) => void;
  removeRegion: (index: number) => void;
  missing: TeachTag[][];
  preview: TeachPreview | null;
  reading: boolean;
  saving: boolean;
  save: () => Promise<boolean>;
  /** Each page's width in points, as the PDF gives it, to scale the marks to the page drawn. */
  pageWidths: Record<number, number>;
  setPageWidth: (page: number, width: number) => void;
}

function useLayoutWords(statementId: string | null) {
  const url = `/statements/${statementId}/layout-words`;
  return useQuery({
    queryKey: ['statements', statementId, 'layout-words'],
    enabled: statementId !== null,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const response = await apiClient.get(url);
      return (await checkContract('StatementLayoutWords', response.data, url)).words;
    },
  });
}

/**
 * The marks on one statement: the areas drawn, the tag in hand, how the file
 * reads with them (asked again whenever they change) and saving them, which
 * teaches the workspace the layout and reads the statement again.
 */
export function useTeachSession(statementId: string | null): TeachSession {
  const words = useLayoutWords(statementId);
  const [regions, setRegions] = useState<TeachRegion[]>([]);
  const [activeTag, setActiveTag] = useState<TeachTag>('date');
  const [preview, setPreview] = useState<TeachPreview | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageWidths, setPageWidths] = useState<Record<number, number>>({});
  const missing = missingGroups(regions);

  useEffect(() => {
    if (statementId === null || missingGroups(regions).length > 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    const url = `/statements/${statementId}/teach/preview`;
    const timer = setTimeout(async () => {
      setReading(true);
      try {
        const response = await apiClient.post(url, { regions });
        const answer = await checkContract('TeachLayoutPreview', response.data, url);
        if (!cancelled) {
          setPreview(answer);
        }
      } catch (error) {
        console.error('Teach preview failed', error);
      } finally {
        if (!cancelled) {
          setReading(false);
        }
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [statementId, regions]);

  const addRegion = (area: Omit<TeachRegion, 'tag'>) => {
    if (!isAreaBigEnough(area)) {
      return;
    }
    const next = [...regions, { ...area, tag: activeTag }];
    setRegions(next);
    setActiveTag(nextTag(next, activeTag));
  };

  const removeRegion = (index: number) => {
    setRegions(regions.filter((_, at) => at !== index));
  };

  const save = async (): Promise<boolean> => {
    if (statementId === null) {
      return false;
    }
    setSaving(true);
    const url = `/statements/${statementId}/teach`;
    try {
      const response = await apiClient.post(url, { regions });
      await checkContract('StatementWritten', response.data, url);
      // The statement is read again: its rows and status change everywhere.
      invalidateFinancialData();
      return true;
    } catch (error) {
      console.error('Teaching the layout failed', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    words: words.data,
    regions,
    activeTag,
    setActiveTag,
    addRegion,
    removeRegion,
    missing,
    preview,
    reading,
    saving,
    save,
    pageWidths,
    setPageWidth: (page, width) =>
      setPageWidths(current => (current[page] === width ? current : { ...current, [page]: width })),
  };
}
