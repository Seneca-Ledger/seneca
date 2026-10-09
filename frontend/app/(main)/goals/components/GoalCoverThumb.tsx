'use client';

import Box from '@mui/material/Box';
import { Flag } from '@/app/components/icons';
import { apiBaseUrl } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import type { GoalCover } from '../hooks/useGoals';
import { findGoalCoverPreset } from '../lib/goal-cover-presets';

interface GoalCoverThumbProps {
  cover: GoalCover | null;
  size?: number;
  alt: string;
}

/** The API serves /uploads as static files, one level above its /api/v1 base. */
const uploadsOrigin = apiBaseUrl.replace(/\/api\/v1$/, '');

/**
 * The square on the left of a goal. A preset is drawn here as a gradient tile;
 * a photo is a stored upload served by the API, which is the only other origin
 * the page's CSP allows images from.
 */
export function GoalCoverThumb({ cover, size = 56, alt }: GoalCoverThumbProps) {
  const radius = tokens.radius.md;

  if (cover?.kind === 'photo') {
    return (
      <Box
        component="img"
        src={`${uploadsOrigin}${cover.url}`}
        alt={alt}
        width={size}
        height={size}
        sx={{
          flexShrink: 0,
          borderRadius: radius,
          objectFit: 'cover',
          bgcolor: 'action.hover',
        }}
      />
    );
  }

  const preset = cover?.kind === 'preset' ? findGoalCoverPreset(cover.preset) : null;
  const Icon = preset?.Icon ?? Flag;

  return (
    <Box
      role="img"
      aria-label={alt}
      sx={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: radius,
        display: 'grid',
        placeItems: 'center',
        // No preset means no choice has been made yet: a flat token-coloured
        // tile, so an unset cover does not look like a deliberate one.
        background: preset ? `linear-gradient(135deg, ${preset.from}, ${preset.to})` : undefined,
        bgcolor: preset ? undefined : 'action.hover',
        color: preset ? '#fff' : 'text.disabled',
      }}
    >
      <Icon size={Math.round(size * 0.46)} />
    </Box>
  );
}
