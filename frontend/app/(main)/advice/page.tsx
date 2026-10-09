'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Lightbulb, Scale } from '@/app/components/icons';
import { insightHref } from '@/app/components/insights/insight-href';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { type Insight, useInsights, useRefreshInsights } from '@/app/hooks/useInsights';
import { useIntlayer, useLocale } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const ADVICE_SKELETON_KEYS = ['advice-0', 'advice-1', 'advice-2', 'advice-3'];

const adviceCardSx = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 2,
  p: 2.5,
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
} as const;

const isStoic = (item: Insight) => item.type.startsWith('stoic.');
const isPraise = (item: Insight) => item.type === 'stoic.praise';
const isExpert = (item: Insight) => item.type === 'expert.principle';

/** "Morgan Housel, The Psychology of Money (2020)" for expert cards. */
function expertCredit(item: Insight): string | null {
  const expert = item.data?.expert;
  const work = item.data?.work;
  return typeof expert === 'string' && typeof work === 'string' ? `${expert}, ${work}` : null;
}

/** Praise gets a check and a green edge; Stoic judgments a scale; plain observations a bulb. */
function AdviceIcon({ item }: { item: Insight }): React.JSX.Element {
  if (isPraise(item)) {
    return <CheckCircle2 size={20} color={tokens.color.success} />;
  }
  if (isStoic(item)) {
    return <Scale size={20} color={tokens.color.info} />;
  }
  if (isExpert(item)) {
    return <BookOpen size={20} color={tokens.color.info} />;
  }
  return <Lightbulb size={20} color={tokens.color.info} />;
}

function AdviceCard({ item, openLabel }: { item: Insight; openLabel: string }): React.JSX.Element {
  const href = insightHref(item);
  const cardSx = isPraise(item)
    ? { ...adviceCardSx, borderColor: 'success.main', borderLeftWidth: 4 }
    : adviceCardSx;
  const body = (
    <>
      <AdviceIcon item={item} />
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="body1" fontWeight={600}>
          {item.title}
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {item.message}
        </Typography>
        {expertCredit(item) && (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            — {expertCredit(item)}
          </Typography>
        )}
      </Box>
      {href === null ? null : <ArrowRight size={18} />}
    </>
  );

  // No dismiss control here, so the whole card can be the link.
  return href === null ? (
    <Box sx={cardSx}>{body}</Box>
  ) : (
    <ButtonBase
      component={Link}
      href={href}
      aria-label={`${item.title}. ${openLabel}`}
      sx={{ ...cardSx, width: '100%', textAlign: 'left' }}
    >
      {body}
    </ButtonBase>
  );
}

function AdviceCardSkeleton(): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        p: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.md,
        bgcolor: 'background.paper',
      }}
    >
      <Skeleton variant="rounded" width={20} height={20} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Skeleton variant="text" width="40%" height={22} />
        <Skeleton variant="text" width="85%" height={18} />
      </Box>
    </Box>
  );
}

export default function AdvicePage() {
  const t = useIntlayer('insights');
  // The one place that recomputes: opening this page is the user asking for a
  // fresh read, unlike a banner that happens to render on every route.
  const { items: unordered, isPending } = useInsights({ severities: ['info'] });
  // The Stoic reading of the month comes first; plain observations follow.
  // The Stoic reading of the month first, then the experts, then plain observations.
  const rank = (item: Insight) => (isStoic(item) ? 2 : isExpert(item) ? 1 : 0);
  const items = [...unordered].sort((a, b) => rank(b) - rank(a));
  const refreshInsights = useRefreshInsights();
  const triggerRefresh = refreshInsights.mutate;
  // Switching the interface language rewrites the advice in it.
  const { locale } = useLocale();
  useEffect(() => {
    triggerRefresh(locale);
  }, [triggerRefresh, locale]);

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
    >
      {isPending && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {ADVICE_SKELETON_KEYS.map(key => (
            <AdviceCardSkeleton key={key} />
          ))}
        </Box>
      )}

      {!isPending && items.length === 0 && (
        <EmptyState illustration="advice" description={t.adviceEmpty} />
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map(item => (
          <AdviceCard key={item.id} item={item} openLabel={t.openLabel.value} />
        ))}
      </Box>
    </Box>
  );
}
