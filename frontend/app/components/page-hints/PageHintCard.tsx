'use client';

import type { SxProps, Theme } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import GlobalStyles from '@mui/material/GlobalStyles';
import Popper from '@mui/material/Popper';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useEffect, useId } from 'react';
import { tokens } from '@/lib/theme-tokens';
import type { PageHintPlacement } from './page-hints';

/** The attribute that draws the ring around the element a hint points at. */
const ACTIVE_ATTRIBUTE = 'data-hint-active';

export interface PageHintCardProps {
  anchorEl: HTMLElement;
  placement?: PageHintPlacement;
  title: string;
  body: string;
  index: number;
  total: number;
  /** A bottom card instead of a popover beside the element. */
  small: boolean;
  labels: { next: string; done: string; close: string; stepOf: string };
  onNext: () => void;
  onClose: () => void;
}

const cardSx = {
  width: 320,
  maxWidth: 'calc(100vw - 32px)',
  boxSizing: 'border-box',
  p: 2,
  borderRadius: tokens.radius.md,
  bgcolor: 'var(--card)',
  color: 'var(--foreground)',
  border: '1px solid var(--border)',
  boxShadow: tokens.shadow.md,
  '@media (prefers-reduced-motion: no-preference)': {
    animation: 'lumio-page-hint-in 160ms ease-out',
  },
  '@keyframes lumio-page-hint-in': {
    from: { opacity: 0, transform: 'translateY(4px)' },
    to: { opacity: 1, transform: 'none' },
  },
} satisfies SxProps<Theme>;

const sheetSx = {
  position: 'fixed',
  left: 16,
  right: 16,
  // Above the mobile tab bar.
  bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
  zIndex: (theme: Theme) => theme.zIndex.drawer + 1,
  display: 'flex',
  justifyContent: 'center',
  '& > [role="dialog"]': { width: '100%', maxWidth: 'none' },
} satisfies SxProps<Theme>;

const titleSx = { fontSize: 15, fontWeight: 500, lineHeight: 1.4, m: 0 } satisfies SxProps<Theme>;

const bodySx = {
  mt: 0.5,
  fontSize: 14,
  lineHeight: 1.5,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;

const footerSx = {
  mt: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
} satisfies SxProps<Theme>;

const dotSx = (active: boolean): SxProps<Theme> => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  bgcolor: active ? 'var(--primary)' : 'var(--icon-badge-bg)',
});

const closeSx = { color: 'var(--text-muted)', fontWeight: 500 } satisfies SxProps<Theme>;

const ringStyles = {
  [`[${ACTIVE_ATTRIBUTE}]`]: {
    outline: '2px solid var(--primary)',
    outlineOffset: 3,
  },
};

function Dots(props: { index: number; total: number; label: string }): React.JSX.Element {
  const { index, total, label } = props;
  if (total < 2) {
    return <span />;
  }
  return (
    <Box role="img" aria-label={label} sx={{ display: 'flex', gap: 0.75 }}>
      {Array.from({ length: total }, (_, dot) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one dot per position; they never reorder
        <Box key={dot} sx={dotSx(dot === index)} />
      ))}
    </Box>
  );
}

/** Rings the element while the hint points at it; the page itself stays usable. */
function useRing(anchorEl: HTMLElement): void {
  useEffect(() => {
    anchorEl.setAttribute(ACTIVE_ATTRIBUTE, '');
    return () => anchorEl.removeAttribute(ACTIVE_ATTRIBUTE);
  }, [anchorEl]);
}

/**
 * One step of a page's hints, beside the live element it is about. It is not
 * modal: no backdrop, focus stays where it was, and the page under it works.
 */
export function PageHintCard(props: PageHintCardProps): React.JSX.Element {
  const { anchorEl, index, total, labels } = props;
  const titleId = useId();
  const bodyId = useId();
  const last = index >= total - 1;
  useRing(anchorEl);

  const card = (
    <Box
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      sx={cardSx}
    >
      <Typography id={titleId} component="h2" sx={titleSx}>
        {props.title}
      </Typography>
      <Typography id={bodyId} sx={bodySx}>
        {props.body}
      </Typography>
      <Box sx={footerSx}>
        <Dots index={index} total={total} label={labels.stepOf} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          {last ? null : (
            <Button variant="text" size="small" onClick={props.onClose} sx={closeSx}>
              {labels.close}
            </Button>
          )}
          <Button variant="contained" size="small" onClick={last ? props.onClose : props.onNext}>
            {last ? labels.done : labels.next}
          </Button>
        </Box>
      </Box>
    </Box>
  );

  return (
    <>
      <GlobalStyles styles={ringStyles} />
      {props.small ? (
        <Box sx={sheetSx}>{card}</Box>
      ) : (
        <Popper
          open
          anchorEl={anchorEl}
          placement={props.placement ?? 'bottom'}
          modifiers={[
            { name: 'offset', options: { offset: [0, 12] } },
            { name: 'flip', options: { padding: 16 } },
            { name: 'preventOverflow', options: { padding: 16 } },
          ]}
          sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}
        >
          {card}
        </Popper>
      )}
    </>
  );
}
