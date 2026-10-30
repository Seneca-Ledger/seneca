import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brandMatcher } from '@/modules/classification/suggestions/brand-index';
import { suggestKey } from '@/modules/classification/suggestions/category-suggester';
import type { KindContext } from '@/modules/classification/suggestions/operation-kind';

/**
 * Precision gate for suggestions. A suggestion is accepted for a whole
 * statement with one click, so a wrong one lands in a budget: every suggested
 * category has to be right at least 95 times in 100 on invented descriptors
 * shaped like the real ones, traps included. Coverage is reported, not gated:
 * abstaining is always allowed.
 */
type Case = {
  counterpartyName: string;
  paymentPurpose: string;
  counterpartyAccount?: string;
  currency?: string;
  type: 'income' | 'expense';
  expectKey: string | null;
  note: string;
  ctx?: Partial<KindContext>;
};

const MIN_PRECISION = 0.95;
const MIN_CASES = 40;

const read = (file: string): Case[] =>
  readFileSync(join(__dirname, 'fixtures', file), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as Case);
const kindCases = read('kind.jsonl');
const brandCases = read('brand.jsonl');
const cases = [...kindCases, ...brandCases];

const results = cases.map(item => {
  const ctx: KindContext = {
    ownAccountTails: item.ctx?.ownAccountTails ?? [],
    memberNames: item.ctx?.memberNames ?? [],
  };
  return { item, got: suggestKey(item, item.type, ctx, brandMatcher())?.key ?? null };
});

describe('suggestion precision on invented descriptors', () => {
  it.each([
    ['kinds', kindCases],
    ['brands', brandCases],
  ])('has enough positives and traps to measure %s', (_label, set) => {
    expect(set.filter(item => item.expectKey).length).toBeGreaterThanOrEqual(MIN_CASES);
    expect(set.filter(item => !item.expectKey).length).toBeGreaterThanOrEqual(MIN_CASES);
  });

  const keys = [...new Set(results.map(result => result.got).filter(Boolean))] as string[];

  it.each(keys)('suggests %s right at least 95% of the time', key => {
    const suggested = results.filter(result => result.got === key);
    const wrong = suggested.filter(result => result.item.expectKey !== key);
    const expected = cases.filter(item => item.expectKey === key).length;
    const precision = 1 - wrong.length / suggested.length;
    const coverage = expected ? (suggested.length - wrong.length) / expected : 1;
    // Printed so a failing run says which descriptors went wrong.
    console.info(
      `${key}: precision ${(precision * 100).toFixed(1)}%, coverage ${(coverage * 100).toFixed(1)}%` +
        (wrong.length ? `; wrong: ${wrong.map(result => result.item.note).join(', ')}` : ''),
    );
    expect(precision).toBeGreaterThanOrEqual(MIN_PRECISION);
  });
});
