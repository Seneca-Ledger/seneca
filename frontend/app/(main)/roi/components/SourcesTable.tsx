'use client';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { ReturnsSource } from '../hooks/useReturns';
import { formatSignedPercent } from '../returns-display';

interface SourcesTableProps {
  /** Null while the returns load: rows of bars under the real header. */
  sources: ReturnsSource[] | null;
  formatMoney: (value: number) => string;
  sourceName: (source: ReturnsSource) => string;
}

/** On a phone the table keeps what answers "how is it doing": value, gain, return. */
const WIDE_ONLY = { display: { xs: 'none', sm: 'table-cell' } } as const;

const SKELETON_KEYS = ['row-0', 'row-1', 'row-2', 'row-3'];

/** Every line the page knows about, including the ones left out of the return. */
export function SourcesTable({ sources, formatMoney, sourceName }: SourcesTableProps) {
  const t = useIntlayer('roiPage');
  const { locale } = useLocale();

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table
        size="small"
        data-testid="returns-sources"
        sx={{ '& th, & td': { px: { xs: 0.75, sm: 2 } } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{t.colSource}</TableCell>
            <TableCell align="right">{t.colValue}</TableCell>
            <TableCell align="right" sx={WIDE_ONLY}>
              {t.colNetIn}
            </TableCell>
            <TableCell align="right" sx={WIDE_ONLY}>
              {t.colIncome}
            </TableCell>
            <TableCell align="right">{t.colGain}</TableCell>
            <TableCell align="right">{t.colReturn}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sources === null
            ? SKELETON_KEYS.map(key => (
                <TableRow key={key}>
                  <TableCell>
                    <Typography variant="body2">
                      <Skeleton variant="text" width="50%" />
                    </Typography>
                  </TableCell>
                  {[true, false, false, true, true].map((always, index) => (
                    <TableCell
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder columns
                      key={index}
                      align="right"
                      sx={always ? undefined : WIDE_ONLY}
                    >
                      <Skeleton variant="text" width={64} sx={{ ml: 'auto' }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : sources.map(source => (
                <TableRow key={`${source.kind}-${source.id}`}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {sourceName(source)}
                    </Typography>
                    {(source.scope === 'all_time' || !source.includedInReturn) && (
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {[
                          source.scope === 'all_time' ? t.allTime.value : null,
                          source.includedInReturn ? null : t.notInReturn.value,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">{formatMoney(source.endValue)}</TableCell>
                  <TableCell align="right" sx={WIDE_ONLY}>
                    {formatMoney(source.contributions - source.withdrawals)}
                  </TableCell>
                  <TableCell align="right" sx={WIDE_ONLY}>
                    {formatMoney(source.income)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        source.gain === 0
                          ? 'text.primary'
                          : source.gain > 0
                            ? 'var(--money-up)'
                            : 'var(--money-down)',
                    }}
                  >
                    {formatMoney(source.gain)}
                  </TableCell>
                  <TableCell align="right">
                    {formatSignedPercent(source.returnPercent, locale)}
                  </TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </Box>
  );
}
