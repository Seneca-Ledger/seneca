'use client';

import { createContext, type ReactNode, useContext } from 'react';
import { type NoteEntityType, useNoteCounts } from '@/app/hooks/useNotes';

const NoteCountsContext = createContext<Record<string, number>>({});

interface NoteCountsProviderProps {
  entityType: NoteEntityType;
  entityIds: string[];
  children: ReactNode;
}

/**
 * Счётчики заметок для одной страницы списка.
 *
 * Через контекст, а не через пропсы: строка списка лежит под двумя слоями
 * таблиц, и протаскивать число сквозь них пришлось бы в четырёх файлах.
 */
export function NoteCountsProvider({ entityType, entityIds, children }: NoteCountsProviderProps) {
  const counts = useNoteCounts(entityType, entityIds);
  return <NoteCountsContext.Provider value={counts}>{children}</NoteCountsContext.Provider>;
}

/** Вне провайдера возвращает 0 — бейдж просто не рисуется. */
export function useNoteCount(entityId: string): number {
  return useContext(NoteCountsContext)[entityId] ?? 0;
}
