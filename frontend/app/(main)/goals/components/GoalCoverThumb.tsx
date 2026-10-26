'use client';

import Box from '@mui/material/Box';
import { Flag } from '@/app/components/icons';
import { apiBaseUrl } from '@/app/lib/api';
import { tokens } from '@/lib/theme-tokens';
import type { GoalCover } from '../hooks/useGoals';
import { findGoalCoverPreset, type GoalCoverPreset } from '../lib/goal-cover-presets';

interface GoalCoverThumbProps {
  cover: GoalCover | null;
  size?: number;
  alt: string;
}

/** The API serves /uploads as static files, one level above its /api/v1 base. */
const uploadsOrigin = apiBaseUrl.replace(/\/api\/v1$/, '');

/** A bundled cover as a flat earthy tile with its line icon; none = the neutral badge. */
export function GoalPresetTile({
  preset,
  size,
  label,
}: {
  preset: GoalCoverPreset | null;
  /** Omitted: fills its parent (the picker's tiles). */
  size?: number;
  label?: string;
}) {
  const Icon = preset?.Icon ?? Flag;
  const iconSize = size ? Math.round(size * 0.46) : 28;
  return (
    <span
      className="seneca-goal-cover"
      data-tone={preset?.tone ?? 'none'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      style={size ? { width: size, height: size } : undefined}
    >
      <Icon size={iconSize} />
    </span>
  );
}

/**
 * The square on the left of a goal. A preset is a flat tile in one of the
 * app's earthy tones; a photo is a stored upload served by the API, which is
 * the only other origin the page's CSP allows images from.
 */
export function GoalCoverThumb({ cover, size = 56, alt }: GoalCoverThumbProps) {
  if (cover?.kind === 'photo') {
    return (
      <Box
        component="img"
        src={`${uploadsOrigin}${cover.url}`}
        alt={alt}
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: tokens.radius.md,
          objectFit: 'cover',
          bgcolor: 'var(--icon-badge-bg)',
        }}
      />
    );
  }
  const preset = cover?.kind === 'preset' ? findGoalCoverPreset(cover.preset) : null;
  return <GoalPresetTile preset={preset} size={size} label={alt} />;
}
