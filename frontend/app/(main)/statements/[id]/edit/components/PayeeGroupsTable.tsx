'use client';

import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import type { PayeeGroup } from '../helpers/payee-groups';
import { CategoryChip } from './CategoryChip';

const CELL_HEADER_SX = {
  fontWeight: 400,
  fontSize: 13,
  color: 'var(--text-muted)',
} as const;

export type PayeeGroupsLabels = {
  payee: string;
  rows: string;
  amount: string;
  category: string;
  mixed: string;
  /** Read out before a suggested category: "Suggested". */
  suggested: string;
  noCategory: string;
  assignCategory: string;
};

type PayeeGroupsTableProps = {
  groups: PayeeGroup[];
  locale: string;
  formatNumber: (n?: number | null) => string;
  labels: PayeeGroupsLabels;
  onPick: (group: PayeeGroup) => void;
};

/**
 * The statement by payee: one pick files every row of a payee, here and, through
 * the payee's history, in the statements that come next. Payees still to file
 * lead, the busiest first.
 */
export function PayeeGroupsTable({
  groups,
  locale,
  formatNumber,
  labels,
  onPick,
}: PayeeGroupsTableProps): React.ReactElement {
  return (
    <TableContainer
      component={Paper}
      elevation={0}
      className="seneca-stmt-edit-table"
      sx={{ border: '1px solid', borderColor: 'divider', overflowX: 'auto' }}
    >
      <Table size="small">
        <TableHead>
          <TableRow sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
            <TableCell sx={CELL_HEADER_SX}>{labels.payee}</TableCell>
            <TableCell align="right" sx={CELL_HEADER_SX}>
              {labels.rows}
            </TableCell>
            <TableCell align="right" sx={CELL_HEADER_SX}>
              {labels.amount}
            </TableCell>
            <TableCell sx={CELL_HEADER_SX}>{labels.category}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map(group => (
            <TableRow
              key={group.key}
              hover
              onClick={() => onPick(group)}
              sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'var(--surface-soft)' } }}
            >
              <TableCell sx={{ minWidth: 200 }}>{group.name}</TableCell>
              <TableCell
                align="right"
                sx={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)' }}
              >
                {group.rows.length}
              </TableCell>
              <TableCell
                align="right"
                className={PRIVATE_CLASS}
                sx={{
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                  color: group.total > 0 ? 'var(--money-up)' : 'var(--foreground)',
                }}
              >
                {group.total > 0
                  ? `+${formatNumber(group.total)}`
                  : group.total < 0
                    ? `−${formatNumber(-group.total)}`
                    : '—'}
              </TableCell>
              <TableCell sx={{ minWidth: 150 }}>
                <CategoryChip
                  category={group.category}
                  locale={locale}
                  noCategoryLabel={labels.noCategory}
                  assignCategoryLabel={labels.assignCategory}
                  label={group.unfiled === 0 && !group.category ? labels.mixed : undefined}
                  suggestedLabel={
                    group.category && group.suggested === group.rows.length
                      ? labels.suggested
                      : undefined
                  }
                  onClick={() => onPick(group)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
