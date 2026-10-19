'use client';

import { AppPagination } from '../ui/pagination';
import { Select } from '../ui/select';

interface TransactionPaginationProps {
  page: number;
  rowsPerPage: number;
  totalPages: number;
  totalCount: number;
  rowsPerPageLabel: string;
  ofLabel: string;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

const PAGE_SIZES = [10, 25, 50, 100] as const;

export function TransactionPagination({
  page,
  rowsPerPage,
  totalPages,
  totalCount,
  rowsPerPageLabel,
  ofLabel,
  onPageChange,
  onRowsPerPageChange,
}: TransactionPaginationProps): React.ReactElement {
  const start = page * rowsPerPage + 1;
  const end = Math.min((page + 1) * rowsPerPage, totalCount);

  return (
    <div className="seneca-tx-pagination">
      <div className="seneca-tx-pagination__left">
        <span style={{ fontSize: 14, color: 'var(--foreground)' }}>{rowsPerPageLabel}</span>
        <Select
          size="small"
          value={rowsPerPage}
          onChange={value => {
            onRowsPerPageChange(Number(value));
            onPageChange(0);
          }}
          options={PAGE_SIZES.map(n => ({ value: n, label: String(n) }))}
        />
      </div>
      <div className="seneca-tx-pagination__right">
        <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
          {start}–{end} {ofLabel} {totalCount}
        </span>
        <AppPagination page={page + 1} total={totalPages} onChange={p => onPageChange(p - 1)} />
      </div>
    </div>
  );
}
