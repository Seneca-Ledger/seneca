import { nulFreeTransformer, withoutNulChars } from '../../../../src/common/utils/nul-chars.util';

describe('withoutNulChars', () => {
  const NUL = '\u0000';

  it('cleans strings, keys and nested values', () => {
    const details = {
      logs: [{ level: 'info', message: `Extracted title: "Invoice${NUL} ACME"` }],
      [`key${NUL}`]: { title: `A${NUL}B`, count: 2, ok: true, missing: null },
    };

    expect(withoutNulChars(details)).toEqual({
      logs: [{ level: 'info', message: 'Extracted title: "Invoice ACME"' }],
      key: { title: 'AB', count: 2, ok: true, missing: null },
    });
  });

  it('leaves dates and text without NULs as they are', () => {
    const date = new Date('2026-10-23T00:00:00Z');

    expect(withoutNulChars(date)).toBe(date);
    expect(withoutNulChars('plain')).toBe('plain');
  });

  it('cleans on the way to the database only', () => {
    expect(nulFreeTransformer.to(`x${NUL}`)).toBe('x');
    expect(nulFreeTransformer.from(`x${NUL}`)).toBe(`x${NUL}`);
  });
});
