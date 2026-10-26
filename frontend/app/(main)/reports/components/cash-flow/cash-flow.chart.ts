import {
  CATEGORY_TONE_HEX,
  categoryTonesHex,
  OTHER_TONE_HEX,
} from '@/app/components/charts/chart-theme';
import { withMinBand } from '@/app/components/charts/sankey-min-band';
import { tokens } from '@/lib/theme-tokens';
import type { CashFlowMapData } from './useCashFlowMap';

/**
 * A node's label is two lines (name, amount) centred on it. ECharts keeps
 * neighbours apart by `nodeGap` alone, so the gap holds a whole label and two
 * small nodes' labels never run into each other.
 */
const LINE_HEIGHT = 17;
const NODE_GAP = 2 * LINE_HEIGHT + 2;
/** Height shared out by value, on top of the gaps. */
const VALUE_SPACE = 320;
const VERTICAL_PADDING = 24;
export const CASH_FLOW_MIN_HEIGHT = 440;

/** A label-sized gap per node of the busiest column, plus room for the values. */
export function cashFlowChartHeight(data: Pick<CashFlowMapData, 'sankey'>): number {
  // A node's column is one past the deepest node that feeds it.
  const depth = new Map<string, number>();
  for (let pass = 0; pass < data.sankey.nodes.length; pass++) {
    for (const link of data.sankey.links) {
      depth.set(
        link.target,
        Math.max(depth.get(link.target) ?? 0, (depth.get(link.source) ?? 0) + 1),
      );
    }
  }
  const perColumn = new Map<number, number>();
  for (const node of data.sankey.nodes) {
    const column = depth.get(node.id) ?? 0;
    perColumn.set(column, (perColumn.get(column) ?? 0) + 1);
  }
  const busiest = Math.max(0, ...perColumn.values());
  const gaps = Math.max(0, busiest - 1) * NODE_GAP;
  return Math.max(CASH_FLOW_MIN_HEIGHT, gaps + VALUE_SPACE + VERTICAL_PADDING);
}

/** ECharts sankey option for the cash-flow map; free of React so it can be asserted. */
export function buildCashFlowSankey(
  data: Pick<CashFlowMapData, 'sankey'>,
  resolvedTheme: string | undefined,
  formatAmount: (value: number) => string,
  compact = false,
  categoryName: (name: string) => string = name => name,
  // Privacy mode: the canvas is out of reach of the CSS redaction, so the labels
  // drop the amount and keep the name. The tooltip, shown on hover, keeps it.
  privacy = false,
): Record<string, unknown> {
  const isDark = resolvedTheme === 'dark';
  const color = isDark ? tokens.dark.color : tokens.color;
  const byId = new Map(data.sankey.nodes.map(node => [node.id, node]));
  const band = withMinBand(data.sankey.links);
  // Category nodes carry the stored name; income sources and the hub are already words.
  const labelOf = (node: CashFlowMapData['sankey']['nodes'][number]): string =>
    node.kind === 'category' || node.kind === 'subcategory' ? categoryName(node.name) : node.name;
  // Labels sit right of their node by default; the last column has no room there.
  const hasOutflow = new Set(data.sankey.links.map(link => link.source));
  const hasInflow = new Set(data.sankey.links.map(link => link.target));
  // The earthy tones of every other chart: income sage, money from the balance
  // sand, the middle column stone, categories by name so Travel matches the donut.
  const theme = isDark ? 'dark' : 'light';
  const categoryNodes = data.sankey.nodes.filter(
    node => !['source', 'saved', 'balance', 'total', 'transfers'].includes(node.kind),
  );
  const categoryTone = new Map(
    categoryNodes.map((node, index) => [
      node.id,
      categoryTonesHex(
        categoryNodes.map(entry => ({ key: entry.name })),
        theme,
      )[index],
    ]),
  );
  const nodeColor = (id: string, kind: string): string => {
    switch (kind) {
      case 'source':
      case 'saved':
        return CATEGORY_TONE_HEX[theme][0];
      case 'balance':
        return CATEGORY_TONE_HEX[theme][2];
      case 'total':
      case 'transfers':
        return OTHER_TONE_HEX[theme];
      default:
        // No category is not a category: stone, like "Other", never a tone that reads as a signal.
        if (id === 'cat:__none__' || id.startsWith('sub:__none__')) return OTHER_TONE_HEX[theme];
        return categoryTone.get(id) ?? OTHER_TONE_HEX[theme];
    }
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
          return formatAmount(band.linkValue(params.data?.source ?? '', params.data?.target ?? ''));
        }
        const node = byId.get(String(params.name ?? ''));
        return node ? labelOf(node) : '';
      },
    },
    series: [
      {
        type: 'sankey',
        left: 8,
        right: 8,
        top: 12,
        bottom: 12,
        emphasis: { focus: 'adjacency' },
        nodeGap: NODE_GAP,
        nodeWidth: 6,
        draggable: false,
        // Name and amount, readable: 13px, the amount in grey under the name.
        // On one line the middle column's labels ran into the last column's on a phone.
        label: {
          color: color.textPrimary,
          fontSize: 13,
          lineHeight: LINE_HEIGHT,
          // On a phone the middle column's labels and the last column's share one
          // narrow gap; there only the outer columns are labelled (the middle on tap).
          ...(compact ? { width: 130, overflow: 'truncate' } : {}),
          formatter: (params: { name?: string }) => {
            const node = byId.get(String(params.name ?? ''));
            if (!node) return '';
            if (privacy) return `{name|${labelOf(node)}}`;
            return `{name|${labelOf(node)}}\n{value|${formatAmount(band.nodeValue(node.id))}}`;
          },
          rich: {
            name: { color: color.textPrimary, fontSize: 13 },
            value: { color: color.textSecondary, fontSize: 13 },
          },
        },
        // Branches keep their gradient, lighter, so the dark theme does not turn them muddy.
        lineStyle: { color: 'gradient', opacity: isDark ? 0.22 : 0.26, curveness: 0.5 },
        data: data.sankey.nodes.map(node => ({
          name: node.id,
          itemStyle: { color: nodeColor(node.id, node.kind) },
          ...(hasOutflow.has(node.id) ? {} : { label: { position: 'left' } }),
          ...(compact && hasOutflow.has(node.id) && hasInflow.has(node.id)
            ? { label: { show: false } }
            : {}),
        })),
        links: band.links,
      },
    ],
  };
}
