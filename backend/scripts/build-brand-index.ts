/**
 * Builds the brand index suggestions read (src/config-assets/brands/nsi-brands.json.gz)
 * from a pinned name-suggestion-index release (BSD-3-Clause, see THIRD_PARTY_NOTICES.md).
 *
 *   npx tsx scripts/build-brand-index.ts [path/to/nsi.min.json]
 *
 * Without a path it downloads `dist/json/nsi.min.json` of NSI_VERSION. Run it
 * by hand when updating NSI, then the precision gate
 * (@tests/unit/categorization): a new release can rename or move brands.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { brandWords } from '../src/modules/classification/suggestions/brand-text';
import {
  categoryForBrandPath,
  facetRank,
} from '../src/modules/classification/suggestions/osm-tag-categories';

const NSI_VERSION = '8.0.20260918';
const NSI_URL = `https://cdn.jsdelivr.net/npm/name-suggestion-index@${NSI_VERSION}/dist/json/nsi.min.json`;
const OUT = join(__dirname, '../src/config-assets/brands/nsi-brands.json.gz');
const MAX_WORDS = 4;

/**
 * One-word brand names that are also everyday words in a bank descriptor:
 * a match on them would file "ONLINE PAYMENT" under some shop.
 */
const COMMON_WORDS = new Set(
  [
    'the and for with from online payment transfer charges charge interest salary cash card',
    'bank service services pay shop store market mart food fresh express city central home',
    'plus max one star best first family super mini total day life care health centre center',
    'direct debit credit refund account loan fee fees bill bills order purchase pos atm upi',
    'neft imps rtgs sepa amazon google apple paypal mobile free house garage now new go',
    'smart green blue red global united national royal golden quick easy happy big little',
    'metro coffee roasters bakery kitchen grill bar pizza burger sushi taxi cab parking hotel',
    'travel club fitness gym energy power electric gas water oil auto car motors service',
    'local village town country world international group company corner square street',
  ]
    .join(' ')
    .split(' '),
);

type NsiItem = {
  displayName?: string;
  matchNames?: string[];
  locationSet?: { include?: unknown[]; exclude?: unknown[] };
  tags?: Record<string, string>;
};
type NsiCategory = {
  properties?: { exclude?: { generic?: string[]; named?: string[] } };
  items: NsiItem[];
};

async function loadNsi(path?: string): Promise<Record<string, NsiCategory>> {
  const text = path
    ? readFileSync(path, 'utf8')
    : await fetch(NSI_URL).then(response => {
        if (!response.ok) {
          throw new Error(`NSI download failed: ${response.status}`);
        }
        return response.text();
      });
  return (JSON.parse(text) as { nsi: Record<string, NsiCategory> }).nsi;
}

const codes = (list: unknown[] | undefined): string =>
  (list ?? []).filter((code): code is string => typeof code === 'string').join(',');

async function main(): Promise<void> {
  const nsi = await loadNsi(process.argv[2]);
  const items: Array<[string, string, string, string, number]> = [];
  const phrases: Record<string, number[]> = {};

  for (const [path, category] of Object.entries(nsi)) {
    const key = categoryForBrandPath(path);
    if (!key) {
      continue;
    }
    const generic = [
      ...(category.properties?.exclude?.generic ?? []),
      ...(category.properties?.exclude?.named ?? []),
    ].flatMap(source => {
      // NSI writes them for plain JavaScript regexes, and a few are sloppy there too.
      try {
        return [new RegExp(source, 'i')];
      } catch {
        return [];
      }
    });

    for (const item of category.items) {
      const tags = item.tags ?? {};
      const names = new Set(
        [
          item.displayName,
          tags.brand,
          tags.name,
          tags['brand:en'],
          tags['name:en'],
          ...(item.matchNames ?? []),
        ].filter((name): name is string => Boolean(name)),
      );
      // The brand's own name, as opposed to a tag or an alias that may be shared
      // ("Tesco" is the brand tag of Tesco Mobile too).
      const own = new Set(
        [item.displayName, tags.name]
          .filter(Boolean)
          .map(name => brandWords(String(name)).join(' ')),
      );
      const spellings = new Set<string>();
      for (const name of names) {
        const words = brandWords(name);
        const phrase = words.join(' ');
        if (words.length === 0 || words.length > MAX_WORDS) {
          continue;
        }
        // One short word is a brand only as an acronym NSI writes in capitals ("KFC", "OBI").
        const acronym = /^\p{Lu}{3}$/u.test(name.trim());
        if (words.length === 1 && ((phrase.length < 4 && !acronym) || COMMON_WORDS.has(phrase))) {
          continue;
        }
        if (generic.some(pattern => pattern.test(name) || pattern.test(phrase))) {
          continue;
        }
        spellings.add(phrase);
      }
      if (spellings.size === 0) {
        continue;
      }
      const id = items.length;
      items.push([
        key,
        codes(item.locationSet?.include),
        codes(item.locationSet?.exclude),
        tags['brand:wikidata'] ?? '',
        facetRank(path),
      ]);
      for (const phrase of spellings) {
        // An alias is stored as -(id + 1).
        phrases[phrase] ??= [];
        phrases[phrase].push(own.has(phrase) ? id : -(id + 1));
      }
    }
  }

  const json = JSON.stringify({ version: NSI_VERSION, items, phrases });
  writeFileSync(OUT, gzipSync(json, { level: 9 }));
  console.log(
    `${items.length} brands, ${Object.keys(phrases).length} spellings, ` +
      `${(json.length / 1e6).toFixed(1)} MB raw → ${OUT}`,
  );
}

void main();
