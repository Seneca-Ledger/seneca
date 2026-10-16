import { describe, expect, it } from 'vitest';
import { CATEGORY_TONE_HEX, OTHER_TONE_HEX } from '@/app/components/charts/chart-theme';
import type { SpendFlowData } from './useSpendFlow';
import {
  buildSpendFlowSankey,
  findSpendFlowNodeId,
  spendFlowChartHeight,
  visibleSpendFlow,
} from './spend-flow.chart';

const labels = {
  total: 'Total spend',
  uncategorised: 'Uncategorised',
  unknownMerchant: 'Unnamed',
  otherMerchants: 'Other ({{count}})',
  otherCategories: 'Other categories ({{count}})',
  noSubcategory: 'No subcategory',
};
const format = (value: number): string => `${value.toFixed(2)} €`;

const data: SpendFlowData = {
  total: 100,
  currency: 'EUR',
  type: 'expense',
  dateFrom: null,
  nodes: [
    { id: 'total', kind: 'total', name: null, amount: 100, share: 1, color: null },
    { id: 'cat:food', kind: 'category', name: 'Food', amount: 60, share: 0.6, color: '#ff0000' },
    { id: 'm:food:rewe', kind: 'merchant', name: 'Rewe', amount: 40, share: 0.4, color: '#ff0000' },
    { id: 'other:food', kind: 'other', name: null, amount: 20, share: 0.2, color: '#ff0000', mergedCount: 3 },
    { id: 'cat:__none__', kind: 'category', name: null, amount: 30, share: 0.3, color: null },
    { id: 'm:__none__:__none__', kind: 'merchant', name: null, amount: 30, share: 0.3, color: null },
    { id: 'cat:__other__', kind: 'other', name: null, amount: 10, share: 0.1, color: null, mergedCount: 4 },
  ],
  links: [
    { source: 'total', target: 'cat:food', value: 60 },
    { source: 'cat:food', target: 'm:food:rewe', value: 40 },
    { source: 'cat:food', target: 'other:food', value: 20 },
    { source: 'total', target: 'cat:__none__', value: 30 },
    { source: 'cat:__none__', target: 'm:__none__:__none__', value: 30 },
    { source: 'total', target: 'cat:__other__', value: 10 },
  ],
};

type Series = {
  data: Array<{ name: string; itemStyle: { color: string }; label?: { position: string } }>;
  links: unknown[];
  lineStyle: { color: string };
  label: { formatter: (p: { name: string }) => string };
};
const seriesOf = (option: Record<string, unknown>): Series => (option.series as Series[])[0];

describe('buildSpendFlowSankey', () => {
  it('draws gradient links and labels each node with amount and share', () => {
    const series = seriesOf(buildSpendFlowSankey(data, 'light', labels, format, { compact: false, isIncome: false }));

    expect(series.lineStyle.color).toBe('gradient');
    expect(series.label.formatter({ name: 'cat:food' })).toBe('{n|Food}\n{v|60.00 € · 60%}');
    expect(series.label.formatter({ name: 'total' })).toBe('{n|Total spend}\n{v|100.00 € · 100%}');
  });

  it('localizes the nodes the server leaves unnamed', () => {
    const series = seriesOf(buildSpendFlowSankey(data, 'light', labels, format, { compact: false, isIncome: false }));
    const label = (name: string): string => series.label.formatter({ name }).split('\n')[0];

    expect(label('other:food')).toBe('{n|Other (3)}');
    expect(label('cat:__other__')).toBe('{n|Other categories (4)}');
    expect(label('cat:__none__')).toBe('{n|Uncategorised}');
    expect(label('m:__none__:__none__')).toBe('{n|Unnamed}');
  });

  it('paints categories in the earthy tones, not their stored colour, and merchants in the hue of their category', () => {
    const series = seriesOf(buildSpendFlowSankey(data, 'light', labels, format, { compact: false, isIncome: false }));
    const colorOf = (name: string): string | undefined => series.data.find(item => item.name === name)?.itemStyle.color;

    expect(CATEGORY_TONE_HEX.light).toContain(colorOf('cat:food'));
    expect(colorOf('cat:food')).not.toBe('#ff0000');
    expect(colorOf('m:food:rewe')).toBe(colorOf('cat:food'));
    expect(colorOf('other:food')).toBe(colorOf('cat:food'));
    expect(colorOf('cat:__other__')).toBe(OTHER_TONE_HEX.light);
    expect(series.data.find(item => item.name === 'total')?.label).toEqual({ position: 'right' });
    // Data items carry only what ECharts needs; a stray `id` blanks the series.
    expect(Object.keys(series.data[1]).sort()).toEqual(['itemStyle', 'name']);
  });

  it('drops the merchant column in compact mode', () => {
    const series = seriesOf(buildSpendFlowSankey(data, 'light', labels, format, { compact: true, isIncome: false }));

    expect(series.data.map(item => item.name)).toEqual(['total', 'cat:food', 'cat:__none__', 'cat:__other__']);
    expect(series.links).toHaveLength(3);
  });
});

describe('spendFlowChartHeight', () => {
  it('grows with the busiest column and never drops below the minimum', () => {
    expect(spendFlowChartHeight(data, false)).toBe(2 * 38 + 360 + 24);
    expect(spendFlowChartHeight({ nodes: [], links: [] }, false)).toBe(420);
    const many = {
      nodes: data.nodes,
      links: Array.from({ length: 20 }, (_, i) => ({ source: 'cat:food', target: `m:${i}`, value: 1 })),
    };
    expect(spendFlowChartHeight(many, false)).toBe(19 * 38 + 360 + 24);
    expect(visibleSpendFlow(many, true).links).toHaveLength(0);
  });
});

describe('findSpendFlowNodeId', () => {
  it('matches a second-column band by label, ignoring case and padding', () => {
    expect(findSpendFlowNodeId(data, '  food ')).toBe('cat:food');
    expect(findSpendFlowNodeId(data, 'FOOD')).toBe('cat:food');
  });

  it('is null for a name this month does not show', () => {
    expect(findSpendFlowNodeId(data, 'Travel')).toBeNull();
    expect(findSpendFlowNodeId(data, null)).toBeNull();
    // Third-column nodes are not what a deep link names.
    expect(findSpendFlowNodeId(data, 'Rewe')).toBeNull();
  });
});
