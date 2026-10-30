import { describe, expect, it } from 'vitest';
import { monthRange, withoutSubcategories } from '../cash-flow-flow';

describe('monthRange', () => {
  it('spans the whole month, leap February included', () => {
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('withoutSubcategories', () => {
  it('keeps sources, total and categories with the value flowing into them', () => {
    const sankey = {
      nodes: [
        { id: 'src:ACME', name: 'ACME Payroll', kind: 'source' as const },
        { id: 'total', name: 'Total', kind: 'total' as const },
        { id: 'cat:food', name: 'Food', kind: 'category' as const },
        { id: 'sub:grocery', name: 'Groceries', kind: 'subcategory' as const },
      ],
      links: [
        { source: 'src:ACME', target: 'total', value: 1000 },
        { source: 'total', target: 'cat:food', value: 300 },
        { source: 'cat:food', target: 'sub:grocery', value: 300 },
      ],
    };

    const shallow = withoutSubcategories(sankey);

    expect(shallow.nodes.map(node => node.id)).toEqual(['src:ACME', 'total', 'cat:food']);
    expect(shallow.links).toEqual(sankey.links.slice(0, 2));
  });
});
