import type {
  SpendFlowData,
  SpendFlowNode,
} from '@/app/(main)/statements/components/analytics/flow/useSpendFlow';
import { categoryColorFor, NEUTRAL_CATEGORY_COLOR } from '@/app/lib/category-defaults';
import { tokens } from '@/lib/theme-tokens';

export type SpendFlowChartLabels = {
  total: string;
  uncategorised: string;
  unknownMerchant: string;
  /** `{{count}}` is substituted. */
  otherMerchants: string;
  /** `{{count}}` is substituted. */
  otherCategories: string;
  /** Spending booked on a category itself, next to its subcategories. */
  noSubcategory: string;
};

export type SpendFlowChartOptions = {
  /** Drops the third column: a phone has no room for three ranks of labels. */
  compact: boolean;
  isIncome: boolean;
};

/**
 * Categories without a colour of their own still need distinct ones, or a
 * workspace of custom categories reads as one grey band.
 */
const FALLBACK_PALETTE = [
  '#0ea5e9',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#10b981',
  '#ef4444',
  '#14b8a6',
  '#6366f1',
  '#eab308',
  '#f97316',
];

/**
 * ECharts sizes sankey nodes by value and has no minimum node height, so a
 * small merchant is a sliver separated from its neighbour by `nodeGap` alone.
 * The gap therefore has to fit a whole two-line label (2 × LINE_HEIGHT).
 */
const LINE_HEIGHT = 14;
const NODE_GAP = 2 * LINE_HEIGHT + 2;
/** Height shared out by value, on top of the gaps. */
const VALUE_SPACE = 360;
const VERTICAL_PADDING = 24;
const MIN_HEIGHT = 420;

const isOtherCategories = (node: SpendFlowNode): boolean => node.id === 'cat:__other__';

/** Nodes and links that are drawn, after the compact cut. */
export function visibleSpendFlow(
  data: Pick<SpendFlowData, 'nodes' | 'links'>,
  compact: boolean,
): Pick<SpendFlowData, 'nodes' | 'links'> {
  if (!compact) {
    return data;
  }
  const links = data.links.filter(link => link.source === 'total');
  const kept = new Set(['total', ...links.map(link => link.target)]);
  return { nodes: data.nodes.filter(node => kept.has(node.id)), links };
}

/**
 * The second-column node a `?focus=` deep link names, or null when this month's
 * flow has no such band. Links name a category (or a merchant) by its label,
 * lowercased — the leaderboard has no ids either — while the chart keys nodes
 * by id, so the two meet here.
 */
export function findSpendFlowNodeId(
  data: Pick<SpendFlowData, 'nodes' | 'links'>,
  name: string | null | undefined,
): string | null {
  if (!name) {
    return null;
  }
  const wanted = name.trim().toLowerCase();
  const secondColumn = new Set(
    data.links.filter(link => link.source === 'total').map(link => link.target),
  );
  const match = data.nodes.find(
    node => secondColumn.has(node.id) && node.name?.trim().toLowerCase() === wanted,
  );
  return match?.id ?? null;
}

/** A label-sized gap per node of the busiest column, plus room for the values. */
export function spendFlowChartHeight(
  data: Pick<SpendFlowData, 'nodes' | 'links'>,
  compact: boolean,
): number {
  const { links } = visibleSpendFlow(data, compact);
  const perColumn = new Map<string, number>();
  for (const link of links) {
    const column = link.source === 'total' ? 'second' : 'third';
    perColumn.set(column, (perColumn.get(column) ?? 0) + 1);
  }
  const busiest = Math.max(0, ...perColumn.values());
  const gaps = Math.max(0, busiest - 1) * NODE_GAP;
  return Math.max(MIN_HEIGHT, gaps + VALUE_SPACE + VERTICAL_PADDING);
}

/**
 * ECharts sankey option for the analytics flow (top spenders, categories,
 * merchants). Free of React so the
 * colour, label and compact rules can be asserted directly.
 */
export function buildSpendFlowSankey(
  data: SpendFlowData,
  resolvedTheme: string | undefined,
  labels: SpendFlowChartLabels,
  formatAmount: (value: number) => string,
  options: SpendFlowChartOptions,
): Record<string, unknown> {
  const isDark = resolvedTheme === 'dark';
  const color = isDark ? tokens.dark.color : tokens.color;
  const { nodes, links } = visibleSpendFlow(data, options.compact);
  const byId = new Map(nodes.map(node => [node.id, node]));

  const labelOf = (node: SpendFlowNode): string => {
    if (node.kind === 'total') {
      return labels.total;
    }
    if (isOtherCategories(node)) {
      return labels.otherCategories.replace('{{count}}', String(node.mergedCount ?? 0));
    }
    if (node.kind === 'other') {
      return labels.otherMerchants.replace('{{count}}', String(node.mergedCount ?? 0));
    }
    if (node.name) {
      return node.name;
    }
    if (node.kind === 'category') {
      return labels.uncategorised;
    }
    return node.kind === 'subcategory' ? labels.noSubcategory : labels.unknownMerchant;
  };
  const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;

  // The second column picks colours first: a category its own (or the next
  // palette colour), a merchant straight under the total the next palette
  // colour. Third-column nodes inherit their parent's, so every band reads
  // as one hue from left to right.
  const parentOf = new Map(links.map(link => [link.target, link.source]));
  const columnColor = new Map<string, string>();
  let fallbackIndex = 0;
  const nextPalette = (): string => FALLBACK_PALETTE[fallbackIndex++ % FALLBACK_PALETTE.length];
  for (const node of nodes) {
    if (parentOf.get(node.id) !== 'total' || node.kind === 'other') {
      continue;
    }
    if (node.kind !== 'category') {
      columnColor.set(node.id, nextPalette());
      continue;
    }
    const own = node.name ? categoryColorFor(node.name, node.color) : NEUTRAL_CATEGORY_COLOR;
    const uncategorised = node.id === 'cat:__none__';
    columnColor.set(node.id, own !== NEUTRAL_CATEGORY_COLOR || uncategorised ? own : nextPalette());
  }
  const nodeColor = (node: SpendFlowNode): string => {
    if (node.kind === 'total') {
      return options.isIncome ? color.success : color.primary;
    }
    if (isOtherCategories(node)) {
      return color.catOther;
    }
    return (
      columnColor.get(node.id) ?? columnColor.get(parentOf.get(node.id) ?? '') ?? color.catOther
    );
  };

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: {
        dataType?: string;
        name?: string;
        value?: unknown;
        data?: { source?: string; target?: string };
      }) => {
        if (params.dataType === 'edge') {
          const source = byId.get(params.data?.source ?? '');
          const target = byId.get(params.data?.target ?? '');
          const route = source && target ? `${labelOf(source)} → ${labelOf(target)}<br/>` : '';
          return `${route}${formatAmount(Number(params.value ?? 0))}`;
        }
        const node = byId.get(String(params.name ?? ''));
        return node
          ? `${labelOf(node)}<br/>${formatAmount(node.amount)} · ${percent(node.share)}`
          : '';
      },
    },
    series: [
      {
        type: 'sankey',
        left: 8,
        right: 8,
        top: 12,
        bottom: 12,
        // Left, not justify: "other categories" has no merchants and would
        // otherwise be pushed into the merchant column.
        nodeAlign: 'left',
        // Keep the server's order (largest first). ECharts' relaxation pass
        // would reshuffle nodes and cross bands that never need to cross.
        layoutIterations: 0,
        nodeWidth: 16,
        nodeGap: NODE_GAP,
        draggable: false,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', opacity: isDark ? 0.4 : 0.3, curveness: 0.5 },
        itemStyle: { borderWidth: 0, borderRadius: 2 },
        label: {
          position: 'left',
          color: color.textPrimary,
          fontSize: 11,
          lineHeight: LINE_HEIGHT,
          width: 180,
          overflow: 'truncate',
          formatter: (params: { name?: string }) => {
            const node = byId.get(String(params.name ?? ''));
            if (!node) {
              return '';
            }
            return `{n|${labelOf(node)}}\n{v|${formatAmount(node.amount)} (${percent(node.share)})}`;
          },
          rich: {
            n: { fontSize: 11, lineHeight: LINE_HEIGHT, color: color.textSecondary },
            v: {
              fontSize: 11,
              lineHeight: LINE_HEIGHT,
              fontWeight: 600,
              color: color.textPrimary,
            },
          },
        },
        // Only what the renderer needs: ECharts reads stray `id`/`color: null`
        // keys on a data item and silently draws nothing (see goal-flow.chart).
        data: nodes.map(node => ({
          name: node.id,
          itemStyle: { color: nodeColor(node) },
          ...(node.kind === 'total' ? { label: { position: 'right' } } : {}),
        })),
        links,
      },
    ],
  };
}
