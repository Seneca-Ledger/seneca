'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { TextTabs } from '@/app/components/ui/text-tabs';
import type { Transaction } from '../editHelpers';
import { groupByPayee, needsCategory, unnamedRows } from '../helpers/payee-groups';
import { EditTransactionsTable, type EditTransactionsTableProps } from './EditTransactionsTable';
import { PayeeGroupsTable } from './PayeeGroupsTable';
import { SuggestionsHint, useSuggestionsHint } from './SuggestionsHint';

type View = 'rows' | 'payees';

type StatementRowsSectionProps = EditTransactionsTableProps & {
  /** Opens the category drawer for these rows. */
  onPickRows: (rows: Transaction[]) => void;
};

function text(labels: EditTransactionsTableProps['labels'], key: string, fallback: string): string {
  return labels[key]?.value ?? fallback;
}

/**
 * The statement's rows, or the same rows by payee. While something waits for a
 * category the page opens on payees: a pick there files all of a payee's rows.
 * Once the person picks a view it stays.
 */
export function StatementRowsSection({
  onPickRows,
  ...tableProps
}: StatementRowsSectionProps): React.ReactElement {
  const { transactions, labels, columns, locale, formatNumber } = tableProps;
  const [picked, setPicked] = useState<View | null>(null);
  const groups = groupByPayee(transactions);
  const toFile = groups.filter(group => group.unfiled > 0).length;
  const view: View = picked ?? (toFile > 0 ? 'payees' : 'rows');
  const payeesLabel = text(labels, 'viewByPayee', 'By payee');
  const unfiled = transactions.filter(needsCategory);
  const unnamed = unnamedRows(transactions);
  const hint = useSuggestionsHint();
  const unfiledTotal = unfiled.reduce(
    (sum, row) => sum + (Number(row.credit) || 0) - (Number(row.debit) || 0),
    0,
  );

  return (
    <Box>
      {hint.open ? (
        <SuggestionsHint
          onClose={hint.close}
          labels={{
            title: text(labels, 'hintTitle', 'You will not fill this in every time'),
            suggested: text(
              labels,
              'hintSuggested',
              'Dashed categories are suggestions. Check them and accept them all at once.',
            ),
            learns: text(
              labels,
              'hintLearns',
              'Every choice you make is remembered: the next statements arrive mostly filed.',
            ),
            gaps: text(
              labels,
              'hintGaps',
              'A row with no suggestion is normal: the bank did not say who was paid. Only you know what the money was for, and you need not file everything.',
            ),
            gotIt: text(labels, 'hintGotIt', 'Got it'),
          }}
        />
      ) : null}
      <Box
        sx={{
          mb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <TextTabs
          value={view}
          onChange={setPicked}
          ariaLabel={text(labels, 'viewSwitch', 'Show rows')}
          options={[
            { value: 'rows', label: text(labels, 'viewRows', 'Rows') },
            {
              value: 'payees',
              label: toFile > 0 ? `${payeesLabel} · ${toFile}` : payeesLabel,
            },
          ]}
        />
        {hint.open ? null : (
          <Button
            size="small"
            variant="text"
            onClick={hint.show}
            sx={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-muted)' }}
          >
            {text(labels, 'hintShow', 'How categories get filled')}
          </Button>
        )}
      </Box>
      {view === 'payees' ? (
        <PayeeGroupsTable
          groups={groups}
          locale={locale}
          formatNumber={formatNumber}
          labels={{
            payee: text(labels, 'payeeColumn', 'Payee'),
            rows: text(labels, 'rowsColumn', 'Rows'),
            amount: columns.amount?.value ?? 'Amount',
            category: columns.category?.value ?? 'Category',
            mixed: text(labels, 'mixedCategories', 'Mixed'),
            suggested: text(labels, 'suggestedCategory', 'Suggested'),
            noCategory: text(labels, 'noCategoryOption', 'No category'),
            assignCategory: text(labels, 'assignCategory', 'Assign category'),
          }}
          onPick={group => {
            setPicked('payees');
            onPickRows(group.rows);
          }}
        />
      ) : (
        <EditTransactionsTable {...tableProps} />
      )}
      {/* Rows the bank printed no payee for are different shops: filed one by one. */}
      {view === 'payees' && unnamed.length > 0 ? (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {text(
              labels,
              'unnamedRows',
              '{count} rows name no payee: the bank printed only the kind of operation',
            ).replace('{count}', String(unnamed.length))}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => setPicked('rows')}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {text(labels, 'fileUnnamedInRows', 'File them in Rows')}
          </Button>
        </Box>
      ) : null}
      {/* The tail: what is left after the big payees, filed with one pick. */}
      {view === 'payees' && unfiled.length > 1 ? (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ color: 'var(--text-muted)' }}>
            {text(labels, 'restToFile', '{count} rows still without a category').replace(
              '{count}',
              String(unfiled.length),
            )}
            {' · '}
            <span className={PRIVATE_CLASS}>
              {unfiledTotal < 0
                ? `−${formatNumber(-unfiledTotal)}`
                : `+${formatNumber(unfiledTotal)}`}
            </span>
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              setPicked('payees');
              onPickRows(unfiled);
            }}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            {text(labels, 'fileRestAtOnce', 'File them all at once')}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
