/*
 * Chart design adapted from Aurum by ZProger (https://github.com/ZProger/Aurum).
 * Reimplemented for Seneca; no Aurum source code was copied.
 */
'use client';

import { useRouter } from 'next/navigation';
import type React from 'react';
import { useRef, useState } from 'react';
import {
  Cell,
  Pie,
  PieChart,
  type PieSectorDataItem,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from 'recharts';
import { ChartTooltipCard } from './ChartParts';

export interface DonutSlice {
  key: string;
  name: string;
  value: number;
  color: string;
  /** Extra lines under the slice's amount in its tooltip. */
  details?: string[];
  /** Where a click on the slice goes; a slice without one is not clickable. */
  href?: string;
}

export interface CategoryDonutProps {
  slices: DonutSlice[];
  formatAmount: (value: number) => string;
}

/** Share of each slice in percent, one decimal. */
export function slicePercent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

/**
 * Every slice gets at least this many degrees: a 3% share would otherwise be a
 * hairline the pointer can hardly land on. The exact shares are in the list
 * beside the chart and in the tooltip.
 */
const MIN_SLICE_ANGLE = 6;
/** Gap between the pointer and the tooltip's corner, so the card never sits under it. */
const TOOLTIP_OFFSET_PX = 12;

/** The slice under the pointer, slightly darkened so it is clear which one it is. */
function ActiveSlice(props: PieSectorDataItem): React.JSX.Element {
  // recharts passes the slice's `key` among the props; React wants it set
  // directly, never spread, so it is pulled out here.
  const { key, ...sector } = props as PieSectorDataItem & { key?: React.Key };
  return <Sector key={key} {...sector} style={{ filter: 'brightness(0.88)' }} />;
}

/** Solid pie without labels or legend; the card renders its own list beside it. */
export function CategoryDonut({ slices, formatAmount }: CategoryDonutProps): React.JSX.Element {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  // recharts pins a pie tooltip to the middle of the slice's arc, which for a
  // large slice is one far-off spot wherever it is hovered. It follows the
  // pointer instead.
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const router = useRouter();
  // The slice under the pointer, read on the wrapper rather than on the slice.
  // Moving the pointer re-renders the chart, and recharts then replaces the
  // hovered slice's element; when that lands between press and release, Chrome
  // fires no `click` anywhere. Press and release still reach the wrapper, so a
  // press and release over the same slice is the click.
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredHref = hoveredIndex === null ? undefined : slices[hoveredIndex]?.href;
  const pressedHrefRef = useRef<string | undefined>(undefined);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a pointer shortcut; every slice's link is also in the list beside the chart, reachable by keyboard
    <div
      style={{ width: '100%', height: '100%', cursor: hoveredHref ? 'pointer' : undefined }}
      onPointerDown={event => {
        pressedHrefRef.current = event.button === 0 ? hoveredHref : undefined;
      }}
      onPointerUp={() => {
        const pressed = pressedHrefRef.current;
        pressedHrefRef.current = undefined;
        if (pressed && pressed === hoveredHref) {
          router.push(pressed);
        }
      }}
      onMouseMove={event => {
        const box = event.currentTarget.getBoundingClientRect();
        setPointer({ x: event.clientX - box.left, y: event.clientY - box.top });
      }}
      onMouseLeave={() => setPointer(null)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            position={
              pointer
                ? { x: pointer.x + TOOLTIP_OFFSET_PX, y: pointer.y + TOOLTIP_OFFSET_PX }
                : undefined
            }
            // The chart is small; the card may hang over its edges like any tooltip.
            allowEscapeViewBox={{ x: true, y: true }}
            content={({ active, payload }) => {
              const slice = payload?.[0]?.payload as DonutSlice | undefined;
              if (!(active && slice)) {
                return null;
              }
              return (
                <ChartTooltipCard
                  title={slice.name}
                  color={slice.color}
                  rows={[
                    {
                      value: `${formatAmount(slice.value)} · ${slicePercent(slice.value, total)}%`,
                      tone: 'strong',
                    },
                    ...(slice.details ?? []).map(value => ({ value })),
                  ]}
                />
              );
            }}
          />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            // A solid pie, no hole.
            innerRadius={0}
            outerRadius="90%"
            paddingAngle={slices.length > 1 ? 2 : 0}
            minAngle={slices.length > 1 ? MIN_SLICE_ANGLE : 0}
            activeShape={ActiveSlice}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
            onMouseEnter={(_sector, index) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {slices.map(slice => (
              <Cell key={slice.key} fill={slice.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
