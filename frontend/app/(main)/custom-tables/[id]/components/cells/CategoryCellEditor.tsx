'use client';

import { useQuery } from '@tanstack/react-query';
import StatementCategoryDrawer from '@/app/(main)/statements/[id]/edit/StatementCategoryDrawer';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
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
  const workspaceId = useWorkspaceId();
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
    <StatementCategoryDrawer
      open
      onClose={onClose}
      categories={categories}
      selectedCategoryId={selectedId}
      clearLabel={current ? clearLabel : undefined}
      onSelect={id => pick(categories.find(category => category.id === id)?.name ?? null)}
      // A saved category fills the cell and ends editing.
      onCreated={category => pick(category.name)}
    />
  );
}
