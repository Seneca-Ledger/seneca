'use client';

import Popover from '@mui/material/Popover';
import { useEffect, useId, useRef, useState } from 'react';
import { Search } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { useIntlayer } from '@/app/i18n';
import { SHORTCUT_FOCUS_SEARCH } from '@/app/lib/keyboard-shortcuts';
import { tokens } from '@/lib/theme-tokens';
import { StatementsToolbarButton } from '../StatementsToolbarButton';

type Props = {
  /** The search in force; the button shows it so a narrowed list never looks complete. */
  value: string;
  onApply: (value: string) => void;
  applyLabel: string;
  /** What the term is matched against; defaults to the Documents wording. */
  hint?: string;
  /** Overrides the toolbar button's look, e.g. a ghost button in a table toolbar. */
  buttonStyle?: React.CSSProperties;
};

/**
 * Search for the Documents list: a toolbar button beside Date that opens a box
 * for one term. Like the other toolbar filters, the term takes effect on Apply
 * (or Enter), not on every keystroke.
 */
export function StatementsSearchPopover({
  value,
  onApply,
  applyLabel,
  hint,
  buttonStyle,
}: Props): React.JSX.Element {
  const t = useIntlayer('statementFilterControls');
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const titleId = useId();

  const openBox = (): void => {
    setDraft(value);
    setOpen(true);
  };
  const close = (): void => setOpen(false);

  // `/` opens the box from anywhere on the page.
  useEffect(() => {
    const handleFocusSearch = (): void => {
      setDraft(value);
      setOpen(true);
    };
    window.addEventListener(SHORTCUT_FOCUS_SEARCH, handleFocusSearch);
    return () => window.removeEventListener(SHORTCUT_FOCUS_SEARCH, handleFocusSearch);
  }, [value]);
  const apply = (next: string): void => {
    onApply(next.trim());
    close();
  };

  return (
    <>
      <StatementsToolbarButton
        ref={anchorRef}
        onClick={openBox}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={value || undefined}
        style={{ ...buttonStyle, ...(value ? { borderColor: 'var(--primary)' } : {}) }}
      >
        <Search size={14} />
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value || t.search.value}
        </span>
      </StatementsToolbarButton>

      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-labelledby': titleId,
            sx: {
              mt: 1,
              width: 440,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              background: 'var(--card-bg)',
              backgroundImage: 'none',
            },
          },
        }}
      >
        <form
          onSubmit={event => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span
              id={titleId}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}
            >
              {t.search.value}
            </span>
            <Input
              autoFocus
              type="search"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder={t.searchPlaceholder.value}
              aria-labelledby={titleId}
            />
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.45,
                color: 'var(--muted-foreground)',
              }}
            >
              {hint ?? t.searchHint.value}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <Button
              variant="secondary"
              disabled={!(draft || value)}
              onClick={() => apply('')}
              style={{ borderRadius: tokens.radius.md }}
            >
              {t.clear.value}
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="secondary" onClick={close} style={{ borderRadius: tokens.radius.md }}>
              {t.cancel.value}
            </Button>
            <Button type="submit" style={{ borderRadius: tokens.radius.md }}>
              {applyLabel}
            </Button>
          </div>
        </form>
      </Popover>
    </>
  );
}
