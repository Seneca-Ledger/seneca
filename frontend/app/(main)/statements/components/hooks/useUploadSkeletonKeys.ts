'use client';

import { useEffect, useMemo } from 'react';
import { removePendingUploads, usePendingUploads } from '../pending-uploads-store';
import { isReceiptDerivedStatement } from '../StatementsListView.utils';

type ListedStatement = Parameters<typeof isReceiptDerivedStatement>[0] & { id: string };

interface UseUploadSkeletonKeysParams {
  workspaceId: string | null;
  /** Receipts merged into the list; a scan upload's row comes only from here. */
  receiptRows: Array<{ statementId?: string | null }>;
  /** Raw statements query data. */
  statements: ListedStatement[];
  limit: number;
}

/**
 * One placeholder row per uploaded file, held until the list data carries the
 * statement created for that file, so the placeholder and the row swap in one
 * render.
 *
 * A scan upload's own statement is in `statements` too, but the list drops it in
 * favour of the receipt row, which arrives with another query. Matching on it
 * would clear the placeholder before there is a row to replace it.
 */
export function useUploadSkeletonKeys({
  workspaceId,
  receiptRows,
  statements,
  limit,
}: UseUploadSkeletonKeysParams): string[] {
  const uploads = usePendingUploads();

  const listedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of receiptRows) {
      if (row.statementId) {
        ids.add(row.statementId);
      }
    }
    for (const statement of statements) {
      if (!isReceiptDerivedStatement(statement)) {
        ids.add(statement.id);
      }
    }
    return ids;
  }, [receiptRows, statements]);

  const { pendingKeys, listedKeys } = useMemo(() => {
    const pending: string[] = [];
    const listed: string[] = [];
    for (const upload of uploads) {
      if (upload.workspaceId !== workspaceId) {
        continue;
      }
      if (upload.statementId !== null && listedIds.has(upload.statementId)) {
        listed.push(upload.key);
      } else {
        pending.push(upload.key);
      }
    }
    return { pendingKeys: pending, listedKeys: listed };
  }, [uploads, workspaceId, listedIds]);

  // Already hidden above; dropping them from the store keeps a later refetch
  // (e.g. after the row is deleted) from bringing the placeholder back.
  useEffect(() => {
    if (listedKeys.length > 0) {
      removePendingUploads(listedKeys);
    }
  }, [listedKeys]);

  return useMemo(() => pendingKeys.slice(0, limit), [pendingKeys, limit]);
}
