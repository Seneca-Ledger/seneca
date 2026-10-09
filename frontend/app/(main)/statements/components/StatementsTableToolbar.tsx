'use client';

import type React from 'react';
import { FromFilterDropdown } from '@/app/(main)/statements/components/filters/FromFilterDropdown';
import type { StatementFilters } from '@/app/(main)/statements/components/filters/statement-filters';
import { ChevronDown, Columns2, Copy } from '@/app/components/icons';
import { StatementsToolbarButton } from './StatementsToolbarButton';

// Mirrors FromFilterDropdown's own option shape.
interface FromOption {
  id: string;
  label: string;
  description?: string | null;
  avatarUrl?: string | null;
  iconUrl?: string | null;
  bankName?: string | null;
}

type Props = {
  loading: boolean;
  draftFilters: StatementFilters;
  fromOptions: FromOption[];
  fromDropdownOpen: boolean;
  duplicateStatementIds: string[];
  labels: {
    from: string;
    columns: string;
    apply: string;
    reset: string;
    selectDuplicates: string;
  };
  onFromDropdownChange: (open: boolean) => void;
  onUpdateFilters: (patch: Partial<StatementFilters>) => void;
  onApplyFrom: () => void;
  onResetFrom: () => void;
  onSelectDetectedDuplicates: () => void;
  onColumnsOpen: () => void;
};

/** The list's own toolbar, inside the white block the rows live in: the From
 *  filter on the left edge, the column picker on the right. */
export function StatementsTableToolbar({
  loading,
  draftFilters,
  fromOptions,
  fromDropdownOpen,
  duplicateStatementIds,
  labels,
  onFromDropdownChange,
  onUpdateFilters,
  onApplyFrom,
  onResetFrom,
  onSelectDetectedDuplicates,
  onColumnsOpen,
}: Props): React.JSX.Element {
  return (
    <div className="lumio-stmt-list-view__table-toolbar">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          minWidth: 0,
        }}
      >
        <FromFilterDropdown
          open={fromDropdownOpen}
          onOpenChange={onFromDropdownChange}
          options={fromOptions}
          values={draftFilters.from}
          onChange={values => onUpdateFilters({ from: values })}
          onApply={onApplyFrom}
          onReset={onResetFrom}
          trigger={
            <StatementsToolbarButton>
              {draftFilters.from.length > 0
                ? `${labels.from} (${draftFilters.from.length})`
                : labels.from}
              <ChevronDown size={14} />
            </StatementsToolbarButton>
          }
          applyLabel={labels.apply}
          resetLabel={labels.reset}
        />

        {/* Not shown while loading: an orange chip flashing in and out on every
            refetch reads as a warning even when there are no duplicates. */}
        {!loading && duplicateStatementIds.length > 0 ? (
          <button
            type="button"
            className="lumio-stmt-list-view__duplicate-chip"
            onClick={onSelectDetectedDuplicates}
          >
            <Copy size={14} />
            {labels.selectDuplicates}
            <span className="lumio-stmt-list-view__duplicate-count">
              {duplicateStatementIds.length}
            </span>
          </button>
        ) : null}
      </div>

      <StatementsToolbarButton onClick={onColumnsOpen}>
        <Columns2 size={14} />
        {labels.columns}
      </StatementsToolbarButton>
    </div>
  );
}
