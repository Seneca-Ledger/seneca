'use client';

import { MoreHorizontal, Pencil, Trash2 } from '@/app/components/icons';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { AGGREGATE_FNS, type AggregateFn, type CustomTableColumn } from '../utils/types';

export interface ColumnHeaderLabels {
  columnMenu: string;
  editColumn: string;
  deleteColumn: string;
  noTotal: string;
  aggregates: Record<AggregateFn, string>;
}

interface ColumnHeaderProps {
  column: CustomTableColumn;
  labels: ColumnHeaderLabels;
  onEdit: (column: CustomTableColumn) => void;
  onDelete: (column: CustomTableColumn) => void;
  /** Numeric columns pick their footer total here; others pass nothing. */
  total?: { value: AggregateFn | null; onChange: (fn: AggregateFn | null) => void };
}

/**
 * Small per-column menu; sits next to the sort button in the th. Numeric
 * columns also choose their total here, so the footer only shows once one is set.
 */
export function ColumnMenu({ column, labels, onEdit, onDelete, total }: ColumnHeaderProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="seneca-ct__col-menu"
          aria-label={`${labels.columnMenu}: ${column.title}`}
          onClick={event => event.stopPropagation()}
        >
          <MoreHorizontal size={14} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(column)}>
          <Pencil size={14} aria-hidden />
          {labels.editColumn}
        </DropdownMenuItem>
        {/* MUI Menu walks its children for focus; a Fragment hides them, so give it an array. */}
        {total
          ? [
              <DropdownMenuSeparator key="total-separator" />,
              ...[null, ...AGGREGATE_FNS].map(fn => (
                <DropdownMenuCheckboxItem
                  key={`total-${fn ?? 'none'}`}
                  checked={total.value === fn}
                  onCheckedChange={() => total.onChange(fn)}
                >
                  {fn ? labels.aggregates[fn] : labels.noTotal}
                </DropdownMenuCheckboxItem>
              )),
            ]
          : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(column)}>
          <Trash2 size={14} aria-hidden />
          {labels.deleteColumn}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
