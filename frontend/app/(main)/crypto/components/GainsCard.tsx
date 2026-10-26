'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
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
import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from '@/app/components/icons';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { CryptoDisposal, CryptoGains } from '../hooks/useCrypto';

export type GainsCardLabels = {
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
  /** Hover text on the "Unknown" acquired cell. */
  basisIncomplete: string;
  basisIncompleteHint: string;
  /** "Unknown" in the Acquired column. */
  acquiredUnknown: string;
  totalRealized: string;
  /** "{count} lots" — only ever shown for two or more. */
  lotCount: string;
  /** "Show {count} rows without purchase data". */
  showUncovered: string;
  hideUncovered: string;
};

type GainsControlsProps = {
  gains: CryptoGains;
  year: number | null;
  years: number[];
  labels: Pick<GainsCardLabels, 'title' | 'allYears' | 'exportCsv'>;
  onYearChange: (year: number | null) => void;
};

type GainsBodyProps = {
  gains: CryptoGains;
  labels: GainsCardLabels;
  locale: string;
  money: (value: number) => string;
};

type GainsCardProps = GainsControlsProps & GainsBodyProps & { labels: GainsCardLabels };

const numberCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;
const DAY_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

/** Below a cent the sum reads as $0.00, and a $0.00 is neither a gain nor a loss. */
const isZeroMoney = (value: number): boolean => Math.abs(value) < 0.005;

/**
 * "Oct 24, 2025". A bare `YYYY-MM-DD` is read at local noon: parsed as UTC
 * midnight it would show the day before west of Greenwich.
 */
export const formatDay = (value: string, locale: string): string =>
  formatStoredDateWithOptions(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : value,
    DAY_FORMAT,
    locale,
  );

/**
 * Dust with no purchase behind it: nothing covered was sold and the covered
 * proceeds round to nothing. Real, but noise next to the sales that count.
 */
const isUncoveredDust = (disposal: CryptoDisposal): boolean =>
  disposal.amount === 0 && isZeroMoney(disposal.proceeds);

type GainGroup = {
  key: string;
  date: string;
  asset: string;
  lots: CryptoDisposal[];
  amount: number;
  proceeds: number;
  cost: number;
  gain: number;
};

/** One sale day of one coin, however many purchase lots it consumed. */
export function groupDisposals(disposals: readonly CryptoDisposal[]): GainGroup[] {
  const groups = new Map<string, GainGroup>();
  for (const disposal of disposals) {
    const key = `${disposal.date}|${disposal.asset}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        date: disposal.date,
        asset: disposal.asset,
        lots: [],
        amount: 0,
        proceeds: 0,
        cost: 0,
        gain: 0,
      };
      groups.set(key, group);
    }
    group.lots.push(disposal);
    group.amount += disposal.amount;
    group.proceeds += disposal.proceeds;
    group.cost += disposal.cost;
    group.gain += disposal.gain;
  }
  return [...groups.values()];
}

function GainValue({
  value,
  money,
}: {
  value: number;
  money: (value: number) => string;
}): React.JSX.Element {
  if (isZeroMoney(value)) {
    return (
      <Box component="span" className={PRIVATE_CLASS} sx={{ color: 'var(--muted-foreground)' }}>
        {money(0)}
      </Box>
    );
  }
  return (
    <Box
      component="span"
      className={PRIVATE_CLASS}
      sx={{ color: value > 0 ? 'var(--money-up)' : 'var(--money-down)' }}
    >
      {value > 0 ? '+' : ''}
      {money(value)}
    </Box>
  );
}

function UnknownAcquired({ labels }: { labels: GainsCardLabels }): React.JSX.Element {
  return (
    <span className="seneca-crypto-attention" title={labels.basisIncomplete}>
      {labels.acquiredUnknown}
    </span>
  );
}

function groupHeldDays(lots: CryptoDisposal[]): string {
  const days = lots.map(lot => lot.heldDays).filter((value): value is number => value !== null);
  if (days.length === 0) {
    return '—';
  }
  const min = Math.min(...days);
  const max = Math.max(...days);
  return min === max ? String(min) : `${min}–${max}`;
}

function groupAcquired(
  lots: CryptoDisposal[],
  labels: GainsCardLabels,
  locale: string,
): React.ReactNode {
  const dates = new Set(lots.map(lot => lot.acquiredOn));
  // Any lot without a purchase makes the whole sale incomplete; say so here and
  // let the expanded lots show which.
  if (dates.has(null)) {
    return <UnknownAcquired labels={labels} />;
  }
  if (dates.size === 1) {
    return formatDay(lots[0].acquiredOn as string, locale);
  }
  return null;
}

/** The year picker and the CSV export — the gains tab's header controls. */
export function GainsControls({
  gains,
  year,
  years,
  labels,
  onYearChange,
}: GainsControlsProps): React.JSX.Element {
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
  );
}

/**
 * Every sale against the purchase it consumed — the rows a capital gains return
 * is built from — grouped by sale day and coin. The holding period is shown and
 * not judged: whether a year makes a gain tax-free is a question for the user's
 * own tax authority.
 */
export function GainsBody({ gains, labels, locale, money }: GainsBodyProps): React.JSX.Element {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [showDust, setShowDust] = useState(false);

  if (gains.disposals.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'var(--muted-foreground)' }}>
        {labels.empty}
      </Typography>
    );
  }

  const dustCount = gains.disposals.filter(isUncoveredDust).length;
  const visible = showDust ? gains.disposals : gains.disposals.filter(d => !isUncoveredDust(d));
  const groups = groupDisposals(visible);
  const amountFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });

  const toggle = (key: string): void => {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const muted = { color: 'var(--muted-foreground)' } as const;
  const valueSx = { fontWeight: 500, color: 'var(--foreground)', ...numberCell } as const;

  return (
    <Box>
      <Typography variant="body2" data-testid="gains-totals" sx={{ fontSize: 13, ...muted }}>
        <span>
          {labels.totalRealized}{' '}
          <Box component="span" sx={{ fontWeight: 500, ...numberCell }}>
            <GainValue value={gains.gain} money={money} />
          </Box>
        </span>
        {' · '}
        <span>
          {labels.proceeds}{' '}
          <Box component="span" className={PRIVATE_CLASS} sx={valueSx}>
            {money(gains.proceeds)}
          </Box>
        </span>
        {' · '}
        <span>
          {labels.cost}{' '}
          <Box component="span" className={PRIVATE_CLASS} sx={valueSx}>
            {money(gains.cost)}
          </Box>
        </span>
      </Typography>

      {gains.disposals.some(disposal => disposal.costIncomplete) && (
        <Typography
          variant="body2"
          component="p"
          className="seneca-crypto-attention"
          sx={{ fontSize: 13, ...muted, mt: 1, display: 'flex' }}
        >
          {labels.basisIncompleteHint}
        </Typography>
      )}

      {groups.length > 0 && (
        <Box sx={{ overflowX: 'auto', mt: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{labels.sold}</TableCell>
                <TableCell>{labels.asset}</TableCell>
                <TableCell>{labels.acquired}</TableCell>
                <TableCell align="right">{labels.amount}</TableCell>
                <TableCell align="right">{labels.proceeds}</TableCell>
                <TableCell align="right">{labels.cost}</TableCell>
                <TableCell align="right">{labels.heldDays}</TableCell>
                <TableCell align="right">{labels.gain}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map(group => {
                const single = group.lots.length === 1;
                const isOpen = !single && expanded.has(group.key);
                const lotLabel = labels.lotCount.replace('{count}', String(group.lots.length));
                return (
                  <Fragment key={group.key}>
                    <TableRow
                      data-testid="gains-group"
                      onClick={single ? undefined : () => toggle(group.key)}
                      sx={single ? undefined : { cursor: 'pointer' }}
                    >
                      <TableCell sx={numberCell}>
                        {single ? (
                          formatDay(group.date, locale)
                        ) : (
                          <Box
                            component="button"
                            type="button"
                            aria-expanded={isOpen}
                            onClick={event => {
                              event.stopPropagation();
                              toggle(group.key);
                            }}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              p: 0,
                              ml: -0.5,
                              border: 0,
                              background: 'none',
                              font: 'inherit',
                              color: 'inherit',
                              cursor: 'pointer',
                            }}
                          >
                            <Box component="span" sx={{ display: 'inline-flex', ...muted }}>
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </Box>
                            {formatDay(group.date, locale)}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Box component="span" sx={{ fontWeight: 500 }}>
                          {group.asset}
                        </Box>
                        {!single && (
                          <Box component="span" sx={muted}>
                            {' · '}
                            {lotLabel}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell sx={{ ...numberCell, ...muted }}>
                        {groupAcquired(group.lots, labels, locale)}
                      </TableCell>
                      <TableCell align="right" sx={numberCell}>
                        {amountFormat.format(group.amount)}
                      </TableCell>
                      <TableCell align="right" className={PRIVATE_CLASS} sx={numberCell}>
                        {money(group.proceeds)}
                      </TableCell>
                      <TableCell
                        align="right"
                        className={PRIVATE_CLASS}
                        sx={{ ...numberCell, ...muted }}
                      >
                        {money(group.cost)}
                      </TableCell>
                      <TableCell align="right" sx={numberCell}>
                        {groupHeldDays(group.lots)}
                      </TableCell>
                      <TableCell align="right" sx={{ ...numberCell, fontWeight: 500 }}>
                        <GainValue value={group.gain} money={money} />
                      </TableCell>
                    </TableRow>
                    {isOpen &&
                      group.lots.map(lot => (
                        // The id carries the sale's place in the report: two sales of
                        // the same coin, the same size, on the same day are two sales.
                        <TableRow key={lot.id} data-testid="gains-lot" sx={{ fontSize: 13 }}>
                          <TableCell />
                          <TableCell />
                          <TableCell sx={{ ...numberCell, ...muted }}>
                            {lot.acquiredOn ? (
                              formatDay(lot.acquiredOn, locale)
                            ) : (
                              <UnknownAcquired labels={labels} />
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ ...numberCell, ...muted }}>
                            {amountFormat.format(lot.amount)}
                          </TableCell>
                          <TableCell
                            align="right"
                            className={PRIVATE_CLASS}
                            sx={{ ...numberCell, ...muted }}
                          >
                            {money(lot.proceeds)}
                          </TableCell>
                          <TableCell
                            align="right"
                            className={PRIVATE_CLASS}
                            sx={{ ...numberCell, ...muted }}
                          >
                            {money(lot.cost)}
                          </TableCell>
                          <TableCell align="right" sx={{ ...numberCell, ...muted }}>
                            {lot.heldDays ?? '—'}
                          </TableCell>
                          <TableCell align="right" sx={numberCell}>
                            <GainValue value={lot.gain} money={money} />
                          </TableCell>
                        </TableRow>
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}

      {dustCount > 0 && (
        <Link
          component="button"
          type="button"
          underline="hover"
          onClick={() => setShowDust(current => !current)}
          sx={{ mt: 1.5, fontSize: 13, color: 'var(--muted-foreground)' }}
        >
          {showDust
            ? labels.hideUncovered
            : labels.showUncovered.replace('{count}', String(dustCount))}
        </Link>
      )}
    </Box>
  );
}

/** Standalone card: title and hint over the controls and the grouped table. */
export function GainsCard({
  gains,
  year,
  years,
  labels,
  locale,
  money,
  onYearChange,
}: GainsCardProps): React.JSX.Element {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          mb: 2,
        }}
      >
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
            }}
          >
            {labels.title}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--muted-foreground)' }}>
            {labels.hint}
          </Typography>
        </Box>
        <GainsControls
          gains={gains}
          year={year}
          years={years}
          labels={labels}
          onYearChange={onYearChange}
        />
      </Box>
      <GainsBody gains={gains} labels={labels} locale={locale} money={money} />
    </Paper>
  );
}
