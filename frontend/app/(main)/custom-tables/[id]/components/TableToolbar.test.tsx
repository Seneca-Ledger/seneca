import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CustomTableColumn } from '../utils/types';
import { TableToolbar, type TableToolbarLabels } from './TableToolbar';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_, key: string) => ({ value: key, toString: () => key }) }),
}));

const labels: TableToolbarLabels = {
  addRow: 'Add row',
  addColumn: 'Add column',
  columns: 'Columns',
  showAllColumns: 'Show all',
  groupBy: 'Group by',
  groupNone: 'No grouping',
  importFile: 'Import file',
  export: 'Export',
  exportXlsx: 'Excel',
  exportCsv: 'CSV',
  sendToStatements: 'Send to statements',
  refreshSource: 'Refresh from source',
  deleteSelected: 'Delete {{count}}',
  view: 'View',
  more: 'More actions',
  fullscreen: 'Full screen',
  exitFullscreen: 'Exit full screen',
  clearSelection: 'Clear selection',
  searchHint: 'Hint',
  apply: 'Apply',
  addSummary: 'Add summary',
  restoreDefault: 'Restore to default',
};

const renderToolbar = (
  onRestoreDefault?: () => void,
  onToggleExpanded = vi.fn(),
  extra: Partial<React.ComponentProps<typeof TableToolbar>> = {},
) =>
  render(
    <TableToolbar
      columns={[]}
      columnVisibility={{}}
      onColumnVisibilityChange={vi.fn()}
      searchQuery=""
      onSearchChange={vi.fn()}
      groupBy={null}
      onGroupByChange={vi.fn()}
      selectedCount={0}
      exporting={false}
      expanded={false}
      onToggleExpanded={onToggleExpanded}
      onAddRow={vi.fn()}
      onAddColumn={vi.fn()}
      onAddSummary={vi.fn()}
      onImportFile={vi.fn()}
      onExport={vi.fn()}
      onSendToStatements={vi.fn()}
      onDeleteSelected={vi.fn()}
      onClearSelection={vi.fn()}
      onRestoreDefault={onRestoreDefault}
      labels={labels}
      {...extra}
    />,
  );

const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'More actions' }));

describe('TableToolbar restore to default', () => {
  it('offers Restore to default for a table filled from app data and calls it', () => {
    const onRestoreDefault = vi.fn();
    renderToolbar(onRestoreDefault);
    openMore();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Restore to default' }));
    expect(onRestoreDefault).toHaveBeenCalledTimes(1);
  });

  it('has no Restore to default for a table built by hand', () => {
    renderToolbar(undefined);
    openMore();
    expect(screen.getByRole('menuitem', { name: 'Add column' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Restore to default' })).toBeNull();
  });
});

describe('TableToolbar full screen', () => {
  it('toggles the expanded table from its own button', () => {
    const onToggleExpanded = vi.fn();
    renderToolbar(undefined, onToggleExpanded);
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });
});

describe('TableToolbar view panel', () => {
  const counterparty: CustomTableColumn = {
    id: 'column-1',
    key: 'counterparty',
    title: 'Counterparty',
    type: 'text',
    position: 0,
    config: null,
  };

  it('opens grouping and columns in a side panel and hides a column from it', () => {
    const onColumnVisibilityChange = vi.fn();
    renderToolbar(undefined, vi.fn(), { columns: [counterparty], onColumnVisibilityChange });

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    const panel = screen.getByRole('dialog', { name: 'View' });
    expect(panel).toHaveTextContent('Group by');
    expect(panel).toHaveTextContent('No grouping');

    const columnItems = screen.getAllByRole('menuitem', { name: counterparty.title });
    fireEvent.click(columnItems[columnItems.length - 1] as HTMLElement);
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ [counterparty.key]: false });
  });
});
