'use client';

import Skeleton from '@mui/material/Skeleton';
import { DataGridSkeleton } from '@/app/components/data-grid';
import { ArrowLeft } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import type { DetailLabels } from '../labels';
import { FilterBar } from './FilterBar';
import { ROW_HEIGHT } from './TableGrid';
import { TableToolbar } from './TableToolbar';

/** Column count guessed for the skeleton before the table's columns arrive. */
const SKELETON_COLUMNS = 5;

const noop = () => undefined;

/**
 * The table page before the table arrives: the real back button and toolbar,
 * the title and its meta line waiting, and the grid as placeholder rows.
 */
export function TableLoading({
  rows,
  labels,
  onBack,
}: {
  rows: number;
  labels: DetailLabels;
  onBack: () => void;
}) {
  return (
    <div className="seneca-ct seneca-ct--fill" aria-busy>
      <header className="seneca-ct__header">
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={onBack}
          className="seneca-ct__back"
          aria-label={labels.header.back}
          title={labels.header.back}
        >
          <ArrowLeft size={18} aria-hidden />
        </Button>
        <div className="seneca-ct__title-row">
          <h1 className="seneca-ct__title">
            <Skeleton variant="text" width={160} />
          </h1>
          <p className="seneca-ct__meta">
            <Skeleton variant="text" width={110} />
          </p>
        </div>
        {/* The real controls; until the table arrives there is nothing for them to act on. */}
        <TableToolbar
          columns={[]}
          columnVisibility={{}}
          onColumnVisibilityChange={noop}
          searchQuery=""
          onSearchChange={noop}
          groupBy={null}
          onGroupByChange={noop}
          selectedCount={0}
          exporting={false}
          expanded={false}
          onToggleExpanded={noop}
          onAddRow={noop}
          onAddColumn={noop}
          onAddSummary={noop}
          onImportFile={noop}
          onExport={noop}
          onSendToStatements={noop}
          onDeleteSelected={noop}
          onClearSelection={noop}
          labels={labels.toolbar}
          filters={
            <FilterBar
              columns={[]}
              filters={[]}
              onAdd={noop}
              onRemove={noop}
              onClear={noop}
              labels={labels.filters}
            />
          }
        />
      </header>
      <DataGridSkeleton
        rows={rows}
        columns={SKELETON_COLUMNS}
        rowHeight={ROW_HEIGHT}
        className="seneca-ct__grid"
      />
    </div>
  );
}
