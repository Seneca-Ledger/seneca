'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { TagPicker } from './TagPicker';

type TagRow = { id: string; name: string; color: string | null };

/**
 * Wires a TagPicker to one record's tags. While a save is on its way the
 * chips show the new set; a save invalidates every tag query, so the Tags
 * page usage counts follow, and a failure falls back to the server's set.
 */
function useRecordTags(
  queryKey: readonly unknown[],
  load: (signal: AbortSignal) => Promise<readonly TagRow[]>,
  save: (tagIds: string[]) => Promise<unknown>,
) {
  const t = useIntlayer('tagsPage');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: ({ signal }) => load(signal) });
  const [pending, setPending] = useState<TagRow[] | null>(null);

  const change = async (next: TagRow[]): Promise<void> => {
    setPending(next);
    await save(next.map(tag => tag.id))
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.tags(workspaceId) }))
      .catch((error: unknown) => {
        console.error('Failed to update tags:', error);
        toast.error(t.picker.saveFailed.value);
      })
      .finally(() => setPending(null));
  };

  return { tags: pending ?? query.data ?? [], loading: query.isPending, change };
}

/** The tags of a receipt (`GET/PUT /receipts/:id/tags`). */
export function ReceiptTagsField({ receiptId }: { receiptId: string }) {
  const workspaceId = useWorkspaceId();
  const { tags, loading, change } = useRecordTags(
    queryKeys.receiptTags(workspaceId, receiptId),
    signal =>
      apiQueryDecoded({ url: `/receipts/${receiptId}/tags`, signal, contract: 'StorageTagList' }),
    tagIds =>
      apiClient.put(`/receipts/${receiptId}/tags`, {
        tagIds,
      } satisfies ContractInput<'SetReceiptTagsBody'>),
  );
  return <TagPicker value={tags} onChange={next => void change(next)} disabled={loading} />;
}

/** The tags of a statement (read from `GET /storage/files/:id`, saved with PATCH `/tags`). */
export function StatementTagsField({ statementId }: { statementId: string }) {
  const workspaceId = useWorkspaceId();
  const { tags, loading, change } = useRecordTags(
    queryKeys.statementTags(workspaceId, statementId),
    async signal =>
      (
        await apiQueryDecoded({
          url: `/storage/files/${statementId}`,
          signal,
          contract: 'StorageFileDetails',
        })
      ).tags,
    tagIds =>
      apiClient.patch(`/storage/files/${statementId}/tags`, {
        tagIds,
      } satisfies ContractInput<'UpdateFileTagsBody'>),
  );
  return <TagPicker value={tags} onChange={next => void change(next)} disabled={loading} />;
}
