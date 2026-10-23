'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { ChevronDown, X } from '@/app/components/icons';
import { insightHref } from '@/app/components/insights/insight-href';
import { useIntlayer, useLocale } from '@/app/i18n';
import { resolveLocaleTag } from '@/app/lib/user-format';
import { useAttentionItems } from './useAttentionItems';
import { type WorkInsight, workCount } from './work-insights';

interface PluralForms {
  one: string;
  few: string;
  many: string;
}

/** "{{count}} …" in the language's plural form; `two` (sl, hsb) reads like few. */
function plural(locale: string, count: number, forms: PluralForms): string {
  const tag = resolveLocaleTag(locale);
  const category = new Intl.PluralRules(tag).select(count);
  const pattern =
    category === 'one'
      ? forms.one
      : category === 'few' || category === 'two'
        ? forms.few
        : forms.many;
  return pattern.replace('{{count}}', new Intl.NumberFormat(tag).format(count));
}

const useTexts = () => useIntlayer('attentionBanner');
type Texts = ReturnType<typeof useTexts>;

const FORMS_OF: Record<WorkInsight['type'], 'unapproved' | 'uncategorized' | 'duplicates'> = {
  'operational.unapproved_count': 'unapproved',
  'operational.uncategorized_count': 'uncategorized',
  'operational.duplicate_detected': 'duplicates',
};

function formsOf(
  t: Texts,
  key: 'summary' | 'unapproved' | 'uncategorized' | 'duplicates',
): PluralForms {
  const forms = {
    summary: [t.summaryOne, t.summaryFew, t.summaryMany],
    unapproved: [t.unapprovedOne, t.unapprovedFew, t.unapprovedMany],
    uncategorized: [t.uncategorizedOne, t.uncategorizedFew, t.uncategorizedMany],
    duplicates: [t.duplicatesOne, t.duplicatesFew, t.duplicatesMany],
  }[key];
  return { one: forms[0].value, few: forms[1].value, many: forms[2].value };
}

// One quiet row: the soft fill, an ochre dot, plain text. Terracotta only for what
// blocks work; no triangles, no yellow.
const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  minHeight: 44,
  pl: 2,
  pr: 1,
  borderRadius: '8px',
  bgcolor: 'var(--surface-soft)',
  fontSize: 14,
  // The close button shows on hover or keyboard focus; a touch screen has no hover.
  '& .seneca-attention__snooze': { opacity: 0 },
  '&:hover .seneca-attention__snooze, &:focus-within .seneca-attention__snooze': { opacity: 1 },
  '@media (hover: none)': { '& .seneca-attention__snooze': { opacity: 1 } },
} satisfies SxProps<Theme>;

function dotSx(critical: boolean): SxProps<Theme> {
  return {
    flexShrink: 0,
    width: 8,
    height: 8,
    borderRadius: '50%',
    bgcolor: critical ? 'var(--money-down)' : 'var(--attention)',
  };
}

const textSx = {
  flex: 1,
  minWidth: 0,
  // One line on a wide screen; a phone wraps instead of cutting the words off.
  py: { xs: 1, sm: 0 },
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: { xs: 'normal', sm: 'nowrap' },
  fontWeight: 500,
  color: 'var(--foreground)',
} satisfies SxProps<Theme>;

const actionSx = {
  flexShrink: 0,
  px: 1,
  color: 'var(--primary)',
  fontWeight: 500,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
} satisfies SxProps<Theme>;

interface RowProps {
  item: WorkInsight;
  t: Texts;
  locale: string;
  onSnooze: () => void;
}

/** One item: what is left, how to get to it, and "hide for a week". */
function AttentionRow({ item, t, locale, onSnooze }: RowProps): React.JSX.Element {
  const href = insightHref(item);
  const text = plural(locale, workCount(item), formsOf(t, FORMS_OF[item.type]));
  const action = (item.type === 'operational.duplicate_detected' ? t.check : t.review).value;
  return (
    <Box role="status" sx={rowSx}>
      <Box sx={dotSx(item.severity === 'critical')} aria-hidden />
      {/* The Stoic wording stays one hover away, for whoever wants it. */}
      <Box component="span" sx={textSx} title={item.message}>
        {text}
      </Box>
      {href === null ? null : (
        <Box component={Link} href={href} sx={actionSx}>
          {action}
        </Box>
      )}
      <IconButton
        size="small"
        className="seneca-attention__snooze"
        aria-label={t.snooze.value}
        title={t.snooze.value}
        onClick={onSnooze}
      >
        <X size={14} />
      </IconButton>
    </Box>
  );
}

/** The dashboard shows the banner under its month strip, not above the page. */
const PAGES_WITH_THEIR_OWN_BANNER = new Set(['/dashboard']);

/** The review queue is the work the banner points at: no banner above it. */
const PAGES_WITHOUT_BANNER = new Set(['/review']);

/**
 * What is left to do, above every page: the unconfirmed and uncategorized rows and
 * possible duplicates. One item is one quiet row; several fold into a single line
 * ("3 things need attention") that opens the list. Observations are not here: they
 * live on the Advice page.
 */
export function AlertBanner({
  placement = 'top',
}: {
  /** `page`: drawn by the page itself, where it fits its layout (the dashboard). */
  placement?: 'top' | 'page';
}): React.JSX.Element | null {
  const t = useTexts();
  const { locale } = useLocale();
  const pathname = usePathname();
  const { items, snooze } = useAttentionItems();
  const [open, setOpen] = useState(false);

  // A page that draws the banner itself gets it once, in its own place.
  if (
    placement === 'top' &&
    (PAGES_WITH_THEIR_OWN_BANNER.has(pathname ?? '') || PAGES_WITHOUT_BANNER.has(pathname ?? ''))
  ) {
    return null;
  }
  if (items.length === 0) {
    return null;
  }

  const rows = items.map(item => (
    <AttentionRow
      key={item.id}
      item={item}
      t={t}
      locale={String(locale)}
      onSnooze={() => snooze(item.id)}
    />
  ));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.length === 1 ? (
        rows
      ) : (
        <>
          <Box
            component="button"
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(current => !current)}
            sx={[
              rowSx,
              { width: '100%', border: 0, cursor: 'pointer', font: 'inherit', textAlign: 'start' },
            ]}
          >
            <Box sx={dotSx(items.some(item => item.severity === 'critical'))} aria-hidden />
            <Box component="span" sx={textSx}>
              {plural(String(locale), items.length, formsOf(t, 'summary'))}
            </Box>
            <Box
              component="span"
              aria-hidden
              sx={{
                display: 'inline-flex',
                px: 1,
                color: 'var(--text-muted)',
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform 150ms ease',
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              }}
            >
              <ChevronDown size={16} />
            </Box>
          </Box>
          {open ? rows : null}
        </>
      )}
    </Box>
  );
}
