'use client';

import Box from '@mui/material/Box';
import { useEffect, useMemo, useRef, useState } from 'react';
import { categoryTones } from '@/app/components/charts/chart-theme';
import { useCategoryName } from '@/app/lib/use-category-name';
import { layoutTreemap } from './treemap-layout';
import type { CashFlowMapData } from './useCashFlowMap';

interface CashFlowTreemapProps {
  items: CashFlowMapData['treemap'];
  formatAmount: (value: number) => string;
  height?: number;
}

/** Categories as tiles sized by spend; click a tile to see its subcategories. */
export function CashFlowTreemap({ items, formatAmount, height = 320 }: CashFlowTreemapProps) {
  const [focus, setFocus] = useState<string | null>(null);
  const categoryName = useCategoryName();
  // Laid out at the box's real width: a fixed frame stretched to fit
  // (preserveAspectRatio="none") stretched the lettering with it.
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1000);
  useEffect(() => {
    const element = boxRef.current;
    // Without ResizeObserver (old engines, tests) the default frame stands.
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(entries => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) {
        setWidth(measured);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const focused = items.find(item => item.id === focus);
  const tiles = useMemo(() => {
    const source = focused && focused.children.length > 0 ? focused.children : items;
    return layoutTreemap(source, width, height).map(tile => ({
      ...tile,
      item: source.find(entry => entry.id === tile.id) as {
        id: string;
        name: string;
        value: number;
      },
    }));
  }, [focused, items, height, width]);
  // The same earthy tone per category as the donut and the sankey.
  const tones = useMemo(() => {
    // Uncategorised spending takes the stone of "Other", not a category tone.
    const keys = tiles.map(tile => ({ key: tile.item.name, isOther: tile.id === '__none__' }));
    const colors = categoryTones(keys);
    return new Map(tiles.map((tile, index) => [tile.id, colors[index]]));
  }, [tiles]);

  if (items.length === 0) return null;

  return (
    <Box ref={boxRef} sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={focused ? categoryName(focused.name) : 'treemap'}
        style={{ display: 'block', borderRadius: 8 }}
      >
        {tiles.map(tile => (
          <g
            key={tile.id}
            role="button"
            tabIndex={0}
            aria-label={`${categoryName(tile.item.name)} ${formatAmount(tile.item.value)}`}
            onClick={() => setFocus(focused ? null : tile.id)}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setFocus(focused ? null : tile.id);
              }
            }}
            style={{ cursor: 'pointer' }}
            data-testid={`treemap-tile-${tile.id}`}
          >
            <rect
              x={tile.x}
              y={tile.y}
              width={tile.width}
              height={tile.height}
              fill={tones.get(tile.id) ?? 'var(--cat-tone-other)'}
              stroke="var(--background, #fff)"
              strokeWidth={3}
              rx={6}
            />
            {tile.width > 90 && tile.height > 34 && (
              // The app's own type, in near-black: readable on every earthy tone in both themes.
              <text
                x={tile.x + 10}
                y={tile.y + 22}
                fill="#1b1a18"
                fontSize={13}
                fontWeight={500}
                style={{ pointerEvents: 'none', fontFamily: 'var(--font-dashboard-sans), inherit' }}
              >
                {categoryName(tile.item.name)}
                <tspan x={tile.x + 10} dy={18} fontSize={13} fontWeight={400} opacity={0.75}>
                  {formatAmount(tile.item.value)}
                </tspan>
              </text>
            )}
          </g>
        ))}
      </svg>
    </Box>
  );
}
