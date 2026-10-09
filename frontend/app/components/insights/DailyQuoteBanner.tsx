'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Quote, X } from '@/app/components/icons';
import { useAuth } from '@/app/hooks/useAuth';
import { useDailyQuote } from '@/app/hooks/useDailyQuote';
import { useInsights } from '@/app/hooks/useInsights';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

/** Pages whose own content fills the screen; the quote stays off there. */
const HIDDEN_ON = new Set(['/reports']);

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
 * until tomorrow's quote — a per-viewer convenience, so browser storage is enough.
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

  if (
    !(enabled && quote) ||
    dismissedDate === quote.date ||
    urgent.isPending ||
    urgent.items.length > 0
  ) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey(workspaceId), quote.date);
    } catch {
      // Private mode: the banner still closes for this visit.
    }
    setDismissedDate(quote.date);
  };

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
        <Quote size={18} color={tokens.color.success} style={{ flexShrink: 0, marginTop: 2 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography component="blockquote" variant="body2" sx={{ m: 0, fontStyle: 'italic' }}>
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
