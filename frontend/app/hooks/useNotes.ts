'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/app/lib/api';
import { apiQuery, unwrapEnvelope } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { useWorkspaceId } from './useWorkspaceId';

/** Whatever a household argues about; the server keeps the same closed list. */
export type NoteEntityType =
  | 'statement'
  | 'receipt'
  | 'transaction'
  | 'budget'
  | 'goal'
  | 'invoice';

export interface Note {
  id: string;
  body: string;
  mentionedUserIds: string[];
  resolvedAt: string | null;
  createdAt: string;
  author: { id: string; name: string } | null;
}

export interface WorkspaceMemberOption {
  id: string;
  name: string;
}

interface NotesPayload {
  items?: Note[];
}

interface NoteTarget {
  entityType: NoteEntityType;
  entityId: string;
}

interface UseNotesState {
  notes: Note[];
  isPending: boolean;
  addNote: (input: { body: string; mentionedUserIds: string[] }) => Promise<unknown>;
  isAdding: boolean;
  setResolved: (input: { id: string; resolved: boolean }) => Promise<unknown>;
  deleteNote: (id: string) => Promise<unknown>;
}

/** Обсуждение одной выписки или чека. */
export function useNotes({ entityType, entityId }: NoteTarget): UseNotesState {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notes({ workspaceId, entityType, entityId });

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQuery<NotesPayload>({ url: '/notes', params: { entityType, entityId }, signal }),
    enabled: Boolean(entityId),
  });

  // Счётчик в списке считается отдельным запросом, поэтому после любой записи
  // сбрасываем всё поддерево 'notes', а не только тред текущего объекта.
  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const addMutation = useMutation({
    mutationFn: (input: { body: string; mentionedUserIds: string[] }) =>
      apiClient.post('/notes', { entityType, entityId, ...input }),
    onSuccess: invalidate,
  });

  const resolveMutation = useMutation({
    mutationFn: (input: { id: string; resolved: boolean }) =>
      apiClient.patch(`/notes/${input.id}`, { resolved: input.resolved }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/notes/${id}`),
    onSuccess: invalidate,
  });

  return {
    notes: query.data?.items ?? [],
    isPending: query.isPending,
    addNote: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    setResolved: resolveMutation.mutateAsync,
    deleteNote: deleteMutation.mutateAsync,
  };
}

/** Счётчики нерешённых заметок для списков — один запрос на страницу. */
export function useNoteCounts(
  entityType: NoteEntityType,
  entityIds: string[],
): Record<string, number> {
  const workspaceId = useWorkspaceId();
  // Порядок id меняется при сортировке списка, а ответ от него не зависит.
  const stableIds = [...entityIds].sort();

  const query = useQuery({
    queryKey: queryKeys.noteCounts({ workspaceId, entityType, entityIds: stableIds }),
    queryFn: async () => {
      const response = await apiClient.post('/notes/counts', { entityType, entityIds: stableIds });
      return unwrapEnvelope<{ counts?: Record<string, number> }>(response.data);
    },
    enabled: stableIds.length > 0,
  });

  return query.data?.counts ?? {};
}

/** Участники воркспейса — источник подсказок для @упоминаний. */
export function useWorkspaceMembers(): WorkspaceMemberOption[] {
  const workspaceId = useWorkspaceId();

  const query = useQuery({
    queryKey: queryKeys.workspaceMembers(workspaceId),
    queryFn: ({ signal }) =>
      apiQuery<{ members?: Array<{ id: string; name?: string; email?: string }> }>({
        url: `/workspaces/${workspaceId}`,
        signal,
      }),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  });

  return (query.data?.members ?? []).map(member => ({
    id: member.id,
    name: member.name || member.email || '—',
  }));
}
