import { describe, expect, it } from 'vitest';
import { decodeSnapshot, encodeSnapshot, type SkeletonSnapshot, widthBucket } from './snapshot';

const snapshot: SkeletonSnapshot = {
  h: 320,
  boxes: [
    { k: 'text', x: 0, y: 4, w: 2500, h: 20, r: 0 },
    { k: 'frame', x: 0, y: 40, w: 10_000, h: 120, r: 12 },
    { k: 'circle', x: 9000, y: 60, w: 400, h: 32, r: 16 },
    { k: 'block', x: 100, y: 200, w: 3000, h: 36, r: 8 },
  ],
};

describe('encodeSnapshot / decodeSnapshot', () => {
  it('round-trips a snapshot', () => {
    expect(decodeSnapshot(encodeSnapshot(snapshot))).toEqual(snapshot);
  });

  it('stores numbers and kinds only', () => {
    expect(encodeSnapshot(snapshot)).toMatch(/^[{}[\]",:0-9hb]+$/);
  });

  it.each([
    ['nothing', null],
    ['not JSON', '{oops'],
    ['no boxes', '{"h":10,"b":[]}'],
    ['a zero height', '{"h":0,"b":[[0,0,0,10,10,0]]}'],
    ['an unknown kind', '{"h":10,"b":[[9,0,0,10,10,0]]}'],
    ['a width over the container', '{"h":10,"b":[[0,0,0,10001,10,0]]}'],
    ['a fractional px value', '{"h":10,"b":[[0,0,0.5,10,10,0]]}'],
    ['a short tuple', '{"h":10,"b":[[0,0,0,10]]}'],
    ['a string where a number goes', '{"h":"10","b":[[0,0,0,10,10,0]]}'],
  ])('treats %s as no snapshot', (_case, text) => {
    expect(decodeSnapshot(text)).toBeNull();
  });
});

describe('widthBucket', () => {
  it.each([
    [360, 'xs'],
    [479, 'xs'],
    [480, 'sm'],
    [800, 'md'],
    [1200, 'lg'],
    [1920, 'xl'],
  ])('puts %i px into %s', (width, bucket) => {
    expect(widthBucket(width)).toBe(bucket);
  });
});
