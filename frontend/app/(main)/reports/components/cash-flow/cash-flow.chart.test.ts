import { describe, expect, it } from 'vitest';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { buildCashFlowSankey } from './cash-flow.chart';

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
