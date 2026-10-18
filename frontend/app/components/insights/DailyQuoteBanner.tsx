'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Quote, X } from '@/app/components/icons';
import { useAuth } from '@/app/hooks/useAuth';
import { useDailyQuote } from '@/app/hooks/useDailyQuote';
import { useInsights } from '@/app/hooks/useInsights';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

/** Pages whose own content fills the screen; the quote stays off there. */
const HIDDEN_ON = new Set(['/reports']);

/** The quote starts at the larger size and steps down until it fits one line. */
const QUOTE_MAX_FONT = 19;
const QUOTE_MIN_FONT = 14;

/**
 * Sizes the quote to the widest font that keeps it on one line; a quote too
 * long even at the smallest size wraps instead of being cut.
 */
function useOneLineFit(text: string | null): React.RefObject<HTMLQuoteElement | null> {
  const ref = useRef<HTMLQuoteElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!(element && text)) {
      return;
    }
    const fitToLine = (): void => {
      element.style.whiteSpace = 'nowrap';
      let size = QUOTE_MAX_FONT;
      element.style.fontSize = `${size}px`;
      while (size > QUOTE_MIN_FONT && element.scrollWidth > element.clientWidth) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
      element.style.whiteSpace = element.scrollWidth > element.clientWidth ? 'normal' : 'nowrap';
    };
    fitToLine();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(fitToLine);
    if (element.parentElement) {
      observer.observe(element.parentElement);
    }
    return (): void => observer.disconnect();
  }, [text]);
  return ref;
}

const storageKey = (workspaceId: string | null) => `lumio:daily-quote-dismissed:${workspaceId}`;

function readDismissed(workspaceId: string | null): string | null {
  try {
    return window.localStorage.getItem(storageKey(workspaceId));
  } catch {
    return null;
  }
}

/**
 * The quote of the day: one verified quote chosen for the user's current
 * situation, with a line saying which advice it answers. Closing it hides it
 * until tomorrow's quote — a per-viewer convenience, so browser storage is enough —
 * and so does leaving the page it first appeared on: it greets the first page of
 * the day, not every page.
 * Hidden while an urgent insight banner is showing, so the two never stack, and
 * for good once the user turns it off in Settings → Appearance. Never shown on
 * the pages listed in HIDDEN_ON.
 */
export function DailyQuoteBanner(): React.JSX.Element | null {
  const t = useIntlayer('insights');
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const pathname = usePathname();
  // Off in settings (or on this page) means no banner and no request for a
  // quote nobody will see.
  const enabled = user?.showDailyQuote !== false && !HIDDEN_ON.has(pathname ?? '');
  const { quote } = useDailyQuote({ enabled });
  const [dismissedDate, setDismissedDate] = useState(() => readDismissed(workspaceId));
  // One strip above the page at a time: while AlertBanner shows an urgent
  // insight the quote waits (same query, so no extra request).
  const urgent = useInsights({ severities: ['warn', 'critical'] });

  const hidden =
    !(enabled && quote) ||
    dismissedDate === quote.date ||
    urgent.isPending ||
    urgent.items.length > 0;
  const quoteRef = useOneLineFit(hidden ? null : (quote?.quote.text ?? null));

  const closeForToday = (date: string): void => {
    try {
      window.localStorage.setItem(storageKey(workspaceId), date);
    } catch {
      // Private mode: the banner still closes for this visit.
    }
    setDismissedDate(date);
  };

  // The quote greets the first page of the day only: once it has been on screen,
  // moving to another page closes it until tomorrow, as the close button would.
  const shownOn = useRef<string | null>(null);
  const shownDate = hidden ? null : (quote?.date ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: closeForToday only writes storage and state
  useEffect(() => {
    if (shownDate && shownOn.current === null) {
      shownOn.current = pathname;
    } else if (shownDate && shownOn.current !== pathname) {
      closeForToday(shownDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeForToday only writes storage and state
  }, [shownDate, pathname]);

  if (hidden || !quote) {
    return null;
  }

  const dismiss = (): void => closeForToday(quote.date);

  return (
    <Box sx={{ px: 3, pt: 2, pb: 2 }}>
      <Box
        component="figure"
        aria-label={t.quoteLabel.value}
        sx={{
          m: 0,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.25,
          px: 2,
          py: 1.25,
          border: '1px solid',
          borderColor: 'divider',
          borderLeft: '3px solid',
          borderLeftColor: 'success.main',
          borderRadius: tokens.radius.sm,
          bgcolor: 'background.paper',
        }}
      >
        <Quote size={20} color={tokens.color.success} style={{ flexShrink: 0, marginTop: 3 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            ref={quoteRef}
            component="blockquote"
            variant="body2"
            sx={{
              m: 0,
              overflow: 'hidden',
              fontSize: QUOTE_MAX_FONT,
              fontWeight: 500,
              lineHeight: 1.35,
              letterSpacing: '-0.005em',
              color: 'text.primary',
            }}
          >
            {quote.quote.text}
          </Typography>
          <Typography component="figcaption" variant="caption" sx={{ color: 'text.secondary' }}>
            — {quote.quote.author},{' '}
            <Box
              component="a"
              href={quote.quote.sourceUrl}
              target="_blank"
              rel="noreferrer"
              sx={{ color: 'inherit' }}
            >
              {quote.quote.source}
            </Box>
            {quote.reason && (
              <>
                {' · '}
                <Box component={Link} href="/advice" sx={{ color: 'text.secondary' }}>
                  {t.quoteWhy.value} {quote.reason.title}
                </Box>
              </>
            )}
          </Typography>
        </Box>
        <IconButton size="small" aria-label={t.quoteDismiss.value} onClick={dismiss}>
          <X size={16} />
        </IconButton>
      </Box>
    </Box>
  );
}
