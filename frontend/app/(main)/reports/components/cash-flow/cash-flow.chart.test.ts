import { describe, expect, it } from 'vitest';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { buildCashFlowSankey, CASH_FLOW_MIN_HEIGHT, cashFlowChartHeight } from './cash-flow.chart';

const data = {
  sankey: {
    nodes: [
      { id: 'balance', name: 'From your balance', kind: 'balance' as const },
      { id: 'total', name: 'Money flow', kind: 'total' as const },
      { id: 'cat:rent', name: 'Marketing and advertising', kind: 'category' as const },
    ],
    links: [
      { source: 'balance', target: 'total', value: 300 },
      { source: 'total', target: 'cat:rent', value: 300 },
    ],
  },
};

type SankeyNode = { name: string; label?: { position?: string }; itemStyle: { color: string } };
type SankeySeries = {
  data: SankeyNode[];
  label: { formatter: (params: { name: string; value: number }) => string };
};
type Tooltip = { formatter: (params: { dataType?: string; name: string }) => string };

describe('buildCashFlowSankey', () => {
  it('puts the labels of the last column inside the chart so they are not cut off', () => {
    const option = buildCashFlowSankey(data, 'dark', value => String(value));
    const nodes = (option.series as Array<{ data: SankeyNode[] }>)[0].data;

    expect(nodes.find(node => node.name === 'cat:rent')?.label?.position).toBe('left');
    expect(nodes.find(node => node.name === 'balance')?.label?.position).toBeUndefined();
  });

  it('privacy hides amounts: labels keep the name, the tooltip keeps the figure', () => {
    const option = buildCashFlowSankey(data, 'light', value => `€${value}`, false, undefined, true);
    const series = (option.series as SankeySeries[])[0];
    const tooltip = option.tooltip as {
      formatter: (params: { dataType?: string; data?: { source: string; target: string } }) => string;
    };

    expect(series.label.formatter({ name: 'cat:rent', value: 300 })).toBe(
      '{name|Marketing and advertising}',
    );
    expect(tooltip.formatter({ dataType: 'edge', data: { source: 'total', target: 'cat:rent' } })).toBe(
      '€300',
    );
  });
});

describe('buildCashFlowSankey in the reader\'s language', () => {
  const ru = (name: string) => localizeStatementCategoryName(name, 'ru');
  const withAdvertising = {
    sankey: {
      nodes: [
        { id: 'source:acme', name: 'Advertising', kind: 'source' as const },
        { id: 'total', name: 'Money flow', kind: 'total' as const },
        { id: 'cat:ads', name: 'Advertising', kind: 'category' as const },
      ],
      links: [
        { source: 'source:acme', target: 'total', value: 300 },
        { source: 'total', target: 'cat:ads', value: 300 },
      ],
    },
  };

  it('labels category nodes in the reader\'s language, sources as they came', () => {
    const option = buildCashFlowSankey(withAdvertising, 'light', String, false, ru);
    const series = (option.series as SankeySeries[])[0];
    const tooltip = option.tooltip as Tooltip;

    expect(series.label.formatter({ name: 'cat:ads', value: 300 })).toBe('{name|Реклама}\n{value|300}');
    expect(tooltip.formatter({ name: 'cat:ads' })).toBe('Реклама');
    // An income source is a counterparty, never translated even when it spells a category.
    expect(tooltip.formatter({ name: 'source:acme' })).toBe('Advertising');
  });

  it('keeps the category tone of the stored name', () => {
    const colourOf = (option: Record<string, unknown>) =>
      (option.series as SankeySeries[])[0].data.find(node => node.name === 'cat:ads')?.itemStyle.color;

    expect(colourOf(buildCashFlowSankey(withAdvertising, 'light', String, false, ru))).toBe(
      colourOf(buildCashFlowSankey(withAdvertising, 'light', String)),
    );
  });
});

describe('cashFlowChartHeight', () => {
  const withCategories = (count: number) => ({
    sankey: {
      nodes: [
        { id: 'balance', name: 'From your balance', kind: 'balance' as const },
        { id: 'total', name: 'Money flow', kind: 'total' as const },
        ...Array.from({ length: count }, (_, i) => ({
          id: `cat:${i}`,
          name: `Category ${i}`,
          kind: 'category' as const,
        })),
      ],
      links: [
        { source: 'balance', target: 'total', value: 100 * count },
        ...Array.from({ length: count }, (_, i) => ({ source: 'total', target: `cat:${i}`, value: 100 })),
      ],
    },
  });

  it('keeps the usual height for a few nodes', () => {
    expect(cashFlowChartHeight(withCategories(3))).toBe(CASH_FLOW_MIN_HEIGHT);
  });

  it('grows with the busiest column so every two-line label has room', () => {
    const gap = (option: Record<string, unknown>) => (option.series as Array<{ nodeGap: number }>)[0].nodeGap;
    const many = withCategories(20);

    expect(gap(buildCashFlowSankey(many, 'light', String))).toBeGreaterThanOrEqual(2 * 17);
    expect(cashFlowChartHeight(many)).toBeGreaterThanOrEqual(19 * gap(buildCashFlowSankey(many, 'light', String)));
  });
});
