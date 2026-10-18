'use client';

import Box from '@mui/material/Box';
import Image from 'next/image';
import { memo } from 'react';
import { Check } from '@/app/components/icons';
import { BACKGROUND_ALT, backgroundCredit, PLAIN_BACKGROUND } from '../constants';

interface BackgroundSelectorProps {
  selectedBackground: string | null;
  onSelect: (background: string) => void;
  backgrounds: string[];
  compact?: boolean;
  /** Offers a flat warm tile first: a workspace without a photo. */
  plainLabel?: string;
}

interface BackgroundCardProps {
  background: string;
  selected: boolean;
  compact: boolean;
  onSelect: (background: string) => void;
  plainLabel?: string;
}

/** The pick is a 2px sage frame and a small check in the corner, as on the "New table" cards. */
const tileSx = (selected: boolean) =>
  ({
    position: 'relative',
    overflow: 'hidden',
    p: 0,
    border: 0,
    borderRadius: '8px',
    outline: selected ? '2px solid var(--primary)' : '2px solid transparent',
    outlineOffset: '2px',
    background: 'none',
    cursor: 'pointer',
    transition: 'outline-color 120ms ease',
    '&:hover': { outlineColor: selected ? 'var(--primary)' : 'var(--border)' },
    '&:focus-visible': { outlineColor: 'var(--primary)' },
  }) as const;

function PickedCheck() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: '50%',
        bgcolor: 'var(--primary-fill)',
        color: 'var(--primary-foreground)',
      }}
    >
      <Check size={14} />
    </Box>
  );
}

const BackgroundCard = memo(function BackgroundCard({
  background,
  selected,
  compact,
  onSelect,
  plainLabel,
}: BackgroundCardProps) {
  const plain = background === PLAIN_BACKGROUND;
  const alt = plain ? (plainLabel ?? '') : (BACKGROUND_ALT[background] ?? '');
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      aria-label={alt || undefined}
      title={plain ? plainLabel : (backgroundCredit(background) ?? undefined)}
      onClick={() => onSelect(background)}
      sx={{ ...tileSx(selected), aspectRatio: compact ? '2.35/1' : '16/9' }}
    >
      {plain ? (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'var(--icon-badge-bg)',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          {plainLabel}
        </Box>
      ) : (
        <Image
          src={`/workspace-backgrounds/${background}`}
          alt={alt}
          fill
          sizes={
            compact
              ? '(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 180px'
              : '(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 260px'
          }
          quality={60}
          loading="lazy"
          style={{ objectFit: 'cover' }}
        />
      )}
      {selected ? <PickedCheck /> : null}
    </Box>
  );
});

export const BackgroundSelector = memo(function BackgroundSelector({
  selectedBackground,
  onSelect,
  backgrounds,
  compact = false,
  plainLabel,
}: BackgroundSelectorProps) {
  const minColumnWidth = compact ? 150 : 220;
  const tiles = plainLabel ? [PLAIN_BACKGROUND, ...backgrounds] : backgrounds;

  return (
    <Box
      sx={{ display: 'grid', gap: compact ? 1 : 1.5, p: '4px' }}
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))` }}
    >
      {tiles.map(background => (
        <BackgroundCard
          key={background}
          background={background}
          selected={selectedBackground === background}
          compact={compact}
          onSelect={onSelect}
          plainLabel={plainLabel}
        />
      ))}
    </Box>
  );
});

BackgroundSelector.displayName = 'BackgroundSelector';
