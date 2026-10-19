import { describe, expect, it } from 'vitest';
import { categoryTones, OTHER_TONE } from './chart-theme';

describe('categoryTones', () => {
  it('keeps a category on its tone whatever its rank', () => {
    const first = categoryTones([{ key: 'Travel' }, { key: 'Food' }, { key: 'Rent' }]);
    const second = categoryTones([{ key: 'Rent' }, { key: 'Travel' }, { key: 'Food' }]);
    expect(second).toEqual([first[2], first[0], first[1]]);
  });

  it('gives five categories on one chart five different tones', () => {
    const tones = categoryTones(['A', 'B', 'C', 'D', 'E'].map(key => ({ key })));
    expect(new Set(tones).size).toBe(5);
  });

  it('paints the rollup stone grey', () => {
    expect(categoryTones([{ key: 'Food' }, { key: 'Other', isOther: true }])[1]).toBe(OTHER_TONE);
  });
});
