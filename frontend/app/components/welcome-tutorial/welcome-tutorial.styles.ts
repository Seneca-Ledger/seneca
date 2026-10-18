import type { SxProps, Theme } from '@mui/material';
import { keyframes } from '@mui/material/styles';

/** The dialog is labelled by the heading of whichever screen is showing. */
export const TITLE_ID = 'welcome-tutorial-title';

const enter = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
`;

// CSS animations, not JS ones: the app's reduce-motion setting and the OS preference
// both switch CSS animations off already.
export const enterSx = {
  animation: `${enter} 320ms cubic-bezier(0.22, 1, 0.36, 1) both`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
} as const;

/** Warm paper in light; in dark the card tone, a step up from the page behind it. */
export const paperBackground = (theme: Theme): string =>
  theme.palette.mode === 'dark' ? 'var(--card)' : 'var(--background)';

export const paperSx = {
  // Over the whole screen (the Dialog is fullScreen), on the warm paper.
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  bgcolor: paperBackground,
  backgroundImage: 'none',
} satisfies SxProps<Theme>;

/** Headings take programmatic focus when their screen appears; they are not controls. */
export const focusableTitleSx = { '&:focus': { outline: 'none' } } as const;

export const footerSx = {
  display: 'flex',
  flexWrap: { xs: 'wrap', sm: 'nowrap' },
  alignItems: 'center',
  columnGap: { xs: 1, md: 2 },
  rowGap: 1.5,
  px: { xs: 2, md: 4 },
  py: 1.75,
  borderTop: '1px solid var(--border)',
} satisfies SxProps<Theme>;

export const closeButtonSx = {
  color: 'var(--text-muted)',
  fontWeight: 500,
} satisfies SxProps<Theme>;

// Small screens: the dots take a row of their own above the buttons.
export const dotsSx = {
  flex: { xs: '1 0 100%', sm: 1 },
  order: { xs: -1, sm: 0 },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 0,
} satisfies SxProps<Theme>;

/** An 8px dot inside a 16px target; the current one is a short sage pill. */
export function dotSx(current: boolean): SxProps<Theme> {
  return {
    width: current ? 26 : 16,
    height: 16,
    p: '4px',
    border: 0,
    borderRadius: 999,
    backgroundClip: 'content-box',
    bgcolor: current ? 'var(--primary)' : 'var(--text-muted)',
    opacity: current ? 1 : 0.32,
    cursor: 'pointer',
    transition: 'width 200ms ease, opacity 150ms ease',
    '&:hover': { opacity: current ? 1 : 0.6 },
    '&:focus-visible': { outline: '2px solid var(--primary)', outlineOffset: 1 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  };
}

export const footerActionsSx = {
  display: 'flex',
  gap: 1,
  marginInlineStart: 'auto',
} satisfies SxProps<Theme>;

// Chevrons point the way the pages turn, which is the other way round right-to-left.
export const directionalIconSx = {
  display: 'inline-flex',
  '[dir="rtl"] &': { transform: 'scaleX(-1)' },
} satisfies SxProps<Theme>;
