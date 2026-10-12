'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
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
      apiQueryDecoded({
        url: '/notes',
        params: { entityType, entityId },
        signal,
        contract: 'NoteList',
      }),
    enabled: Boolean(entityId),
  });

  // Счётчик в списке считается отдельным запросом, поэтому после любой записи
  // сбрасываем всё поддерево 'notes', а не только тред текущего объекта.
  const invalidate = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
  };

  const addMutation = useMutation({
    mutationFn: async (input: { body: string; mentionedUserIds: string[] }) => {
      await apiClient.post('/notes', {
        entityType,
        entityId,
        ...input,
      } satisfies ContractInput<'CreateNoteBody'>);
    },
    onSuccess: invalidate,
  });

  const resolveMutation = useMutation({
    mutationFn: async (input: { id: string; resolved: boolean }) => {
      await apiClient.patch(`/notes/${input.id}`, {
        resolved: input.resolved,
      } satisfies ContractInput<'SetNoteResolvedBody'>);
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/notes/${id}`);
    },
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
      const response = await apiClient.post('/notes/counts', {
        entityType,
        entityIds: stableIds,
      } satisfies ContractInput<'ListNoteCountsBody'>);
      return checkContract('NoteCounts', response.data, '/notes/counts');
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
      apiQueryDecoded({ url: `/workspaces/${workspaceId}`, signal, contract: 'WorkspaceDetail' }),
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  });

  return (query.data?.members ?? []).map(member => ({
    id: member.id,
    name: member.name || member.email || '—',
  }));
}
