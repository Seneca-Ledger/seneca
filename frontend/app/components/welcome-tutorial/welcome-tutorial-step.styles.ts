import type { SxProps, Theme } from '@mui/material';

/**
 * One guide page. On a wide screen two columns, centred on the screen: the words on
 * the left, one large picture of the page on the right, as tall as the screen allows
 * (it scrolls only when the screen is tiny). On a phone the picture comes after the
 * words.
 */
export const bodySx = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  maxWidth: 1440,
  mx: 'auto',
  overflowY: 'auto',
  px: { xs: 2, md: 6 },
  py: { xs: 3, md: 5 },
  display: { xs: 'flex', md: 'grid' },
  flexDirection: 'column',
  gap: { xs: 3, md: 6 },
  gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)',
  gridTemplateRows: 'minmax(0, 1fr)',
  // A phone stacks full-width blocks; a wide screen centres both columns vertically.
  alignItems: { xs: 'stretch', md: 'center' },
} satisfies SxProps<Theme>;

export const textColumnSx = { minWidth: 0 } satisfies SxProps<Theme>;

export const eyebrowSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  color: 'var(--primary)',
  fontSize: 14,
  fontWeight: 500,
} satisfies SxProps<Theme>;

export const taglineSx = {
  mt: 1,
  fontSize: { xs: 22, md: 28 },
  fontWeight: 500,
  lineHeight: 1.25,
  color: 'var(--foreground)',
} satisfies SxProps<Theme>;

export const descriptionSx = {
  mt: 1,
  fontSize: { xs: 15, md: 16 },
  lineHeight: 1.6,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;

export const pointsSx = {
  listStyle: 'none',
  p: 0,
  m: 0,
  mt: 3,
  display: 'grid',
  gap: 2,
} satisfies SxProps<Theme>;

export const pointTitleSx = {
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--foreground)',
} satisfies SxProps<Theme>;

export const pointTextSx = {
  mt: 0.25,
  fontSize: 14,
  lineHeight: 1.5,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;

/**
 * The picture's cell: on a wide screen a size container, so the picture can take the
 * largest box of its proportions that fits (container query units); on a phone just
 * the full width.
 */
export const pictureCellSx = {
  minWidth: 0,
  height: { md: '100%' },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  containerType: { md: 'size' },
} satisfies SxProps<Theme>;

export function pictureSx(aspect: number): SxProps<Theme> {
  return {
    position: 'relative',
    width: { xs: '100%', md: `min(100cqw, calc(100cqh * ${aspect}))` },
    aspectRatio: String(aspect),
    borderRadius: '12px',
    overflow: 'hidden',
    // A hairline, no shadow; the soft fill shows while the screenshot loads.
    border: '1px solid var(--border)',
    bgcolor: 'var(--surface-soft)',
  };
}

/** "Demo", on the picture itself: the figures are sample data, not the reader's. */
export const demoBadgeSx = {
  position: 'absolute',
  // Bottom corner: the top of a card holds its title and links.
  bottom: 10,
  insetInlineEnd: 10,
  px: 1,
  py: 0.25,
  borderRadius: 999,
  border: '1px solid var(--border)',
  bgcolor: 'var(--card)',
  color: 'var(--text-muted)',
  fontSize: 12,
  fontWeight: 500,
} satisfies SxProps<Theme>;

export const demoNoteSx = {
  mt: 3,
  fontSize: 13,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;
