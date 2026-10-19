'use client';

import Box from '@mui/material/Box';

/**
 * A placeholder shaped like the sankey it stands for — total, categories,
 * merchants and the bands between them — so the card does not change shape
 * when the data lands. Drawn in viewBox units and stretched to the card width.
 */
const WIDTH = 1000;
const HEIGHT = 420;
const NODE = 16;
const GAP = 18;
const COLUMNS = [0, (WIDTH - NODE) / 2, WIDTH - NODE];

type Node = { y: number; h: number };

const stack = (heights: number[]): Node[] => {
  let y = 0;
  return heights.map(h => {
    const node = { y, h };
    y += h + GAP;
    return node;
  });
};

const CATEGORIES = stack([150, 75, 55, 30]);
const MERCHANTS = stack([65, 50, 35, 45, 30, 35, 20]);
/** Which merchants each category feeds; the last category has none, like "other categories". */
const FEEDS = [[0, 1, 2], [3, 4], [5, 6], []];
const TOTAL: Node = { y: 0, h: CATEGORIES.reduce((sum, node) => sum + node.h, 0) };

/** A band of thickness `h` from (x0, y0) to (x1, y1), as a filled cubic curve. */
const band = (x0: number, y0: number, x1: number, y1: number, h: number): string => {
  const mid = (x0 + x1) / 2;
  return `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1} L${x1},${y1 + h} C${mid},${y1 + h} ${mid},${y0 + h} ${x0},${y0 + h} Z`;
};

/** Two columns: the total feeding the merchants directly (top merchants). */
const TOTAL_TWO_COLUMNS: Node = { y: 0, h: MERCHANTS.reduce((sum, node) => sum + node.h, 0) };

function twoColumnBands(): string[] {
  let fromTotal = 0;
  return MERCHANTS.map(merchant => {
    const path = band(COLUMNS[0] + NODE, fromTotal, COLUMNS[2], merchant.y, merchant.h);
    fromTotal += merchant.h;
    return path;
  });
}

function bands(): string[] {
  const paths: string[] = [];
  let fromTotal = TOTAL.y;
  CATEGORIES.forEach((category, index) => {
    paths.push(band(COLUMNS[0] + NODE, fromTotal, COLUMNS[1], category.y, category.h));
    fromTotal += category.h;
    let fromCategory = category.y;
    for (const merchantIndex of FEEDS[index]) {
      const merchant = MERCHANTS[merchantIndex];
      paths.push(band(COLUMNS[1] + NODE, fromCategory, COLUMNS[2], merchant.y, merchant.h));
      fromCategory += merchant.h;
    }
  });
  return paths;
}

const label = (x: number, node: Node, alignRight: boolean): React.JSX.Element => {
  const cy = node.y + node.h / 2;
  const at = (width: number) => (alignRight ? x - 8 - width : x + NODE + 8);
  return (
    <g key={`label-${x}-${node.y}`}>
      <rect x={at(90)} y={cy - 11} width={90} height={8} rx={4} />
      <rect x={at(64)} y={cy + 3} width={64} height={8} rx={4} />
    </g>
  );
};

/** `columns` follows the chart it stands for: 3 for category flows, 2 for merchants. */
export function SpendFlowSkeleton({ columns = 3 }: { columns?: 2 | 3 }): React.JSX.Element {
  const threeColumns = columns === 3;
  const total = threeColumns ? TOTAL : TOTAL_TWO_COLUMNS;
  return (
    <Box
      role="progressbar"
      aria-busy="true"
      sx={{
        height: HEIGHT,
        color: 'var(--muted-foreground)',
        '@keyframes spendFlowPulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        animation: 'spendFlowPulse 1.5s ease-in-out infinite',
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <g fill="currentColor" opacity={0.08}>
          {(threeColumns ? bands() : twoColumnBands()).map(path => (
            <path key={path} d={path} />
          ))}
        </g>
        <g fill="currentColor" opacity={0.22}>
          <rect x={COLUMNS[0]} y={total.y} width={NODE} height={total.h} rx={2} />
          {(threeColumns ? CATEGORIES : []).map(node => (
            <rect
              key={`c-${node.y}`}
              x={COLUMNS[1]}
              y={node.y}
              width={NODE}
              height={node.h}
              rx={2}
            />
          ))}
          {MERCHANTS.map(node => (
            <rect
              key={`m-${node.y}`}
              x={COLUMNS[2]}
              y={node.y}
              width={NODE}
              height={node.h}
              rx={2}
            />
          ))}
        </g>
        <g fill="currentColor" opacity={0.14}>
          {label(COLUMNS[0], total, false)}
          {(threeColumns ? CATEGORIES : []).map(node => label(COLUMNS[1], node, true))}
          {MERCHANTS.map(node => label(COLUMNS[2], node, true))}
        </g>
      </svg>
    </Box>
  );
}
