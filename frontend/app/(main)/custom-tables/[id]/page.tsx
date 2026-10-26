'use client';

import { Skeleton } from '@mui/material';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ConfirmModal from '@/app/components/ConfirmModal';
import { DataGridSkeleton } from '@/app/components/data-grid';
import { Plus } from '@/app/components/icons';
import { ImportSuggestionBanner } from '@/app/components/import-wizard/ImportSuggestionBanner';
import { useQuickActions } from '@/app/components/mobile/quick-actions-store';
import { Button } from '@/app/components/ui/button';
import { rememberRowCount, useSkeletonRows } from '../rowCountMemory';
import { ColumnDialog } from './components/ColumnDialog';
import { FilterBar } from './components/FilterBar';
import { GroupSummary } from './components/GroupSummary';
import { ImportPreviewDialog } from './components/ImportPreviewDialog';
import { SendToStatementsDialog } from './components/SendToStatementsDialog';
import { SummariesBar, type SummaryDraft } from './components/SummariesBar';
import { ROW_HEIGHT, TableGrid } from './components/TableGrid';
import { TablePageHeader } from './components/TablePageHeader';
import { TableToolbar } from './components/TableToolbar';
import { type CustomTablePageState, useCustomTablePage } from './hooks/useCustomTablePage';

/** Column count guessed for the skeleton before the table's columns arrive. */
const SKELETON_COLUMNS = 5;

function LoadingSkeleton({ rows }: { rows: number }) {
  return (
    <div className="seneca-ct" aria-busy>
      <div className="seneca-ct__header">
        <Skeleton variant="circular" width={32} height={32} />
        <div className="seneca-ct__title-row">
          <Skeleton variant="text" width={240} height={36} />
          <Skeleton variant="text" width={160} height={22} />
        </div>
        <Skeleton variant="rounded" width={360} height={36} />
      </div>
      <DataGridSkeleton
        rows={rows}
        columns={SKELETON_COLUMNS}
        rowHeight={ROW_HEIGHT}
        className="seneca-ct__grid"
      />
    </div>
  );
}

function Dialogs({ state }: { state: CustomTablePageState }) {
  const { labels, pendingDelete, selectedIds } = state;
  const deleteLabels = pendingDelete?.kind === 'column' ? labels.deleteColumn : labels.deleteRows;
  const deleteMessage =
    pendingDelete?.kind === 'column'
      ? deleteLabels.message.replace('{{name}}', pendingDelete.column?.title ?? '')
      : deleteLabels.message.replace('{{count}}', String(selectedIds.length));
  return (
    <>
      <ColumnDialog
        state={state.columnEditor.dialog}
        draft={state.columnEditor.draft}
        setDraft={state.columnEditor.setDraft}
        saving={state.columnEditor.saving}
        tableId={state.data.table?.id ?? null}
        columns={state.columns}
        relationTargets={state.relationTargets}
        onSave={() => void state.columnEditor.save()}
        onClose={state.columnEditor.close}
        labels={labels.columnDialog}
      />
      <ImportPreviewDialog
        paste={state.paste}
        columns={state.columns}
        labels={labels.import}
        typeLabels={labels.columnDialog.types}
        banner={
          <ImportSuggestionBanner
            rows={state.paste.pasteRawRows}
            enabled={state.paste.pastePreviewOpen}
            onImported={() => state.paste.resetPastePreview()}
          />
        }
      />
      <SendToStatementsDialog
        open={state.convert.open}
        busy={state.convert.busy}
        result={state.convert.result}
        onConfirm={() => void state.runConvert()}
        onClose={() => state.setConvert({ open: false, busy: false, result: null })}
        onOpenStatement={id => state.router.push(`/statements/${id}/edit`)}
        onOpenDashboard={() => state.router.push('/dashboard')}
        labels={labels.convert}
      />
      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => state.setPendingDelete(null)}
        onConfirm={() => void state.confirmDelete()}
        title={deleteLabels.title}
        message={deleteMessage}
        confirmText={deleteLabels.confirm}
        cancelText={deleteLabels.cancel}
        isDestructive
      />
      <ConfirmModal
        isOpen={state.restoreOpen}
        onClose={() => state.setRestoreOpen(false)}
        onConfirm={() => void state.runRestoreDefault()}
        title={labels.restore.title}
        message={labels.restore.message}
        confirmText={labels.restore.confirm}
        cancelText={labels.restore.cancel}
        isDestructive
        isLoading={state.restoring}
        manualClose
      />
    </>
  );
}

function TablePage({ state, skeletonRows }: { state: CustomTablePageState; skeletonRows: number }) {
  const { labels, data, columns, filters, grid, groups } = state;
  const [summaryDraft, setSummaryDraft] = useState<SummaryDraft | null>(null);
  const [newRowId, setNewRowId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const addRow = () => setNewRowId(state.mutations.createRow()?.id ?? null);
  useQuickActions([{ id: 'add-row', label: labels.toolbar.addRow, icon: Plus, run: addRow }]);
  const table = data.table;

  // Esc collapses the table, unless a dialog or menu is open and takes the key itself.
  useEffect(() => {
    if (!expanded) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
      ) {
        setExpanded(false);
      }
    };
    // In browser full screen Esc belongs to the browser: it leaves full screen, and so does the table.
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setExpanded(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };
  }, [expanded]);

  // The whole document goes full screen, not the table: menus and dialogs portal to <body>
  // and would stay hidden behind a full-screen table. Where the browser refuses (iOS Safari,
  // an iframe), the table still covers the app window.
  const toggleExpanded = () => {
    if (!expanded) {
      document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
    setExpanded(value => !value);
  };

  // The grid measures its height from the window; tell it the page just moved.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `expanded` is the trigger
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [expanded]);

  if (!table) {
    return null;
  }
  const groupColumn = state.groupBy ? columns.find(c => c.key === state.groupBy) : undefined;
  return (
    <div className={`seneca-ct seneca-ct--fill${expanded ? ' seneca-ct--expanded' : ''}`}>
      <TablePageHeader
        table={table}
        total={grid.total}
        moneyTotal={state.moneyTotal}
        onBack={() => state.router.push('/custom-tables')}
        onRename={state.rename}
        labels={labels.header}
        actions={
          <TableToolbar
            columns={columns}
            columnVisibility={state.columnVisibility}
            onColumnVisibilityChange={state.setColumnVisibility}
            searchQuery={filters.searchQuery}
            onSearchChange={filters.setSearchQuery}
            groupBy={state.groupBy}
            onGroupByChange={state.setGroupBy}
            selectedCount={state.selectedIds.length}
            exporting={state.exporting}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onAddRow={addRow}
            onAddColumn={state.columnEditor.openAdd}
            onAddSummary={() => setSummaryDraft({ title: '', expression: '' })}
            onImportFile={file => void state.paste.startFileImport(file)}
            onExport={format => void state.exportView(format)}
            onSendToStatements={() => state.setConvert({ open: true, busy: false, result: null })}
            onRefreshSource={table.sourceBinding ? () => void state.runRefreshSource() : undefined}
            refreshing={state.refreshing}
            onDeleteSelected={() => state.setPendingDelete({ kind: 'rows' })}
            onClearSelection={() => state.setRowSelection({})}
            onRestoreDefault={table.sourceBinding ? () => state.setRestoreOpen(true) : undefined}
            labels={labels.toolbar}
            filters={
              <FilterBar
                columns={columns}
                filters={filters.filters}
                onAdd={filters.addFilter}
                onRemove={filters.removeFilter}
                onClear={filters.clearFilters}
                labels={labels.filters}
              />
            }
          />
        }
      />
      {groupColumn ? (
        <GroupSummary
          groupColumn={groupColumn}
          columns={columns}
          groups={groups.groups}
          loading={groups.loading}
          fallbackCurrency={state.defaultCurrency}
          onPick={state.pickGroup}
          labels={labels.groups}
        />
      ) : null}
      <TableGrid
        columns={columns}
        rows={grid.rows}
        loading={grid.loadingRows}
        skeletonRows={skeletonRows}
        hasMore={grid.hasMore}
        fallbackCurrency={state.defaultCurrency}
        sourceKind={table.sourceBinding?.kind ?? null}
        sorting={state.sorting}
        onSortingChange={state.setSorting}
        rowSelection={state.rowSelection}
        onRowSelectionChange={state.setRowSelection}
        columnVisibility={state.columnVisibility}
        onColumnVisibilityChange={state.setColumnVisibility}
        aggregates={state.aggregates}
        aggregateValues={state.aggregateValues}
        onAggregateChange={state.setAggregate}
        onUpdateCell={state.mutations.updateCell}
        onAddRow={addRow}
        revealRowId={newRowId}
        onLoadMore={() => void grid.loadRows()}
        onEditColumn={state.columnEditor.openEdit}
        onDeleteColumn={column => state.setPendingDelete({ kind: 'column', column })}
        labels={labels.grid}
      />
      <SummariesBar
        tableId={table.id}
        columns={columns}
        items={state.summaries.items}
        saving={state.summaries.saving}
        onUpsert={state.summaries.upsert}
        onRemove={state.summaries.remove}
        draft={summaryDraft}
        onDraftChange={setSummaryDraft}
        labels={labels.summaries}
      />
      <Dialogs state={state} />
    </div>
  );
}

export default function CustomTableDetailPage() {
  const params = useParams<{ id: string }>();
  const state = useCustomTablePage(params.id);
  const skeletonRows = useSkeletonRows(params.id);
  const { total, loadingRows } = state.grid;
  const unfiltered = !state.filters.filtersParam;
  // Remember the unfiltered row count so the next visit's skeleton matches it.
  useEffect(() => {
    if (total !== null && unfiltered && !loadingRows) {
      rememberRowCount(params.id, total);
    }
  }, [params.id, total, unfiltered, loadingRows]);

  if (state.data.loading && !state.data.table) {
    return <LoadingSkeleton rows={skeletonRows} />;
  }
  if (!state.data.table) {
    return (
      <div className="seneca-ct">
        <p>{state.labels.notFound.title}</p>
        <Button variant="outline" type="button" onClick={() => state.router.push('/custom-tables')}>
          {state.labels.notFound.back}
        </Button>
      </div>
    );
  }
  return <TablePage state={state} skeletonRows={skeletonRows} />;
}
