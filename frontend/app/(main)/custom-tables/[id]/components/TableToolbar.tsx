'use client';

import { useRef } from 'react';
import { StatementsSearchPopover } from '@/app/(main)/statements/components/filters/StatementsSearchPopover';
import { MoreHorizontal, Plus, SlidersHorizontal, Trash2, X } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { TABULAR_FILE_ACCEPT } from '../utils/tabularFileReader';
import type { CustomTableColumn } from '../utils/types';

export interface TableToolbarLabels {
  searchHint: string;
  apply: string;
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
  view: string;
  more: string;
  clearSelection: string;
  addSummary: string;
  restoreDefault: string;
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
  onAddSummary: () => void;
  /** Only for tables filled from app data: undo the table's app changes and rebuild it. */
  onRestoreDefault?: () => void;
  onImportFile: (file: File) => void;
  onExport: (format: 'xlsx' | 'csv') => void;
  onSendToStatements: () => void;
  /** Only for tables filled from app data. */
  onRefreshSource?: () => void;
  refreshing?: boolean;
  onDeleteSelected: () => void;
  onClearSelection: () => void;
  /** Filter button and chips, rendered next to the search box. */
  filters?: React.ReactNode;
  labels: TableToolbarLabels;
}

const fill = (template: string, count: number) => template.replace('{{count}}', String(count));

/** Grouping and column visibility, behind one quiet "View" button. */
function ViewMenu({
  columns,
  columnVisibility,
  onColumnVisibilityChange,
  groupBy,
  onGroupByChange,
  labels,
}: Pick<
  TableToolbarProps,
  | 'columns'
  | 'columnVisibility'
  | 'onColumnVisibilityChange'
  | 'groupBy'
  | 'onGroupByChange'
  | 'labels'
>) {
  const hidden = columns.filter(column => columnVisibility[column.key] === false);
  const groupable = columns.filter(column => column.type !== 'formula' && column.type !== 'ai');
  const changes = hidden.length + (groupBy ? 1 : 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" type="button">
          <SlidersHorizontal size={16} aria-hidden />
          {labels.view}
          {changes ? <span className="lumio-grid__menu-count">{changes}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      {/* MUI Menu walks its children for focus; a Fragment hides them, so give it arrays. */}
      <DropdownMenuContent align="end" className="lumio-ct__view-menu">
        <DropdownMenuLabel>{labels.groupBy}</DropdownMenuLabel>
        {[{ key: '', title: labels.groupNone }, ...groupable].map(column => (
          <DropdownMenuCheckboxItem
            key={`group-${column.key}`}
            checked={(groupBy ?? '') === column.key}
            onCheckedChange={() => onGroupByChange(column.key || null)}
          >
            {column.title}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{labels.columns}</DropdownMenuLabel>
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

/** Rarely used actions: import, export, sync and schema changes. */
function MoreMenu({
  exporting,
  refreshing,
  onImport,
  onExport,
  onRefreshSource,
  onSendToStatements,
  onAddColumn,
  onAddSummary,
  onRestoreDefault,
  labels,
}: Pick<
  TableToolbarProps,
  | 'exporting'
  | 'refreshing'
  | 'onExport'
  | 'onRefreshSource'
  | 'onSendToStatements'
  | 'onAddColumn'
  | 'onAddSummary'
  | 'onRestoreDefault'
  | 'labels'
> & { onImport: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" type="button" aria-label={labels.more}>
          <MoreHorizontal size={18} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onImport}>{labels.importFile}</DropdownMenuItem>
        {onRefreshSource ? (
          <DropdownMenuItem disabled={refreshing} onClick={onRefreshSource}>
            {labels.refreshSource}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onSendToStatements}>{labels.sendToStatements}</DropdownMenuItem>
        <DropdownMenuItem onClick={onAddColumn}>{labels.addColumn}</DropdownMenuItem>
        <DropdownMenuItem onClick={onAddSummary}>{labels.addSummary}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{labels.export}</DropdownMenuLabel>
        <DropdownMenuItem disabled={exporting} onClick={() => onExport('xlsx')}>
          {labels.exportXlsx}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={exporting} onClick={() => onExport('csv')}>
          {labels.exportCsv}
        </DropdownMenuItem>
        {/* MUI Menu walks its children for focus; a Fragment hides them, so give it an array. */}
        {onRestoreDefault
          ? [
              <DropdownMenuSeparator key="restore-separator" />,
              <DropdownMenuItem
                key="restore"
                className="lumio-ct__menu-item--danger"
                onClick={onRestoreDefault}
              >
                {labels.restoreDefault}
              </DropdownMenuItem>,
            ]
          : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Single-row toolbar: the search button and filters on the left, View, the "···" menu and
 * Add row on the right. With rows selected the right side turns into the
 * selection actions.
 */
const GHOST_TOOLBAR_BUTTON: React.CSSProperties = {
  border: '1px solid transparent',
  background: 'transparent',
  fontWeight: 500,
  minHeight: 32,
  padding: '4px 10px',
};

export function TableToolbar(props: TableToolbarProps) {
  const { searchQuery, selectedCount, labels } = props;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="lumio-ct__toolbar">
      <StatementsSearchPopover
        value={searchQuery}
        onApply={props.onSearchChange}
        applyLabel={labels.apply}
        hint={labels.searchHint}
        // Ghost, like Filter, View and "…" beside it: only Add row is filled.
        buttonStyle={GHOST_TOOLBAR_BUTTON}
      />
      {props.filters}
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
      {selectedCount > 0 ? (
        <div className="lumio-ct__actions">
          <Button variant="destructive" size="sm" type="button" onClick={props.onDeleteSelected}>
            <Trash2 size={14} aria-hidden />
            {fill(labels.deleteSelected, selectedCount)}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label={labels.clearSelection}
            onClick={props.onClearSelection}
          >
            <X size={16} aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="lumio-ct__actions">
          <ViewMenu
            columns={props.columns}
            columnVisibility={props.columnVisibility}
            onColumnVisibilityChange={props.onColumnVisibilityChange}
            groupBy={props.groupBy}
            onGroupByChange={props.onGroupByChange}
            labels={labels}
          />
          <MoreMenu
            exporting={props.exporting}
            refreshing={props.refreshing}
            onImport={() => fileInputRef.current?.click()}
            onExport={props.onExport}
            onRefreshSource={props.onRefreshSource}
            onSendToStatements={props.onSendToStatements}
            onAddColumn={props.onAddColumn}
            onAddSummary={props.onAddSummary}
            onRestoreDefault={props.onRestoreDefault}
            labels={labels}
          />
          <Button size="sm" type="button" onClick={props.onAddRow}>
            <Plus size={18} aria-hidden />
            {labels.addRow}
          </Button>
        </div>
      )}
    </div>
  );
}
