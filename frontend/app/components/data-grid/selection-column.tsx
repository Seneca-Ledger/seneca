'use client';

import type { RowData } from '@tanstack/react-table';
import { Checkbox } from '@/app/components/ui/checkbox';
import type { GridColumnDef } from './features';

export const SELECTION_COLUMN_ID = '__select';

/**
 * Leading checkbox column. Header toggles every loaded row, the cell toggles
 * one; both read selection straight from the table instance.
 */
export function selectionColumn<TData extends RowData>(labels: {
  selectAll: string;
  selectRow: string;
}): GridColumnDef<TData, unknown> {
  return {
    id: SELECTION_COLUMN_ID,
    size: 44,
    enableSorting: false,
    enableHiding: false,
    meta: { align: 'center', className: 'seneca-grid__cell--select' },
    header: ({ table }) => (
      <Checkbox
        aria-label={labels.selectAll}
        checked={table.getIsAllRowsSelected()}
        indeterminate={!table.getIsAllRowsSelected() && table.getIsSomeRowsSelected()}
        onCheckedChange={value => table.toggleAllRowsSelected(value)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label={labels.selectRow}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={value => row.toggleSelected(value)}
        onClick={event => event.stopPropagation()}
      />
    ),
  };
}
