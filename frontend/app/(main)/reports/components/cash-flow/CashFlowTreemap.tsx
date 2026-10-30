'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { slicePercent } from '@/app/components/charts/CategoryDonut';
import { ChartTooltipCard } from '@/app/components/charts/ChartParts';
import { categoryTones } from '@/app/components/charts/chart-theme';
import { PRIVATE_CLASS, PRIVATE_REVEAL_CLASS } from '@/app/components/ui/private-amount';
import { resolveCategoryVisual } from '@/app/lib/category-defaults';
import { useCategoryName } from '@/app/lib/use-category-name';
import { layoutTreemap, type TileLabel, tileLabel } from './treemap-layout';
import type { CashFlowMapData } from './useCashFlowMap';

// The app's own type, in near-black: readable on every earthy tone in both themes.
const TILE_INK = '#1b1a18';
const ONE_LINE = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

/**
 * As much of the tile's caption as fits: name and amount, the name alone, or
 * the category's icon. HTML inside the SVG, so a long name ends in an ellipsis
 * instead of running into the next tile.
 */
function TileCaption({
  label,
  name,
  icon,
  amount,
  height,
}: {
  label: Exclude<TileLabel, 'none'>;
  name: string;
  icon: string | null;
  amount: string;
  height: number;
}): React.JSX.Element {
  if (label === 'icon') {
    const visual = resolveCategoryVisual({ name, icon });
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        {visual.iconUrl ? (
          <Box component="img" src={visual.iconUrl} alt="" sx={{ width: 16, height: 16 }} />
        ) : (
          <visual.Icon size={16} color={TILE_INK} />
        )}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // A short strip holds its one line in the middle.
        justifyContent: height < 34 ? 'center' : 'flex-start',
        height: '100%',
        px: '10px',
        pt: height < 34 ? 0 : '8px',
        color: TILE_INK,
        fontFamily: 'var(--font-dashboard-sans)',
        fontSize: 13,
        lineHeight: '18px',
      }}
    >
      <Box sx={{ ...ONE_LINE, fontWeight: 500 }}>{name}</Box>
      {label === 'full' ? (
        <Box className={PRIVATE_CLASS} sx={{ ...ONE_LINE, fontWeight: 400, opacity: 0.75 }}>
          {amount}
        </Box>
      ) : null}
    </Box>
  );
}

interface CashFlowTreemapProps {
  items: CashFlowMapData['treemap'];
  formatAmount: (value: number) => string;
  /** Opens a category's documents. */
  onOpen: (categoryId: string) => void;
  /** The way back from a category's subcategories. */
  backLabel: string;
  height?: number;
}

/**
 * Categories as tiles sized by spend. A tile with subcategories opens them;
 * any other tile, or a subcategory, opens its documents.
 */
export function CashFlowTreemap({
  items,
  formatAmount,
  onOpen,
  backLabel,
  height = 320,
}: CashFlowTreemapProps) {
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
        icon: string | null;
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
  const total = tiles.reduce((sum, tile) => sum + tile.item.value, 0);

  if (items.length === 0) return null;

  const open = (id: string): void => {
    const item = items.find(entry => entry.id === id);
    if (!focused && item && item.children.length > 0) setFocus(id);
    else onOpen(id);
  };

  return (
    <Box ref={boxRef} sx={{ width: '100%' }}>
      {focused ? (
        <Button
          size="small"
          onClick={() => setFocus(null)}
          sx={{ mb: 1, px: 1, color: 'var(--primary)', textTransform: 'none' }}
        >
          ← {backLabel}
        </Button>
      ) : null}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={focused ? categoryName(focused.name) : 'treemap'}
        style={{ display: 'block', borderRadius: 8 }}
      >
        {tiles.map(tile => {
          const label = tileLabel(tile.width, tile.height);
          const name = categoryName(tile.item.name);
          const amount = formatAmount(tile.item.value);
          return (
            <Tooltip
              key={tile.id}
              followCursor
              // Every tile, however small, names itself and its share under the pointer.
              title={
                <ChartTooltipCard
                  title={name}
                  rows={[
                    {
                      value: `${amount} · ${slicePercent(tile.item.value, total)}%`,
                      tone: 'strong',
                    },
                  ]}
                />
              }
              slotProps={{ tooltip: { sx: { bgcolor: 'transparent', p: 0, maxWidth: 'none' } } }}
            >
              <g
                role="button"
                tabIndex={0}
                aria-label={`${name} ${amount}`}
                onClick={() => open(tile.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open(tile.id);
                  }
                }}
                // The caption takes no pointer: the whole tile shows its amount.
                className={PRIVATE_REVEAL_CLASS}
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
                {label !== 'none' && (
                  <foreignObject
                    x={tile.x}
                    y={tile.y}
                    width={tile.width}
                    height={tile.height}
                    style={{ pointerEvents: 'none' }}
                  >
                    <TileCaption
                      label={label}
                      name={name}
                      icon={tile.item.icon}
                      amount={amount}
                      height={tile.height}
                    />
                  </foreignObject>
                )}
              </g>
            </Tooltip>
          );
        })}
      </svg>
    </Box>
  );
}
