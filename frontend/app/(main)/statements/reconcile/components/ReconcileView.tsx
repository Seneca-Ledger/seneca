'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import { type AgeingBucket, useReconciliation } from '../useReconciliation';

const BUCKETS: Array<{ key: AgeingBucket; label: string }> = [
  { key: 'current', label: 'bucketCurrent' },
  { key: 'd1_30', label: 'bucket1' },
  { key: 'd31_60', label: 'bucket2' },
  { key: 'd61_90', label: 'bucket3' },
  { key: 'd90_plus', label: 'bucket4' },
];

const card = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
  p: 3,
} as const;

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

const formatDate = (date: string): string =>
  formatStoredDateWithOptions(date, { day: 'numeric', month: 'short' });

export function ReconcileView(): React.JSX.Element {
  const t = useIntlayer('reconcilePage');
  const { locale } = useLocale();
  const { data, isPending, isFetching, error, confirm, confirming } = useReconciliation();
  const money = (value: number, currency?: string) =>
    formatMoney(value, currency ?? data?.currency ?? 'KZT', locale);

  return (
    // minmax(0, 1fr): grid items default to min-width: auto, and the ageing
    // table then pushed every card past the edge of a phone.
    <Box
      sx={{
        px: { xs: 2, md: 4 },
        py: 3,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: 3,
      }}
    >
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {t.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t.subtitle}
        </Typography>
      </Box>

      {isPending && <Skeleton variant="rounded" height={320} />}
      {error && (
        <Typography color="error" sx={{ py: 2, textAlign: 'center' }}>
          {t.error}
        </Typography>
      )}

      {data && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 3,
            opacity: isFetching ? 0.6 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <Box sx={card}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              {t.matches}
            </Typography>
            {data.matches.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t.noMatches}
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gap: 1 }}>
                {data.matches.map(match => (
                  <Box
                    key={`${match.itemId}:${match.transactionId}`}
                    data-testid={`match-${match.itemId}`}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'minmax(0, 1fr)',
                        md: 'minmax(0, 1fr) minmax(0, 1fr) auto',
                      },
                      gap: 1.5,
                      alignItems: 'center',
                      py: 1,
                      borderTop: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {match.item.vendor}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {match.item.direction === 'receivable' ? t.receivables : t.payables} ·{' '}
                        {money(match.item.amount, match.item.currency)} ·{' '}
                        {match.item.dueDate
                          ? fill(t.due.value, { date: formatDate(match.item.dueDate) })
                          : t.noDue}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2">
                        {match.transaction.counterpartyName ?? match.transaction.paymentPurpose}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(match.transaction.date)} ·{' '}
                        {money(match.transaction.amount, match.transaction.currency)} ·{' '}
                        {Math.round(match.confidence * 100)}%
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={confirming}
                      onClick={() => void confirm(match.itemId, match.transactionId)}
                    >
                      {t.confirm}
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <Box sx={card}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                {t.ageing}
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Box
                  component="table"
                  sx={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    '& th, & td': { pr: 1.5, whiteSpace: 'nowrap' },
                    '& th': { textAlign: 'left', py: 0.5, color: 'text.secondary', fontSize: 12 },
                    '& td': { py: 0.75, borderTop: 1, borderColor: 'divider', fontSize: 14 },
                  }}
                >
                  <thead>
                    <tr>
                      <th />
                      {BUCKETS.map(bucket => (
                        <th key={bucket.key}>{t[bucket.label as 'bucketCurrent']}</th>
                      ))}
                      <th>{t.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ageing.map(row => (
                      <tr key={row.direction}>
                        <td>{row.direction === 'receivable' ? t.receivables : t.payables}</td>
                        {BUCKETS.map(bucket => (
                          <td key={bucket.key}>{money(row.buckets[bucket.key])}</td>
                        ))}
                        <td>
                          <strong>{money(row.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </Box>
            </Box>

            <Box sx={card}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                {t.unmatched}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {fill(t.unmatchedRows.value, { count: String(data.unmatchedRowCount) })}
              </Typography>
              <Box sx={{ display: 'grid', gap: 0.5 }}>
                {data.unmatchedItems.slice(0, 20).map(item => (
                  <Typography key={item.id} variant="body2">
                    {item.vendor} · {money(item.amount, item.currency)} ·{' '}
                    {item.dueDate ? fill(t.due.value, { date: formatDate(item.dueDate) }) : t.noDue}
                  </Typography>
                ))}
              </Box>
            </Box>
          </Box>

          {data.duplicates.length > 0 && (
            <Box sx={card}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
                {t.duplicates}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {data.duplicates.map(group => (
                  <Chip
                    key={`${group.vendor}:${group.amount}`}
                    color="warning"
                    variant="outlined"
                    label={fill(t.duplicateRow.value, {
                      vendor: group.vendor,
                      amount: money(group.amount, group.currency),
                      count: String(group.itemIds.length),
                    })}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
