import { describe, expect, it } from 'vitest';
import { withMinBand } from './sankey-min-band';

// The shape of the cash-flow map: two incomes into the hub, mostly left over, two small charges.
const links = [
  { source: 'source:a', target: 'total', value: 1000 },
  { source: 'source:b', target: 'total', value: 900 },
  { source: 'total', target: 'saved', value: 1890 },
  { source: 'total', target: 'cat:fees', value: 8 },
  { source: 'total', target: 'cat:apps', value: 2 },
];
const largest = 1900;

const drawnValue = (drawn: { source: string; target: string; value: number }[], target: string) =>
  drawn.find(link => link.target === target)?.value ?? 0;

describe('withMinBand', () => {
  it('draws a small band at least 3% of the largest node', () => {
    const { links: drawn } = withMinBand(links);

    expect(drawnValue(drawn, 'cat:fees')).toBeCloseTo(0.03 * largest);
    expect(drawnValue(drawn, 'cat:apps')).toBeCloseTo(0.03 * largest);
    expect(drawnValue(drawn, 'saved')).toBe(1890);
  });

  it('widens the bands into a node so both of its sides still match', () => {
    const { links: drawn } = withMinBand(links);
    const sum = (side: 'source' | 'target') =>
      drawn.filter(link => link[side] === 'total').reduce((total, link) => total + link.value, 0);

    expect(sum('target')).toBeCloseTo(sum('source'));
  });

  it('keeps the real figures for labels and tooltips', () => {
    const band = withMinBand(links);

    expect(band.linkValue('total', 'cat:apps')).toBe(2);
    expect(band.nodeValue('total')).toBe(largest);
    expect(band.nodeValue('cat:fees')).toBe(8);
  });

  it('leaves bands that are already wide enough alone', () => {
    const even = [
      { source: 'total', target: 'cat:a', value: 50 },
      { source: 'total', target: 'cat:b', value: 50 },
    ];

    expect(withMinBand(even).links).toEqual(even);
  });
});
