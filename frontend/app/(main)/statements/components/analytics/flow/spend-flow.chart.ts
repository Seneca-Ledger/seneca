import type {
  SpendFlowData,
  SpendFlowGroupBy,
  SpendFlowNode,
} from '@/app/(main)/statements/components/analytics/flow/useSpendFlow';
import type { RowsTarget } from '@/app/(main)/statements/components/documents-for-rows';
import {
  CATEGORY_TONE_HEX,
  categoryTonesHex,
  OTHER_TONE_HEX,
} from '@/app/components/charts/chart-theme';
import { withMinBand } from '@/app/components/charts/sankey-min-band';
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
  /** How a stored category name reads in the user's language; merchants stay as written. */
  categoryName?: (name: string) => string;
  /** Privacy mode: node labels show the name only, no amount or share (the tooltip still does). */
  privacy?: boolean;
};

/**
 * ECharts sizes sankey nodes by value and has no minimum node height, so a
 * small merchant is a sliver separated from its neighbour by `nodeGap` alone.
 * The gap therefore has to fit a whole two-line label (2 × LINE_HEIGHT).
 */
const LINE_HEIGHT = 18;
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
  const band = withMinBand(links);

  const categoryName = options.categoryName ?? ((name: string) => name);
  const nameOf = (node: SpendFlowNode, name: string): string =>
    node.kind === 'category' || node.kind === 'subcategory' ? categoryName(name) : name;
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
      return nameOf(node, node.name);
    }
    if (node.kind === 'category') {
      return labels.uncategorised;
    }
    return node.kind === 'subcategory' ? labels.noSubcategory : labels.unknownMerchant;
  };
  const percent = (share: number): string => `${Math.round(share * 100)}%`;

  // The earthy tones of every other chart, held by name (so Travel here is the
  // Travel of the donut). Second-column nodes pick; the third column inherits
  // its parent's, so every band reads as one hue from left to right.
  const theme = isDark ? 'dark' : 'light';
  const parentOf = new Map(links.map(link => [link.target, link.source]));
  const secondColumn = nodes.filter(
    node => parentOf.get(node.id) === 'total' && node.kind !== 'other' && !isOtherCategories(node),
  );
  const tones = categoryTonesHex(
    // Keyed by the stored name, so a category keeps its tone in every language.
    secondColumn.map(node => ({ key: node.name || labelOf(node) })),
    theme,
  );
  const columnColor = new Map(secondColumn.map((node, index) => [node.id, tones[index]]));
  const nodeColor = (node: SpendFlowNode): string => {
    if (node.kind === 'total') {
      // The total is where everything starts: sage for income, stone for spending.
      return options.isIncome ? CATEGORY_TONE_HEX[theme][0] : OTHER_TONE_HEX[theme];
    }
    // A rollup straight under the total is stone; "other merchants" of a category keep its hue.
    if (
      isOtherCategories(node) ||
      node.id === 'cat:__none__' ||
      (node.kind === 'other' && parentOf.get(node.id) === 'total')
    ) {
      return OTHER_TONE_HEX[theme];
    }
    return (
      columnColor.get(node.id) ??
      columnColor.get(parentOf.get(node.id) ?? '') ??
      OTHER_TONE_HEX[theme]
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
        data?: { source?: string; target?: string };
      }) => {
        if (params.dataType === 'edge') {
          const source = byId.get(params.data?.source ?? '');
          const target = byId.get(params.data?.target ?? '');
          const route = source && target ? `${labelOf(source)} → ${labelOf(target)}<br/>` : '';
          return `${route}${formatAmount(band.linkValue(params.data?.source ?? '', params.data?.target ?? ''))}`;
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
        nodeWidth: 6,
        nodeGap: NODE_GAP,
        draggable: false,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'gradient', opacity: isDark ? 0.22 : 0.26, curveness: 0.5 },
        itemStyle: { borderWidth: 0, borderRadius: 2 },
        label: {
          position: 'left',
          color: color.textPrimary,
          fontSize: 13,
          lineHeight: LINE_HEIGHT,
          width: 200,
          overflow: 'truncate',
          formatter: (params: { name?: string }) => {
            const node = byId.get(String(params.name ?? ''));
            if (!node) {
              return '';
            }
            if (options.privacy) {
              return `{n|${labelOf(node)}}`;
            }
            // The name in ink, the amount and share under it in grey: 13px, no bold.
            return `{n|${labelOf(node)}}\n{v|${formatAmount(node.amount)} · ${percent(node.share)}}`;
          },
          rich: {
            n: { fontSize: 13, lineHeight: LINE_HEIGHT, color: color.textPrimary },
            v: { fontSize: 13, lineHeight: LINE_HEIGHT, color: color.textSecondary },
          },
        },
        // Only what the renderer needs: ECharts reads stray `id`/`color: null`
        // keys on a data item and silently draws nothing (see goal-flow.chart).
        data: nodes.map(node => ({
          name: node.id,
          itemStyle: { color: nodeColor(node) },
          ...(node.kind === 'total' ? { label: { position: 'right' } } : {}),
        })),
        links: band.links,
      },
    ],
  };
}

const NONE = '__none__';

/**
 * What a sankey node stands for, from its id: `cat:<root>`, `sub:<root>:<sub>`,
 * `m:<root>:<merchant>` (categories → merchants) or `m:<merchant>` (merchants
 * alone). Merchant keys may hold colons, so only the root is split off.
 * The total, "Other" and "no merchant" alone lead nowhere.
 */
export function spendFlowTarget(id: string, groupBy: SpendFlowGroupBy): RowsTarget | null {
  const [prefix, ...parts] = id.split(':');
  const rest = parts.join(':');
  if (prefix === 'cat') {
    return rest === '__other__' ? null : { categoryId: rest };
  }
  if (prefix === 'sub') {
    const [root, sub] = parts;
    // Spending booked on the root itself is its NONE child.
    return { categoryId: sub === NONE ? root : sub };
  }
  if (prefix === 'm') {
    if (groupBy === 'merchant') {
      return rest === NONE ? null : { merchant: rest };
    }
    const [root, ...merchant] = parts;
    const key = merchant.join(':');
    return key === NONE ? { categoryId: root } : { categoryId: root, merchant: key };
  }
  return null;
}
