'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { CategoryFormDialog } from '@/app/components/categories/CategoryFormDialog';
import { Plus } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { CustomTableCellValue } from '../../utils/types';

interface CategoryCellEditorProps {
  value: CustomTableCellValue;
  clearLabel: string;
  onChange: (name: string | null) => void;
  onClose: () => void;
}

/**
 * Category cells: the app's category drawer opens at once. The cell stores the
 * category name, as tables filled from Seneca data do. "Create category" opens
 * the same dialog as the workspace Categories tab and puts the new name in the cell.
 */
export function CategoryCellEditor({
  value,
  clearLabel,
  onChange,
  onClose,
}: CategoryCellEditorProps) {
  const t = useIntlayer('categoriesPage');
  const workspaceId = useWorkspaceId();
  const [creating, setCreating] = useState(false);
  const current = typeof value === 'string' ? value : '';
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    enabled: Boolean(workspaceId),
  });
  const categories = (categoriesQuery.data ?? []).filter(category => category.isEnabled !== false);
  const selectedId = categories.find(category => category.name === current)?.id ?? '';

  const pick = (name: string | null) => {
    if (name !== (current || null)) {
      onChange(name);
    }
    onClose();
  };

  return (
    <>
      <StatementCategoryDrawer
        open={!creating}
        onClose={onClose}
        categories={categories}
        selectedCategoryId={selectedId}
        selecting={false}
        showAllOption={Boolean(current)}
        onSelect={id => pick(categories.find(category => category.id === id)?.name ?? null)}
        labels={{
          title: t.title.value,
          searchPlaceholder: t.searchPlaceholder.value,
          allOption: clearLabel,
          noResults: t.noData.value,
        }}
        footer={
          <Button variant="ghost" type="button" onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden />
            {t.dialog.createTitle.value}
          </Button>
        }
      />
      <CategoryFormDialog
        open={creating}
        category={null}
        // Cancel goes back to the list; a saved category fills the cell and ends editing.
        onClose={() => setCreating(false)}
        onSaved={saved => {
          onChange(saved.name);
          onClose();
        }}
      />
    </>
  );
}
