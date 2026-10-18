'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Scale, X } from '@/app/components/icons';
import { insightHref } from '@/app/components/insights/insight-href';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { BulbLineIcon } from '@/app/components/ui/empty-state-icons';
import { type Insight, useInsights, useRefreshInsights } from '@/app/hooks/useInsights';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

const ADVICE_SKELETON_KEYS = ['advice-0', 'advice-1', 'advice-2', 'advice-3'];

/** One column of reading width: the arrow and Dismiss stay next to the words they act on. */
const LIST_MAX_WIDTH = 760;

const isStoic = (item: Insight) => item.type.startsWith('stoic.');
const isPraise = (item: Insight) => item.type === 'stoic.praise';
const isExpert = (item: Insight) => item.type === 'expert.principle';

/**
 * Advice that asks for something: a cost that rose, an unusual charge, a plan
 * that slipped. The rest is information and stays without an accent.
 */
const ATTENTION_TYPES = new Set([
  'spending.spike',
  'transaction.unusual',
  'pattern.detected',
  'pattern.risky_allocation',
  'trend.spending_up',
  'stoic.intent_gap',
  'stoic.virtue_neglected',
  'stoic.repeated',
  'stoic.unclassified',
  'stoic.plan',
  'stoic.commitments',
  'stoic.subscriptions',
  'stoic.generosity',
]);
const needsAttention = (item: Insight) =>
  ATTENTION_TYPES.has(item.type) || item.type.startsWith('operational.');

/** Good news: the user is doing well, so it gets a sage check rather than nothing. */
const isGoodNews = (item: Insight) =>
  isPraise(item) ||
  item.type === 'trend.spending_down' ||
  (item.type === 'trend.savings_rate' && item.messageKey !== 'trend.savings_rate_down');

/** "Morgan Housel, The Psychology of Money (2020)" for expert cards. */
function expertCredit(item: Insight): string | null {
  const expert = item.data?.expert;
  const work = item.data?.work;
  return typeof expert === 'string' && typeof work === 'string' ? `${expert}, ${work}` : null;
}

/** "2 days ago", in the reader's language. */
function ago(iso: string, locale: string): string {
  const days = Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return Math.abs(days) < 1
    ? format.format(Math.round((Date.parse(iso) - Date.now()) / 3_600_000), 'hour')
    : format.format(days, 'day');
}

/**
 * The mark before a line: an ochre dot for what needs doing, a sage check for
 * good news, a grey glyph naming a Stoic or expert reading, otherwise nothing.
 * A bulb on every line repeated the sidebar and said nothing.
 */
function AdviceMark({ item }: { item: Insight }): React.JSX.Element {
  if (needsAttention(item) && !isPraise(item)) {
    return <Box className="lumio-advice__dot" aria-hidden />;
  }
  if (isGoodNews(item)) {
    return <CheckCircle2 size={18} color="var(--money-up)" aria-hidden />;
  }
  if (isStoic(item)) {
    return <Scale size={18} color="var(--muted-foreground)" aria-hidden />;
  }
  if (isExpert(item)) {
    return <BookOpen size={18} color="var(--muted-foreground)" aria-hidden />;
  }
  return <span aria-hidden />;
}

function AdviceRow({
  item,
  openLabel,
  dismissLabel,
  locale,
  onDismiss,
}: {
  item: Insight;
  openLabel: string;
  dismissLabel: string;
  locale: string;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  const href = insightHref(item);
  const body = (
    <>
      <Box sx={{ width: 18, pt: 0.375, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <AdviceMark item={item} />
      </Box>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{item.title}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          {item.message}
        </Typography>
        {expertCredit(item) && (
          <Typography
            variant="caption"
            component="p"
            sx={{ color: 'text.secondary', fontStyle: 'italic' }}
          >
            — {expertCredit(item)}
          </Typography>
        )}
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {ago(item.createdAt, locale)}
        </Typography>
      </Box>
      {href === null ? null : <ArrowRight size={16} className="lumio-advice__arrow" aria-hidden />}
    </>
  );

  return (
    <Box component="li" className="lumio-advice__row">
      {href === null ? (
        <Box className="lumio-advice__main">{body}</Box>
      ) : (
        <ButtonBase
          component={Link}
          href={href}
          aria-label={`${item.title}. ${openLabel}`}
          className="lumio-advice__main"
        >
          {body}
        </ButtonBase>
      )}
      {/* Seen it: away it goes, or the list only ever grows. */}
      <IconButton
        size="small"
        className="lumio-advice__dismiss"
        aria-label={`${dismissLabel}: ${item.title}`}
        onClick={() => onDismiss(item.id)}
      >
        <X size={14} />
      </IconButton>
    </Box>
  );
}

function AdviceGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Box component="section">
      <Typography
        component="h2"
        variant="caption"
        sx={{ display: 'block', color: 'text.secondary', mb: 0.5 }}
      >
        {title}
      </Typography>
      <Box component="ul" className="lumio-advice">
        {children}
      </Box>
    </Box>
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
  const { items: unordered, isPending, dismiss } = useInsights({ severities: ['info'] });
  // The Stoic reading of the month comes first; plain observations follow.
  // The Stoic reading of the month first, then the experts, then plain observations.
  const rank = (item: Insight) => (isStoic(item) ? 2 : isExpert(item) ? 1 : 0);
  const items = [...unordered].sort((a, b) => rank(b) - rank(a));
  const refreshInsights = useRefreshInsights();
  const triggerRefresh = refreshInsights.mutate;
  // Switching the interface language rewrites the advice in it.
  const { locale } = useLocale();
  // Waits for the workspace: without one the server answers 403 (a fresh browser).
  const workspaceId = useWorkspaceId();
  useEffect(() => {
    if (workspaceId) {
      triggerRefresh(locale);
    }
  }, [triggerRefresh, locale, workspaceId]);

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
        <EmptyState
          fill
          icon={<BulbLineIcon />}
          title={t.adviceEmptyTitle}
          description={t.adviceEmptyHint}
          action={
            <Button variant="contained" component={Link} href="/budgets" data-hint="advice-main">
              {t.openBudgets}
            </Button>
          }
        />
      )}

      {/* What asks for something first, then the rest, as two quiet lists. */}
      {items.length > 0 && (
        <Box data-hint="advice-main" sx={{ maxWidth: LIST_MAX_WIDTH, display: 'grid', gap: 4 }}>
          {[
            { key: 'attention', title: t.needsAttention.value, rows: items.filter(needsAttention) },
            {
              key: 'info',
              title: t.forYourInfo.value,
              rows: items.filter(item => !needsAttention(item)),
            },
          ]
            .filter(group => group.rows.length > 0)
            .map(group => (
              <AdviceGroup key={group.key} title={group.title}>
                {group.rows.map(item => (
                  <AdviceRow
                    key={item.id}
                    item={item}
                    openLabel={t.openLabel.value}
                    dismissLabel={t.dismiss.value}
                    locale={locale}
                    onDismiss={dismiss}
                  />
                ))}
              </AdviceGroup>
            ))}
        </Box>
      )}
    </Box>
  );
}
