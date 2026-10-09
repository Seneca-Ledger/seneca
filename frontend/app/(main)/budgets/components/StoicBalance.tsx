'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMonthLabel } from '@/app/components/dashboard/use-month-label';
import { ChevronLeft, ChevronRight } from '@/app/components/icons';
import { tokens } from '@/lib/theme-tokens';
import {
  STOIC_CLASSES,
  type StoicClass,
  type StoicMonth,
  type StoicTotals,
  toShares,
  useStoicBalance,
} from '../hooks/useStoicBalance';
import { useClassText } from '../hooks/useStoicClassText';
import { StoicClassifyList } from './StoicClassifyList';

type Segment = StoicClass | 'unclassified';

/**
 * Four categorical hues in a fixed order (validated for colour-blind
 * separation in both modes), plus a neutral for spending nobody judged yet.
 * Light mode's virtue and leisure fall under 3:1 against the surface, which is
 * why every share is also written out in the legend.
 */
const SEGMENT_COLORS: Record<'light' | 'dark', Record<Segment, string>> = {
  light: {
    necessity: '#2a78d6',
    work: '#eb6834',
    virtue: '#1baf7a',
    leisure: '#eda100',
    unclassified: '#b7b7c0',
  },
  dark: {
    necessity: '#3987e5',
    work: '#d95926',
    virtue: '#199e70',
    leisure: '#c98500',
    unclassified: '#4a4a58',
  },
};

const SEGMENTS: Segment[] = [...STOIC_CLASSES, 'unclassified'];

/** A small label naming a category's class — used on budget cards too. */
export function StoicClassChip({ stoicClass }: { stoicClass: StoicClass }): React.JSX.Element {
  const { names } = useClassText();
  const mode = useTheme().palette.mode;
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: SEGMENT_COLORS[mode][stoicClass],
        }}
      />
      {names[stoicClass]}
    </Box>
  );
}

function ShareBar({
  label,
  totals,
  names,
}: {
  label: string;
  totals: StoicTotals;
  names: Record<Segment, string>;
}): React.JSX.Element {
  const mode = useTheme().palette.mode;
  const shares = toShares(totals);
  const visible = SEGMENTS.filter(segment => shares[segment] > 0);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr', alignItems: 'center', gap: 1.5 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box
        role="img"
        aria-label={`${label}: ${visible
          .map(segment => `${names[segment]} ${Math.round(shares[segment])}%`)
          .join(', ')}`}
        sx={{
          display: 'flex',
          gap: '2px',
          height: 14,
          borderRadius: '4px',
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        {visible.map(segment => (
          <Tooltip key={segment} title={`${names[segment]} · ${Math.round(shares[segment])}%`}>
            <Box
              sx={{
                width: `${shares[segment]}%`,
                minWidth: 2,
                bgcolor: SEGMENT_COLORS[mode][segment],
              }}
            />
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}

/** One card per class: what it covers, and its planned and actual share that month. */
function ClassLegend({ month }: { month: StoicMonth }): React.JSX.Element {
  const { t, names, hints } = useClassText();
  const mode = useTheme().palette.mode;
  const planned = toShares(month.intended);
  const actual = toShares(month.actual);

  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none',
        p: 0,
        m: 0,
        mb: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        gap: 1.5,
      }}
    >
      {STOIC_CLASSES.map(stoicClass => (
        <Box
          component="li"
          key={stoicClass}
          data-attention={`stoic:${stoicClass}`}
          sx={{ p: 1.5, borderRadius: tokens.radius.md, bgcolor: 'action.hover' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: SEGMENT_COLORS[mode][stoicClass],
              }}
            />
            <Typography variant="body2" fontWeight={600}>
              {names[stoicClass]}
            </Typography>
          </Box>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {hints[stoicClass]}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.75 }}>
            {t.planned.value} {Math.round(planned[stoicClass])}% · {t.actual.value}{' '}
            {Math.round(actual[stoicClass])}%
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** "2026-08" as the date its month starts on, for the locale formatter. */
function monthStart(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

/** The month being read, and the arrows that walk the loaded months. */
function MonthNav({
  months,
  index,
  onChange,
  previousLabel,
  nextLabel,
}: {
  months: StoicMonth[];
  index: number;
  onChange: (index: number) => void;
  previousLabel: string;
  nextLabel: string;
}): React.JSX.Element {
  const label = useMonthLabel(monthStart(months[index].month));
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {/* Older months are further down the list, which is newest first. */}
      <IconButton
        size="small"
        aria-label={previousLabel}
        disabled={index >= months.length - 1}
        onClick={() => onChange(index + 1)}
      >
        <ChevronLeft size={18} />
      </IconButton>
      <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>
        {label}
      </Typography>
      <IconButton
        size="small"
        aria-label={nextLabel}
        disabled={index <= 0}
        onClick={() => onChange(index - 1)}
      >
        <ChevronRight size={18} />
      </IconButton>
    </Box>
  );
}

/**
 * Plan against reality in the four Stoic classes, and the place where the
 * user decides which class each category belongs to. The Stoic advice on the
 * Advice page reads the same numbers.
 *
 * Which month it reads is the advice's to choose: in the first days of a
 * month the advice judges the one that just ended (`?month=YYYY-MM`), and
 * landing on the running month instead would ring a card holding a few days
 * of spending rather than the month the advice weighed.
 */
export function StoicBalance(): React.JSX.Element | null {
  const { t, names } = useClassText();
  const { balance, isPending, classify, classifying } = useStoicBalance();
  const months = balance?.months ?? [];
  const linkedMonth = useSearchParams()?.get('month') ?? null;
  const [pickedIndex, setPickedIndex] = useState<number | null>(null);
  // Derived rather than stored: the months arrive after the first render, so
  // a linked month can only be resolved once they are here.
  const linkedIndex = months.findIndex(month => month.month === linkedMonth);
  const monthIndex = pickedIndex ?? (linkedIndex >= 0 ? linkedIndex : 0);

  if (isPending) {
    return <Skeleton variant="rounded" height={220} sx={{ mb: 3 }} />;
  }
  if (!balance || balance.categories.length === 0) {
    return null;
  }

  const current = months[monthIndex];
  const hasPlan = current ? Object.values(current.intended).some(value => value > 0) : false;
  const hasSpending = current ? Object.values(current.actual).some(value => value > 0) : false;

  return (
    <Box
      component="section"
      aria-labelledby="stoic-balance-title"
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Typography id="stoic-balance-title" variant="subtitle1" fontWeight={600}>
          {t.stoicTitle.value}
        </Typography>
        {current && (
          <MonthNav
            months={months}
            index={monthIndex}
            onChange={setPickedIndex}
            previousLabel={t.previousMonth.value}
            nextLabel={t.nextMonth.value}
          />
        )}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {t.stoicSubtitle.value}
      </Typography>

      {current && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {hasPlan ? (
            <ShareBar label={t.planned.value} totals={current.intended} names={names} />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t.noPlan.value}
            </Typography>
          )}
          {hasSpending ? (
            <ShareBar label={t.actual.value} totals={current.actual} names={names} />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t.noSpending.value}
            </Typography>
          )}
        </Box>
      )}

      {current && <ClassLegend month={current} />}

      <StoicClassifyList
        categories={balance.categories}
        classifying={classifying}
        onJudge={classify}
      />
    </Box>
  );
}
