import type { SxProps, Theme } from '@mui/material';
import { paperBackground } from './welcome-tutorial.styles';

// A column: the screenshots take whatever height the text and captions leave, so a
// page fits the screen without scrolling (it scrolls only when the screen is tiny).
export const bodySx = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  px: { xs: 2, md: 5 },
  pt: { xs: 3, md: 4 },
  pb: 3,
} satisfies SxProps<Theme>;

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
  maxWidth: 760,
  fontSize: { xs: 15, md: 16 },
  lineHeight: 1.6,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;

/**
 * Desktop: the frames and their captions take the height the text leaves, never
 * less than a readable size. A size container, so the grid can be measured by it.
 */
export const fragmentAreaSx = {
  flex: 1,
  minHeight: 320,
  containerType: 'size',
} satisfies SxProps<Theme>;

// Room the captions under the grid need, with the grid's top margin.
const CAPTIONS_RESERVE = '128px';
const GAP = '16px';

/**
 * The frames and their captions as one block, as wide as the frames can be: the
 * width of the area, or less when the height runs out first. `heightPerWidth` is the
 * grid's height for each pixel of its width (gaps taken off), from the screenshots'
 * proportions. The frames then fill their cells exactly, with no gaps beside them.
 */
export function fragmentBlockSx(heightPerWidth: number): SxProps<Theme> {
  return {
    '--grid-width': `min(100cqw, calc((100cqh - ${CAPTIONS_RESERVE}) / ${heightPerWidth.toFixed(4)} + ${GAP}))`,
    width: 'var(--grid-width)',
  };
}

const gridHeight = (heightPerWidth: number): string =>
  `calc((var(--grid-width) - ${GAP}) * ${heightPerWidth.toFixed(4)})`;

/** The large frame: 1.44 of 2.44 columns, proportions 1.55 (FRAME_ASPECT.hero). */
export const BENTO_HEIGHT_PER_WIDTH = 1.44 / 2.44 / 1.55;
/** Two equal columns, proportions 1.55 (FRAME_ASPECT.pair). */
export const PAIR_HEIGHT_PER_WIDTH = 1 / 2 / 1.55;

export const bentoSx = {
  mt: 3,
  height: gridHeight(BENTO_HEIGHT_PER_WIDTH),
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.44fr) minmax(0, 1fr)',
  gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
  gap: 2,
  '& > :first-of-type': { gridRow: 'span 2' },
} satisfies SxProps<Theme>;

export const pairSx = {
  mt: 3,
  height: gridHeight(PAIR_HEIGHT_PER_WIDTH),
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gridTemplateRows: 'minmax(0, 1fr)',
  gap: 2,
} satisfies SxProps<Theme>;

/**
 * A cell of the desktop grid. It is a size container, so the frame inside can take
 * the largest box of the screenshot's proportions that fits the cell.
 */
export const frameCellSx = {
  height: '100%',
  minHeight: 0,
  containerType: 'size',
} satisfies SxProps<Theme>;

/**
 * Holds the screenshot's proportions; the number sits on its corner, outside the
 * screenshot. In a grid cell it is as large as the cell allows, never cropped.
 */
export function frameSlotSx(aspect: number, fill: boolean): SxProps<Theme> {
  return {
    position: 'relative',
    aspectRatio: String(aspect),
    ...(fill ? { width: `min(100cqw, calc(100cqh * ${aspect}))` } : {}),
  };
}

export const frameSx = {
  position: 'absolute',
  inset: 0,
  borderRadius: '12px',
  overflow: 'hidden',
  // A hairline, no shadow; the soft fill shows while the screenshot loads.
  border: '1px solid var(--border)',
  bgcolor: 'var(--surface-soft)',
} satisfies SxProps<Theme>;

/** A small sage digit in a thin sage ring, on the paper's own colour. */
export const badgeSx = {
  position: 'absolute',
  top: -9,
  insetInlineStart: -9,
  zIndex: 1,
  width: 22,
  height: 22,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--primary)',
  bgcolor: paperBackground,
  color: 'var(--primary)',
  fontSize: 12,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums',
} satisfies SxProps<Theme>;

export function captionsSx(count: number): SxProps<Theme> {
  return {
    mt: 2,
    display: 'grid',
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    gap: 2,
  };
}

export const captionSx = {
  display: 'flex',
  gap: 1.25,
  alignItems: 'flex-start',
} satisfies SxProps<Theme>;

export const captionNumberSx = {
  ...badgeSx,
  position: 'static',
  flexShrink: 0,
} satisfies SxProps<Theme>;

export const captionTitleSx = {
  fontSize: 14,
  fontWeight: 500,
  color: 'var(--foreground)',
} satisfies SxProps<Theme>;

export const captionTextSx = {
  mt: 0.25,
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;

export const scrollerSx = {
  mt: 1.5,
  mx: -2,
  px: 2,
  // Room for the numbers on the frames' corners: a scroll box clips both axes.
  pt: 1.25,
  pb: 1,
  display: 'flex',
  gap: 1.5,
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  // Snap to the padding, not to the edge, so the first frame's number stays visible.
  // Not a theme spacing key: sx passes it through as pixels.
  scrollPaddingInline: '16px',
  scrollbarWidth: 'none',
} satisfies SxProps<Theme>;

export const scrollItemSx = { flex: '0 0 86%', scrollSnapAlign: 'start' } satisfies SxProps<Theme>;

export const demoNoteSx = {
  mt: 2.5,
  fontSize: 13,
  color: 'var(--text-muted)',
} satisfies SxProps<Theme>;
