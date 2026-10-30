import { describe, expect, it } from 'vitest';
import { categoryTones, merchantTones, OTHER_TONE } from './chart-theme';

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

describe('merchantTones', () => {
  const merchants = Array.from({ length: 12 }, (_, index) => `ACME Store ${index + 1}`);
  const familyOf = (tone: string) => {
    const index = Number(/(\d+)\)$/.exec(tone)?.[1]) - 1;
    return [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 0][index];
  };

  it('gives the first merchant its own tone, the one its bars use alone', () => {
    const alone = merchantTones(['ACME Store 1'])[0];
    expect(merchantTones(['ACME Store 1', 'Example Bakery', 'Example Cafe'])[0]).toBe(alone);
  });

  it('keeps up to four lines in four different hue families', () => {
    for (let start = 0; start < 8; start++) {
      const four = merchantTones(merchants.slice(start, start + 4));
      expect(new Set(four.map(familyOf)).size).toBe(4);
    }
  });

  it('gives twelve merchants on one chart twelve different tones', () => {
    expect(new Set(merchantTones(merchants)).size).toBe(12);
  });

  it('repeats a tone past twelve instead of failing', () => {
    const tones = merchantTones([...merchants, 'Example Bakery']);
    expect(tones).toHaveLength(13);
    expect(tones.every(tone => /^var\(--merchant-tone-([1-9]|1[0-2])\)$/.test(tone))).toBe(true);
  });
});
