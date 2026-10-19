'use client';

import { Copy } from '@/app/components/icons';
import { Spinner } from '@/app/components/ui/spinner';

interface StatementsDuplicateGroupProps {
  loading: boolean;
  duplicateStatementIds: string[];
  selectDuplicatesLabel: string;
  onSelectDetectedDuplicates: () => void;
}

export function StatementsDuplicateGroup({
  loading,
  duplicateStatementIds,
  selectDuplicatesLabel,
  onSelectDetectedDuplicates,
}: StatementsDuplicateGroupProps): React.JSX.Element | null {
  if (!loading && duplicateStatementIds.length === 0) {
    return null;
  }

  return (
    <button
      type="button"
      className="seneca-stmt-list-view__duplicate-chip"
      onClick={onSelectDetectedDuplicates}
      disabled={loading || duplicateStatementIds.length === 0}
    >
      <Copy size={14} />
      {selectDuplicatesLabel}
      <span className="seneca-stmt-list-view__duplicate-count">
        {loading ? <Spinner size={12} /> : duplicateStatementIds.length}
      </span>
    </button>
  );
}
