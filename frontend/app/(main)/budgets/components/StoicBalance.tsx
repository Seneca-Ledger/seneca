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
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
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
 * Four related, muted earth tones from the app's chart palette (dusty blue,
 * clay, sage, sand) rather than a rainbow, plus a neutral for spending nobody
 * judged yet. Mid tones, so they hold on either surface. Sand and sage are
 * faint against white, which is why every share is also written out.
 */
const SEGMENT_COLORS: Record<'light' | 'dark', Record<Segment, string>> = {
  light: {
    necessity: '#7c93a8',
    work: '#a98b76',
    virtue: '#6f8f7b',
    leisure: '#d2b48c',
    unclassified: '#cfc9be',
  },
  dark: {
    necessity: '#7c93a8',
    work: '#a98b76',
    virtue: '#6f8f7b',
    leisure: '#d2b48c',
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
          height: 8,
          borderRadius: '4px',
          overflow: 'hidden',
          bgcolor: 'var(--icon-badge-bg)',
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
function ClassLegend({
  month,
  hasPlan,
}: {
  month: StoicMonth;
  hasPlan: boolean;
}): React.JSX.Element {
  const { t, names, hints } = useClassText();
  const mode = useTheme().palette.mode;
  const planned = toShares(month.intended);
  const actual = toShares(month.actual);
  // A zero share reads as a dash: four "0%" in a row is noise, not news.
  const share = (value: number): string => (value > 0 ? `${Math.round(value)}%` : '—');

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
          sx={{ p: 1.5, borderRadius: tokens.radius.md, bgcolor: 'var(--surface-soft)' }}
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
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
              }}
            >
              {names[stoicClass]}
            </Typography>
          </Box>
          <Typography
            component="p"
            sx={{ color: 'text.secondary', mt: 0.5, fontSize: 13, lineHeight: 1.45 }}
          >
            {hints[stoicClass]}
          </Typography>
          {/* Planned against actual means nothing until there is a plan. */}
          {hasPlan ? (
            <Typography variant="body2" sx={{ mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {t.planned.value} <PrivateAmount>{share(planned[stoicClass])}</PrivateAmount> ·{' '}
              {t.actual.value} <PrivateAmount>{share(actual[stoicClass])}</PrivateAmount>
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

/** The month's spending in one sentence, for a month with no plan to set it against. */
function SpendingFact({
  totals,
  names,
}: {
  totals: StoicTotals;
  names: Record<Segment, string>;
}): React.JSX.Element {
  const { t } = useClassText();
  const mode = useTheme().palette.mode;
  const shares = toShares(totals);
  const top = SEGMENTS.reduce((best, segment) => (shares[segment] > shares[best] ? segment : best));
  const percent = Math.round(shares[top]);
  const sentence =
    percent >= 100
      ? t.allSpendingIs.value.replace('{class}', names[top])
      : fillTemplateNodes(t.mostSpendingIs.value.replace('{class}', names[top]), {
          share: String(percent),
        });
  return (
    <Typography
      variant="body2"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}
    >
      <Box
        component="span"
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: SEGMENT_COLORS[mode][top] }}
      />
      {sentence}
    </Typography>
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
        <Typography
          id="stoic-balance-title"
          variant="subtitle1"
          sx={{
            fontWeight: 600,
          }}
        >
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
          {/* With nothing planned there is nothing to compare: say where the money
              went in words instead of a bar filled with one colour. */}
          {hasPlan ? (
            <ShareBar label={t.planned.value} totals={current.intended} names={names} />
          ) : null}
          {hasPlan && hasSpending ? (
            <ShareBar label={t.actual.value} totals={current.actual} names={names} />
          ) : hasSpending ? (
            <SpendingFact totals={current.actual} names={names} />
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t.noSpending.value}
            </Typography>
          )}
        </Box>
      )}

      {current && <ClassLegend month={current} hasPlan={hasPlan} />}

      <StoicClassifyList
        categories={balance.categories}
        classifying={classifying}
        onJudge={classify}
      />
    </Box>
  );
}
