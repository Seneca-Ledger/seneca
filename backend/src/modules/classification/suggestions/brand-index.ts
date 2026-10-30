import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { SystemCategoryKey } from '../../categories/system-categories';
import { countriesForCurrency, locationCovers } from './brand-countries';
import { brandWords } from './brand-text';
import { ONLINE_SERVICES } from './online-services';

/**
 * The brand index as scripts/build-brand-index.ts writes it: one row per
 * brand facet `[categoryKey, include, exclude, wikidataId, facetRank]`
 * (location codes joined by commas) and, for every spelling of a name, the
 * rows it may mean: `id` when it is that brand's own name, `-(id + 1)` when
 * it is a tag or an alias.
 */
export type BrandIndexData = {
  version: string;
  items: ReadonlyArray<readonly [string, string, string, string, number]>;
  phrases: Record<string, readonly number[]>;
};

type Brand = {
  key: SystemCategoryKey;
  include: readonly string[];
  exclude: readonly string[];
  qid: string;
  rank: number;
};

type Candidate = Brand & { own: boolean };

export type BrandMatch = { key: SystemCategoryKey; qid: string };

/** Longest brand name, in words, that is looked for. */
const MAX_WORDS = 4;

/**
 * Bank wording that may stand before a merchant's name ("POS PURCHASE
 * MCDONALDS", "PREPAID DEBIT VODACOM"). A brand is looked for only where the
 * name starts, right after these: a brand word deep inside a descriptor
 * ("ANZ MOBILE BANKING PAYMENT TO …") is a coincidence far more often than not.
 */
const LEADING_NOISE = new Set(
  [
    'pos purchase prepaid debit credit card visa mastercard maestro contactless payment',
    'upi p2m ecom ecommerce online sepa lastschrift kartenzahlung ec cb paiement achat',
    'compra pago оплата покупка',
  ]
    .join(' ')
    .split(' '),
);

/**
 * Finds a known brand in a descriptor: whole words only, the longest name
 * first, only where the brand trades, and nothing when the candidates disagree
 * on the category. "I don't know" is a fine answer: a wrong brand costs more
 * than a missing one.
 */
export class BrandMatcher {
  private readonly brands: Brand[] = [];
  private readonly byPhrase = new Map<string, number[]>();

  constructor(data: BrandIndexData) {
    for (const [key, include, exclude, qid, rank] of data.items) {
      this.brands.push({
        key: key as SystemCategoryKey,
        include: include ? include.split(',') : ['001'],
        exclude: exclude ? exclude.split(',') : [],
        qid,
        rank,
      });
    }
    for (const [phrase, ids] of Object.entries(data.phrases)) {
      this.byPhrase.set(phrase, [...ids]);
    }
    for (const service of ONLINE_SERVICES) {
      const id = this.brands.length;
      this.brands.push({
        key: service.key,
        include: service.countries ?? ['001'],
        exclude: [],
        qid: '',
        rank: 0,
      });
      for (const name of service.names) {
        const phrase = brandWords(name).join(' ');
        this.byPhrase.set(phrase, [...(this.byPhrase.get(phrase) ?? []), id]);
      }
    }
  }

  match(row: {
    counterpartyName?: string | null;
    paymentPurpose?: string | null;
    currency?: string | null;
  }): BrandMatch | null {
    const countries = countriesForCurrency(row.currency);
    for (const field of [row.counterpartyName, row.paymentPurpose]) {
      const text = field ?? '';
      // "PAYPAL *SPOTIFY": the merchant follows an acquirer's star, so that
      // part is read first, then the whole descriptor.
      const parts = text.includes('*') ? [text.slice(text.lastIndexOf('*') + 1), text] : [text];
      for (const part of parts) {
        const found = this.longest(brandWords(part, { dropReferences: true }), countries);
        if (found !== undefined) {
          return found;
        }
      }
    }
    return null;
  }

  /**
   * The brand named by the longest phrase at the start of the name; null when
   * it is ambiguous, undefined when there is none.
   */
  private longest(all: string[], countries: readonly string[]): BrandMatch | null | undefined {
    let start = 0;
    while (start < all.length && LEADING_NOISE.has(all[start] ?? '')) {
      start += 1;
    }
    const words = all.slice(start);
    for (let size = Math.min(MAX_WORDS, words.length); size >= 1; size -= 1) {
      const candidates: Candidate[] = [];
      for (const ref of this.byPhrase.get(words.slice(0, size).join(' ')) ?? []) {
        const brand = this.brands[ref < 0 ? -ref - 1 : ref];
        if (brand) {
          candidates.push({ ...brand, own: ref >= 0 });
        }
      }
      // Trades in at least one of the statement's countries (a euro statement
      // has twenty) and is not excluded from that same one.
      const tradesIn = (brand: Brand, country: string): boolean =>
        brand.include.some(code => locationCovers(code, [country])) &&
        !brand.exclude.some(code => locationCovers(code, [country]));
      const trading = candidates.filter(brand =>
        countries.length > 0
          ? countries.some(country => tradesIn(brand, country))
          : brand.include.includes('001'),
      );
      if (trading.length === 0) {
        continue;
      }
      return pick(trading);
    }
    return undefined;
  }
}

/**
 * One answer from the brands a name may mean. Each brand answers with the
 * facet people pay at (FACET_RANK); if the brands still disagree, one whose
 * own name this is beats ones that only carry it as a tag or alias; if that
 * does not settle it, there is no answer.
 */
function pick(candidates: Candidate[]): BrandMatch | null {
  const byBrand = new Map<string, Candidate>();
  candidates.forEach((candidate, index) => {
    const brand = candidate.qid || `#${index}`;
    const best = byBrand.get(brand);
    if (!best || candidate.rank < best.rank || (candidate.own && !best.own)) {
      byBrand.set(brand, best?.own && !candidate.own ? best : candidate);
    }
  });
  const answers = [...byBrand.values()];
  const own = answers.filter(answer => answer.own);
  for (const set of [answers, own]) {
    const keys = new Set(set.map(answer => answer.key));
    const first = set[0];
    if (keys.size === 1 && first) {
      return { key: first.key, qid: first.qid };
    }
  }
  return null;
}

let shared: BrandMatcher | null = null;

/**
 * The matcher over the bundled NSI index, read on first use (about 2 MB
 * compressed) and kept for the life of the process.
 */
export function brandMatcher(): BrandMatcher {
  if (!shared) {
    const file = join(__dirname, '../../../config-assets/brands/nsi-brands.json.gz');
    shared = new BrandMatcher(JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')));
  }
  return shared;
}
