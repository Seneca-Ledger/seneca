import type React from 'react';

export interface SparklineProps {
  points: number[];
  color?: string;
  fill?: boolean;
  h?: number;
  w?: number;
}

// Keeps the stroke inside the box so neither edge clips it; a flat series sits mid-height.
// eslint-disable-next-line max-params
function linePath(points: number[], w: number, h: number): string {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min;
  const step = w / (points.length - 1);
  const pad = 2;
  const y = (p: number): number =>
    range === 0 ? h / 2 : pad + (1 - (p - min) / range) * (h - pad * 2);
  return (
    points
      // eslint-disable-next-line max-params
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${y(p)}`)
      .join(' ')
  );
}

/**
 * Tiny inline SVG line used inside KPI cards. Renders nothing for fewer than two
 * points. Defaults to `currentColor` so the theme decides the hue via CSS and
 * server and client markup stay identical.
 */
export function Sparkline({
  points,
  color = 'currentColor',
  fill = true,
  h = 38,
  w = 120,
}: SparklineProps): React.JSX.Element | null {
  if (points.length < 2) {
    return null;
  }
  const d = linePath(points, w, h);
  const fillD = `${d} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {fill && <path d={fillD} fill={color} opacity="0.08" />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
