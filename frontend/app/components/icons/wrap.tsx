/** The Lucide-style props on top of an MUI icon, and the wrapper that adapts one. */
import type { SvgIconProps } from '@mui/material';
import React from 'react';

// ---------------------------------------------------------------------------
// Compat prop types (mirror Lucide's API)
// ---------------------------------------------------------------------------

export interface LucideProps extends Omit<SvgIconProps, 'color' | 'fontSize'> {
  /** Lucide size → MUI sx.fontSize */
  size?: number | string;
  /** Supports hex colors in addition to MUI theme tokens */
  color?: string;
  /** Lucide stroke weight – no-op for MUI filled icons */
  strokeWidth?: number;
}

export type LucideIcon = React.FC<LucideProps>;

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

export function wrap(MuiIcon: React.ComponentType<SvgIconProps>): LucideIcon {
  return function LucideCompatIcon({
    size,
    color,
    strokeWidth: StrokeWidth,
    sx,
    ...rest
  }: LucideProps) {
    const combinedSx = {
      ...(size != null ? { fontSize: size } : {}),
      ...(color != null ? { color } : {}),
      ...(sx as object | undefined),
    };
    return (
      <MuiIcon
        {...(rest as SvgIconProps)}
        sx={Object.keys(combinedSx).length > 0 ? combinedSx : undefined}
      />
    );
  };
}
