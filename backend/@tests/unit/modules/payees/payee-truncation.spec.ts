import { sameTruncatedName } from '@/modules/payees/payee-truncation';

describe('sameTruncatedName', () => {
  it.each([
    ['member one kum', 'member one kumar das'],
    ['memberonekum', 'member one kum'],
    ['memberonekumarda s', 'member one kumar das'],
    ['example tech', 'example technologies lim'],
  ])('takes "%s" and "%s" for one name cut short or respaced', (a, b) => {
    expect(sameTruncatedName(a, b)).toBe(true);
    expect(sameTruncatedName(b, a)).toBe(true);
  });

  it.each([
    ['ravi', 'ravi kumar'], // too short to be a cut-off rather than a first name
    ['acme shop', 'acme shoes'],
    ['member one', 'member two'],
  ])('keeps "%s" and "%s" apart', (a, b) => {
    expect(sameTruncatedName(a, b)).toBe(false);
  });
});
