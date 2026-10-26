'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient, { gmailReceiptsApi } from '@/app/lib/api';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { filterEnabledCategories } from '../[id]/edit/editHelpers';
import StatementCategoryDrawer from '../[id]/edit/StatementCategoryDrawer';

export interface CategoryTarget {
  id: string;
  source?: string;
}

/**
 * Each kind of document keeps its category where its own page saves it: a
 * statement on the stored file, a scan and a Gmail receipt in the receipt's
 * parsed data, each through its own endpoint.
 */
export async function saveDocumentCategory(
  target: CategoryTarget,
  categoryId: string,
  categoryName: string | null,
): Promise<void> {
  if (target.source === 'gmail') {
    await gmailReceiptsApi.updateReceiptParsedData(target.id, {
      categoryId,
      category: categoryName,
    });
    return;
  }
  if (target.source === 'scan') {
    await apiClient.patch(`/receipts/${target.id}`, {
      parsedData: { categoryId, category: categoryName },
    } satisfies ContractInput<'UpdateReceiptBody'>);
    return;
  }
  await apiClient.patch(`/storage/files/${target.id}/category`, {
    categoryId,
  } satisfies ContractInput<'UpdateFileCategoryBody'>);
}

/** The app's category drawer, opened from a row of the documents list. */
export function DocumentCategoryDrawer({
  target,
  onClose,
}: {
  target: CategoryTarget | null;
  onClose: () => void;
}): React.JSX.Element {
  const workspaceId = useWorkspaceId();
  const t = useIntlayer('statementEditPage');
  const [saving, setSaving] = useState(false);
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: 5 * 60_000,
    enabled: target !== null,
  });
  const categories = categoriesQuery.data ?? [];

  /** `createdName` comes with a category just created, which the cached list may not hold yet. */
  const handleSelect = async (categoryId: string, createdName?: string): Promise<void> => {
    if (!target || saving || !categoryId) {
      return;
    }
    const name =
      createdName ?? categories.find(category => category.id === categoryId)?.name ?? null;
    setSaving(true);
    await saveDocumentCategory(target, categoryId, name)
      .then(() => {
        invalidateDocumentLists();
        toast.success(t.labels.categoryUpdated.value);
        onClose();
      })
      .catch(() => toast.error(t.labels.categoryUpdateFailed.value))
      .finally(() => setSaving(false));
  };

  return (
    <StatementCategoryDrawer
      open={target !== null}
      onClose={onClose}
      categories={filterEnabledCategories(categories)}
      selectedCategoryId=""
      selecting={saving}
      onSelect={categoryId => void handleSelect(categoryId)}
      onCreated={category => void handleSelect(category.id, category.name)}
    />
  );
}
