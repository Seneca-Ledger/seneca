import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
  clearSelection: 'Clear selection',
  searchHint: 'Hint',
  apply: 'Apply',
  addSummary: 'Add summary',
  restoreDefault: 'Restore to default',
};

const renderToolbar = (onRestoreDefault?: () => void) =>
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
