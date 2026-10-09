'use client';

import { useRef } from 'react';
import { Search, Trash2 } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Select } from '@/app/components/ui/select';
import { TABULAR_FILE_ACCEPT } from '../utils/tabularFileReader';
import type { CustomTableColumn } from '../utils/types';

export interface TableToolbarLabels {
  search: string;
  addRow: string;
  addColumn: string;
  columns: string;
  showAllColumns: string;
  groupBy: string;
  groupNone: string;
  importFile: string;
  export: string;
  exportXlsx: string;
  exportCsv: string;
  sendToStatements: string;
  refreshSource: string;
  deleteSelected: string;
}

interface TableToolbarProps {
  columns: CustomTableColumn[];
  columnVisibility: Record<string, boolean>;
  onColumnVisibilityChange: (next: Record<string, boolean>) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  groupBy: string | null;
  onGroupByChange: (key: string | null) => void;
  selectedCount: number;
  exporting: boolean;
  onAddRow: () => void;
  onAddColumn: () => void;
  onImportFile: (file: File) => void;
  onExport: (format: 'xlsx' | 'csv') => void;
  onSendToStatements: () => void;
  /** Only for tables filled from app data. */
  onRefreshSource?: () => void;
  refreshing?: boolean;
  onDeleteSelected: () => void;
  /** Filter button and chips, rendered next to the search box. */
  filters?: React.ReactNode;
  labels: TableToolbarLabels;
}

const fill = (template: string, count: number) => template.replace('{{count}}', String(count));

function ColumnsMenu({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  labels,
}: Pick<
  TableToolbarProps,
  'columns' | 'columnVisibility' | 'onColumnVisibilityChange' | 'labels'
>) {
  const hidden = columns.filter(column => columnVisibility[column.key] === false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button">
          {labels.columns}
          {hidden.length ? <span className="lumio-grid__menu-count">{hidden.length}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map(column => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={columnVisibility[column.key] !== false}
            onCheckedChange={visible =>
              onColumnVisibilityChange({ ...columnVisibility, [column.key]: visible })
            }
          >
            {column.title}
          </DropdownMenuCheckboxItem>
        ))}
        {/* MUI Menu walks its children for focus; a Fragment hides them, so give it an array. */}
        {hidden.length
          ? [
              <DropdownMenuSeparator key="separator" />,
              <DropdownMenuItem key="show-all" onClick={() => onColumnVisibilityChange({})}>
                {labels.showAllColumns}
              </DropdownMenuItem>,
            ]
          : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Single-row toolbar: search on the left, actions on the right. */
export function TableToolbar(props: TableToolbarProps) {
  const { columns, searchQuery, groupBy, selectedCount, exporting, labels } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const groupable = columns.filter(column => column.type !== 'formula' && column.type !== 'ai');

  return (
    <div className="lumio-ct__toolbar">
      <label className="lumio-ct__search">
        <Search size={16} aria-hidden className="lumio-ct__search-icon" />
        <input
          type="search"
          className="lumio-ct__search-input"
          placeholder={labels.search}
          aria-label={labels.search}
          value={searchQuery}
          onChange={event => props.onSearchChange(event.target.value)}
        />
      </label>
      {props.filters}
      <div className="lumio-ct__actions">
        {selectedCount > 0 ? (
          <Button variant="destructive" size="sm" type="button" onClick={props.onDeleteSelected}>
            <Trash2 size={14} aria-hidden />
            {fill(labels.deleteSelected, selectedCount)}
          </Button>
        ) : null}
        <Select
          size="small"
          inputProps={{ 'aria-label': labels.groupBy }}
          value={groupBy ?? ''}
          onChange={next => props.onGroupByChange(next || null)}
          className="lumio-ct__group-select"
          options={[
            { value: '', label: labels.groupNone },
            ...groupable.map(column => ({ value: column.key, label: column.title })),
          ]}
        />
        <ColumnsMenu
          columns={columns}
          columnVisibility={props.columnVisibility}
          onColumnVisibilityChange={props.onColumnVisibilityChange}
          labels={labels}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          {labels.importFile}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={TABULAR_FILE_ACCEPT}
          hidden
          data-testid="ct-import-input"
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              props.onImportFile(file);
            }
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" type="button" disabled={exporting}>
              {labels.export}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => props.onExport('xlsx')}>
              {labels.exportXlsx}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => props.onExport('csv')}>
              {labels.exportCsv}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {props.onRefreshSource ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={props.refreshing}
            onClick={props.onRefreshSource}
          >
            {labels.refreshSource}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" type="button" onClick={props.onSendToStatements}>
          {labels.sendToStatements}
        </Button>
        <Button variant="outline" size="sm" type="button" onClick={props.onAddColumn}>
          {labels.addColumn}
        </Button>
        <Button size="sm" type="button" onClick={props.onAddRow}>
          {labels.addRow}
        </Button>
      </div>
    </div>
  );
}
