'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type React from 'react';
import type { CryptoGains } from '../hooks/useCrypto';

type GainsCardLabels = {
  title: string;
  hint: string;
  empty: string;
  allYears: string;
  asset: string;
  sold: string;
  acquired: string;
  amount: string;
  proceeds: string;
  cost: string;
  gain: string;
  heldDays: string;
  exportCsv: string;
  basisIncomplete: string;
  basisIncompleteHint: string;
};

type GainsCardProps = {
  gains: CryptoGains;
  year: number | null;
  years: number[];
  labels: GainsCardLabels;
  locale: string;
  money: (value: number) => string;
  onYearChange: (year: number | null) => void;
};

const numberCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

/**
 * Every sale against the purchase it consumed — the rows a capital gains return
 * is built from. The holding period is shown and not judged: whether a year makes
 * a gain tax-free is a question for the user's own tax authority.
 */
export function GainsCard({
  gains,
  year,
  years,
  labels,
  locale,
  money,
  onYearChange,
}: GainsCardProps): React.JSX.Element {
  const download = (): void => {
    const header = [
      'asset',
      'sold',
      'acquired',
      'amount',
      'proceeds',
      'cost',
      'gain',
      'heldDays',
      // What no purchase backs travels with the row: a return built from this
      // file must not read a missing cost as a zero one.
      'uncoveredAmount',
      'uncoveredProceeds',
    ];
    const rows = gains.disposals.map(disposal =>
      [
        disposal.asset,
        disposal.date,
        disposal.acquiredOn ?? '',
        disposal.amount,
        disposal.proceeds,
        disposal.cost,
        disposal.gain,
        disposal.heldDays ?? '',
        disposal.uncoveredAmount,
        disposal.uncoveredProceeds,
      ].join(','),
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crypto-gains-${year ?? 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            {labels.title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {labels.hint}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            select
            size="small"
            value={year === null ? 'all' : String(year)}
            onChange={event =>
              onYearChange(event.target.value === 'all' ? null : Number(event.target.value))
            }
            slotProps={{ htmlInput: { 'aria-label': labels.title } }}
          >
            <MenuItem value="all">{labels.allYears}</MenuItem>
            {years.map(option => (
              <MenuItem key={option} value={String(option)}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            variant="outlined"
            disabled={gains.disposals.length === 0}
            onClick={download}
          >
            {labels.exportCsv}
          </Button>
        </Box>
      </Box>

      {gains.disposals.some(disposal => disposal.costIncomplete) && (
        <Typography
          variant="caption"
          sx={{ color: 'var(--ff-dash-critical)', display: 'block', mt: 1.5 }}
        >
          {labels.basisIncompleteHint}
        </Typography>
      )}

      {gains.disposals.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          {labels.empty}
        </Typography>
      ) : (
        <Box sx={{ overflowX: 'auto', mt: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{labels.asset}</TableCell>
                <TableCell>{labels.sold}</TableCell>
                <TableCell>{labels.acquired}</TableCell>
                <TableCell align="right">{labels.amount}</TableCell>
                <TableCell align="right">{labels.proceeds}</TableCell>
                <TableCell align="right">{labels.cost}</TableCell>
                <TableCell align="right">{labels.heldDays}</TableCell>
                <TableCell align="right">{labels.gain}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {gains.disposals.map(disposal => (
                <TableRow
                  // The id carries the sale's place in the report: two sales of the
                  // same coin, the same size, on the same day are two sales, and a
                  // key made of those fields alone would collide and drop one.
                  key={disposal.id}
                  sx={{ '&:last-child td': { borderBottom: 0 } }}
                >
                  <TableCell sx={{ fontWeight: 600 }}>
                    {disposal.asset}
                    {disposal.costIncomplete && (
                      <Typography
                        component="div"
                        variant="caption"
                        sx={{ color: 'var(--ff-dash-critical)', fontWeight: 400 }}
                      >
                        {labels.basisIncomplete}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={numberCell}>
                    {new Date(disposal.date).toLocaleDateString(locale)}
                  </TableCell>
                  <TableCell sx={{ ...numberCell, color: 'text.secondary' }}>
                    {disposal.acquiredOn
                      ? new Date(disposal.acquiredOn).toLocaleDateString(locale)
                      : '—'}
                  </TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
                      disposal.amount,
                    )}
                  </TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {money(disposal.proceeds)}
                  </TableCell>
                  <TableCell align="right" sx={{ ...numberCell, color: 'text.secondary' }}>
                    {money(disposal.cost)}
                  </TableCell>
                  <TableCell align="right" sx={numberCell}>
                    {disposal.heldDays ?? '—'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...numberCell,
                      fontWeight: 600,
                      color:
                        disposal.gain >= 0 ? 'var(--ff-dash-success)' : 'var(--ff-dash-critical)',
                    }}
                  >
                    {disposal.gain >= 0 ? '+' : ''}
                    {money(disposal.gain)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} sx={{ fontWeight: 600, borderBottom: 0 }}>
                  {labels.title}
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, borderBottom: 0 }}>
                  {money(gains.proceeds)}
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, borderBottom: 0 }}>
                  {money(gains.cost)}
                </TableCell>
                <TableCell sx={{ borderBottom: 0 }} />
                <TableCell align="right" sx={{ ...numberCell, fontWeight: 700, borderBottom: 0 }}>
                  {gains.gain >= 0 ? '+' : ''}
                  {money(gains.gain)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
