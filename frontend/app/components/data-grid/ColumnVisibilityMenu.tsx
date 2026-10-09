'use client';

import type { RowData } from '@tanstack/react-table';
import { Columns2 } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import type { DataGridTable } from './use-data-grid';

interface ColumnVisibilityMenuProps<TData extends RowData> {
  table: DataGridTable<TData>;
  labels: { columns: string; showAll: string };
}

const columnLabel = (column: {
  id: string;
  columnDef: { header?: unknown; meta?: { label?: string } };
}) =>
  column.columnDef.meta?.label ??
  (typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id);

/** "Columns" dropdown with one checkbox per hideable column. */
export function ColumnVisibilityMenu<TData extends RowData>({
  table,
  labels,
}: ColumnVisibilityMenuProps<TData>) {
  const columns = table.getAllLeafColumns().filter(column => column.getCanHide());
  const hiddenCount = columns.filter(column => !column.getIsVisible()).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          <Columns2 aria-hidden />
          {labels.columns}
          {hiddenCount ? <span className="lumio-grid__menu-count">{hiddenCount}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map(column => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={value => column.toggleVisibility(Boolean(value))}
          >
            {columnLabel(column)}
          </DropdownMenuCheckboxItem>
        ))}
        {/* MUI Menu walks its children for focus; a Fragment hides them, so give it an array. */}
        {hiddenCount
          ? [
              <DropdownMenuSeparator key="separator" />,
              <DropdownMenuItem key="show-all" onClick={() => table.toggleAllColumnsVisible(true)}>
                {labels.showAll}
              </DropdownMenuItem>,
            ]
          : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
