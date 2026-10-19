import { categoryColorFor } from '@/app/lib/category-defaults';
import type { GoalFlowNode, GoalFlowResponse } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';

/** Either theme's palette: the two bags share keys but not literal types. */
type ThemeColor = typeof tokens.color | typeof tokens.dark.color;

export interface GoalFlowChartLabels {
  /** Label for the rolled-up merchant tail; `{{count}}` is substituted. */
  otherMerchants: string;
  planned: string;
  actual: string;
  overspent: string;
  underspent: string;
}

/**
 * Builds the sankey option for the goal flow.
 *
 * Kept free of React so the mapping — which node gets which colour, how a
 * budget over its limit is marked, what the tooltip says — can be asserted
 * directly, the way the statements charts do it.
 */
export function buildGoalFlowSankey(
  data: GoalFlowResponse,
  resolvedTheme: string | undefined,
  labels: GoalFlowChartLabels,
  formatAmount: (value: number) => string,
  /** A stored category name as the reader should see it. */
  categoryName: (name: string) => string = name => name,
): Record<string, unknown> {
  const isDark = resolvedTheme === 'dark';
  const color = isDark ? tokens.dark.color : tokens.color;

  const label = (node: GoalFlowNode): string => {
    if (node.kind === 'other') {
      return labels.otherMerchants.replace('{{count}}', String(node.mergedCount ?? 0));
    }
    return node.kind === 'category' ? categoryName(node.name) : node.name;
  };

  const byId = new Map(data.nodes.map(node => [node.id, node]));

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      formatter: (params: { dataType?: string; name?: string; value?: unknown }) => {
        if (params.dataType === 'edge') {
          return formatAmount(Number(params.value ?? 0));
        }
        const node = byId.get(String(params.name ?? ''));
        if (!node) {
          return '';
        }
        const actual = `${labels.actual}: ${formatAmount(node.actual)}`;
        if (node.planned === null) {
          return `${label(node)}<br/>${actual}`;
        }
        const delta = node.actual - node.planned;
        const verdict = delta > 0 ? labels.overspent : labels.underspent;
        return [
          label(node),
          `${labels.planned}: ${formatAmount(node.planned)}`,
          actual,
          `${verdict}: ${formatAmount(Math.abs(delta))}`,
        ].join('<br/>');
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
        nodeGap: 10,
        nodeWidth: 14,
        draggable: false,
        label: {
          color: color.textPrimary,
          fontSize: 11,
          formatter: (params: { name?: string }) => {
            const node = byId.get(String(params.name ?? ''));
            return node ? label(node) : '';
          },
        },
        lineStyle: {
          color: 'gradient',
          opacity: isDark ? 0.35 : 0.28,
          curveness: 0.5,
        },
        // Only what the renderer needs. Spreading the whole node leaked `color:
        // null` and `id` into the data item, and ECharts reads those: the series
        // silently rendered nothing. Everything else is looked up via `byId` in
        // the formatters, keyed by the node id that doubles as the ECharts name.
        data: data.nodes.map(node => ({
          name: node.id,
          itemStyle: { color: nodeColor(node, color) },
        })),
        links: data.links,
      },
    ],
  };
}

function nodeColor(node: GoalFlowNode, color: ThemeColor): string {
  switch (node.kind) {
    case 'goal':
      return color.primary;
    case 'budget':
      // The one place the chart states a verdict rather than a quantity: a
      // budget past its declared limit reads as danger at a glance.
      return node.planned !== null && node.actual > node.planned ? color.danger : color.success;
    case 'other':
      return color.catOther;
    default:
      return categoryColorFor(node.name, node.color);
  }
}
