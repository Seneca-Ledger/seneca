import {
  CATEGORY_TONE_HEX,
  categoryTonesHex,
  OTHER_TONE_HEX,
} from '@/app/components/charts/chart-theme';
import { tokens } from '@/lib/theme-tokens';
import type { CashFlowMapData } from './useCashFlowMap';

/** ECharts sankey option for the cash-flow map; free of React so it can be asserted. */
export function buildCashFlowSankey(
  data: Pick<CashFlowMapData, 'sankey'>,
  resolvedTheme: string | undefined,
  formatAmount: (value: number) => string,
  compact = false,
  categoryName: (name: string) => string = name => name,
): Record<string, unknown> {
  const isDark = resolvedTheme === 'dark';
  const color = isDark ? tokens.dark.color : tokens.color;
  const byId = new Map(data.sankey.nodes.map(node => [node.id, node]));
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
      formatter: (params: { dataType?: string; name?: string; value?: unknown }) => {
        if (params.dataType === 'edge') return formatAmount(Number(params.value ?? 0));
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
        nodeGap: 12,
        nodeWidth: 6,
        draggable: false,
        // Name and amount, readable: 13px, the amount in grey under the name.
        // On one line the middle column's labels ran into the last column's on a phone.
        label: {
          color: color.textPrimary,
          fontSize: 13,
          lineHeight: 17,
          // On a phone the middle column's labels and the last column's share one
          // narrow gap; there only the outer columns are labelled (the middle on tap).
          ...(compact ? { width: 130, overflow: 'truncate' } : {}),
          formatter: (params: { name?: string; value?: unknown }) => {
            const node = byId.get(String(params.name ?? ''));
            return node
              ? `{name|${labelOf(node)}}\n{value|${formatAmount(Number(params.value ?? 0))}}`
              : '';
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
        links: data.sankey.links,
      },
    ],
  };
}
