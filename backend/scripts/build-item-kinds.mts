/**
 * Builds the item-kind dictionary (src/config-assets/item-kinds/item-kinds.json.gz):
 * for each kind of thing people buy and sell, the words that name it in every
 * language the app speaks, plus Hebrew and Arabic, which notes are often in.
 *
 *   node scripts/build-item-kinds.mts      (Node 23+, or npx tsx; needs network; commit the output)
 *
 * Three sources, none typed by hand except the extras:
 * - Wikidata (CC0): the subclasses of each kind's root classes ("chair" →
 *   "armchair", "rocking chair"…) with their labels and aliases, and the
 *   instances of its model classes ("smartphone model" → "Galaxy S22").
 * - Unicode CLDR emoji annotations (Unicode License v3, THIRD_PARTY_NOTICES.md).
 * - scripts/item-kinds.extras.json: makes and things with no class of their own.
 * The sources and their ids are in scripts/item-kinds.sources.json. Run it by
 * hand, then the precision gate (@tests/unit/item-images/item-kind-precision).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));

type KindSources = { emoji: string[]; roots: string[]; models: string[] };

const CONFIG = JSON.parse(readFileSync(join(HERE, 'item-kinds.sources.json'), 'utf8'));

const SOURCES = CONFIG.kinds as Record<string, KindSources>;
const STOP_CONCEPTS = CONFIG.stopConcepts as string[];
const EXTRAS = JSON.parse(readFileSync(join(HERE, 'item-kinds.extras.json'), 'utf8'))
  .kinds as Record<string, string[]>;
const OUT = join(HERE, '../src/config-assets/item-kinds/item-kinds.json.gz');

const CLDR_VERSION = '49.0.0';
const CLDR = `https://cdn.jsdelivr.net/npm/cldr-annotations-full@${CLDR_VERSION}/annotations`;
const CLDR_DATES = `https://cdn.jsdelivr.net/npm/cldr-dates-full@${CLDR_VERSION}/main`;
const WDQS = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'StoicBudget/1.0 (https://github.com/stoic-budget/stoic-budget; item kinds build)';

// Wikidata language codes; CLDR names Bokmål `no` and Latin Serbian `sr-Latn`.
const LANGS = [
  'en', 'ru', 'kk', 'de', 'fr', 'es', 'pt', 'tr', 'uk', 'zh', 'pl', 'it', 'sk', 'ja', 'ko', 'hi',
  'nl', 'sv', 'vi', 'id', 'da', 'nb', 'nn', 'fi', 'is', 'fo', 'cs', 'bg', 'hr', 'sr', 'sl', 'mk',
  'be', 'bs', 'hsb', 'he', 'ar',
];
const CLDR_LOCALES = LANGS.map(lang => (lang === 'nb' ? 'no' : lang)).concat('sr-Latn');

/** A subclass known to fewer Wikipedias than this is too obscure, or too odd, to name a kind. */
const MIN_SITELINKS = 8;

/**
 * Words that a kind's tree holds but a bank statement uses for something else:
 * a match on them would draw a tile on "Crown Casino" or "Shield Insurance".
 * Grown from the precision gate and the false-positive probe.
 */
const STOP_PHRASES = ['home office', 'hot desk'];

const STOP = new Set(
  [
    // What the brand index keeps out (scripts/build-brand-index.ts), and more of the same.
    'the and for with from online payment transfer charges charge interest salary cash card',
    'bank service services pay shop store market mart food fresh express city central home',
    'plus max one star best first family super mini total day life care health centre center',
    'direct debit credit refund account loan fee fees bill bills order purchase pos atm upi',
    'neft imps rtgs sepa amazon google apple paypal mobile free house garage now new go',
    'smart green blue red global united national royal golden quick easy happy big little',
    'metro coffee roasters bakery kitchen grill bar pizza burger sushi taxi cab parking hotel',
    'travel club fitness gym energy power electric gas water oil auto car motors motor service',
    'local village town country world international group company corner square street',
    'crown shield medal mask button badge cap seal stamp token pass key keys chain cover',
    'case box set kit pack unit item piece part parts model series line pro air salad bar',
    'office table chart board panel screen display station point base port link net web',
    'cloud data file app apps game games play player ticket tickets prepaid prepay recharge',
    // Found on a run over real statement lines: company names and office words.
    'atlas utility video merlin course notebook notebooks desk',
  ]
    .join(' ')
    .split(' ')
    .concat(STOP_PHRASES),
);

const LETTER = /\p{L}/u;
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** The form a word is stored in, or null when it says too little to name a kind. */
function clean(word: string, stop: Set<string>, minSingleWord = 3): string | null {
  const text = word
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!LETTER.test(text) || STOP.has(text) || stop.has(text)) return null;
  const length = [...text].length;
  const minimum = UNSPACED.test(text) ? 2 : text.includes(' ') ? 3 : minSingleWord;
  if (length < minimum || length > 60) return null;
  return text;
}

/** Answers are kept in the temp dir, so a run cut short by a timeout resumes where it stopped. */
const CACHE = join(tmpdir(), 'item-kinds-wdqs');

async function sparql(query: string): Promise<string[]> {
  mkdirSync(CACHE, { recursive: true });
  const cached = join(CACHE, `${createHash('sha256').update(query).digest('hex')}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  const started = Date.now();
  const answer = await ask(query);
  console.log(`  wdqs ${answer.length} in ${Math.round((Date.now() - started) / 1000)}s`);
  writeFileSync(cached, JSON.stringify(answer));
  return answer;
}

async function ask(query: string): Promise<string[]> {
  for (let attempt = 1; ; attempt++) {
    const url = `${WDQS}?${new URLSearchParams({ query, format: 'json' })}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(120_000),
    }).catch(() => null);
    if (response?.ok) {
      const body = (await response.json()) as {
        results: { bindings: Array<{ l: { value: string } }> };
      };
      return body.results.bindings.map(row => row.l.value);
    }
    if (attempt === 6) throw new Error(`Wikidata ${response?.status ?? 'timeout'}: ${query.slice(0, 160)}`);
    await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
  }
}

const IN_LANGS = `FILTER(LANG(?l) IN (${LANGS.map(lang => `'${lang}'`).join(',')}))`;

/**
 * The root, and its subclasses up to three steps down that enough Wikipedias
 * know. Labels only: aliases are where "cash", "pos" and "abm" come from.
 */
// Two queries, not one: a UNION binding the root itself makes the query service time out.
async function rootWords(root: string): Promise<string[]> {
  const own = await sparql(`SELECT DISTINCT ?l WHERE { wd:${root} rdfs:label ?l . ${IN_LANGS} }`);
  const subclasses = await sparql(`SELECT DISTINCT ?l WHERE {
    ?c wdt:P279/wdt:P279?/wdt:P279? wd:${root} .
    ?c wikibase:sitelinks ?n . FILTER(?n >= ${MIN_SITELINKS})
    ?c rdfs:label ?l . ${IN_LANGS}
  }`);
  return [...own, ...subclasses];
}

/**
 * Makes and models, by label only (aliases of a model are its bare name:
 * "Golf", "Boxer"). A one-word label must carry a digit ("PS5", "A7") to say
 * it is a model and not a word.
 */
async function modelWords(modelClass: string): Promise<string[]> {
  const labels = await sparql(`SELECT DISTINCT ?l WHERE {
    ?i wdt:P31 wd:${modelClass} . ?i rdfs:label ?l . ${IN_LANGS}
  }`);
  return labels.filter(label => /\s/.test(label.trim()) || /\d/.test(label));
}

/**
 * Words of money and shops, in every language: the names (and aliases) of the
 * stop concepts, and the months, which statement lines are full of.
 */
async function stopWords(): Promise<Set<string>> {
  const values = STOP_CONCEPTS.map(id => `wd:${id}`).join(' ');
  const names = await sparql(`SELECT DISTINCT ?l WHERE {
    VALUES ?c { ${values} } ?c rdfs:label|skos:altLabel ?l . ${IN_LANGS}
  }`);
  const words = new Set(names.map(name => name.normalize('NFKC').toLocaleLowerCase().trim()));
  for (const locale of CLDR_LOCALES) {
    const response = await fetch(`${CLDR_DATES}/${locale}/ca-gregorian.json`);
    if (!response.ok) continue;
    const body = (await response.json()) as {
      main: Record<string, { dates: { calendars: { gregorian: { months: Record<string, Record<string, Record<string, string>>> } } } }>;
    };
    const months = Object.values(body.main)[0].dates.calendars.gregorian.months;
    for (const context of Object.values(months)) {
      for (const width of [context.wide, context.abbreviated]) {
        for (const month of Object.values(width ?? {})) words.add(month.toLocaleLowerCase().replace(/\.$/, ''));
      }
    }
  }
  return words;
}

const tokens = (text: string): string[] => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const related = (token: string, name: string): boolean =>
  token === name ||
  (Math.min([...token].length, [...name].length) >= 4 &&
    (token.startsWith(name.slice(0, 4)) || name.startsWith(token.slice(0, 4))));

/**
 * CLDR: an emoji's name always names its kind; a keyword only when it names
 * few emoji, nearly all of this kind's, and shares a word with a name ("машина"
 * with "полицейская машина", not "уют" with "диван").
 */
async function cldrWords(): Promise<Map<string, Set<string>>> {
  const words = new Map<string, Set<string>>();
  const plain = (emoji: string): string => emoji.replace(/️/g, '');
  const kindOfEmoji = new Map(
    Object.entries(SOURCES).flatMap(([kind, s]) => s.emoji.map(e => [plain(e), kind] as const)),
  );
  for (const locale of CLDR_LOCALES) {
    const response = await fetch(`${CLDR}/${locale}/annotations.json`);
    if (!response.ok) throw new Error(`CLDR ${locale}: ${response.status}`);
    const body = (await response.json()) as {
      annotations: { annotations: Record<string, { default?: string[]; tts?: string[] }> };
    };
    const table = new Map(
      Object.entries(body.annotations.annotations).map(([e, v]) => [plain(e), v] as const),
    );
    const emojiOfWord = new Map<string, Set<string>>();
    for (const [emoji, entry] of table) {
      for (const word of [...(entry.default ?? []), ...(entry.tts ?? [])]) {
        const key = word.toLocaleLowerCase();
        emojiOfWord.set(key, (emojiOfWord.get(key) ?? new Set()).add(emoji));
      }
    }
    for (const [kind, s] of Object.entries(SOURCES)) {
      const found = words.get(kind) ?? new Set<string>();
      const own = s.emoji.map(plain);
      const names = own.flatMap(e => table.get(e)?.tts ?? []).map(n => n.toLocaleLowerCase());
      names.forEach(name => found.add(name));
      const nameTokens = names.flatMap(tokens);
      for (const word of own.flatMap(e => table.get(e)?.default ?? [])) {
        const key = word.toLocaleLowerCase();
        const named = [...(emojiOfWord.get(key) ?? [])];
        const share = named.filter(e => kindOfEmoji.get(e) === kind).length / named.length;
        if (share >= 0.75 && named.length <= 4 && tokens(key).some(t => nameTokens.some(n => related(t, n)))) {
          found.add(key);
        }
      }
      words.set(kind, found);
    }
  }
  return words;
}

async function main(): Promise<void> {
  const stop = await stopWords();
  // Curated words (CLDR, extras) may take an ending; Wikidata's must match whole.
  const fuzzy = new Map<string, Set<string>>();
  const exact = new Map<string, Set<string>>();
  const add = (into: Map<string, Set<string>>, kind: string, words: Iterable<string>, min = 3): void => {
    const set = into.get(kind) ?? new Set<string>();
    for (const word of words) {
      const cleaned = clean(word, stop, min);
      if (cleaned) set.add(cleaned);
    }
    into.set(kind, set);
  };
  for (const [kind, words] of await cldrWords()) add(fuzzy, kind, words);
  for (const [kind, sources] of Object.entries(SOURCES)) {
    add(fuzzy, kind, EXTRAS[kind] ?? []);
    // One-word Wikidata names under five letters collide across languages ("bank", "bar").
    for (const root of sources.roots) add(exact, kind, await rootWords(root), 5);
    for (const model of sources.models) add(exact, kind, await modelWords(model), 5);
    for (const word of fuzzy.get(kind) ?? []) exact.get(kind)?.delete(word);
    console.log(`${kind}: ${fuzzy.get(kind)?.size ?? 0} + ${exact.get(kind)?.size ?? 0}`);
  }
  const sorted = (map: Map<string, Set<string>>) =>
    Object.fromEntries([...map].map(([kind, words]) => [kind, [...words].sort()]));
  const output = {
    source: `Wikidata (CC0, ${new Date().toISOString().slice(0, 10)}), Unicode CLDR ${CLDR_VERSION} emoji annotations and calendars (Unicode License v3), scripts/item-kinds.extras.json`,
    order: Object.keys(SOURCES),
    kinds: sorted(fuzzy),
    exact: sorted(exact),
  };
  writeFileSync(OUT, gzipSync(JSON.stringify(output)));
  const total = [...fuzzy.values(), ...exact.values()].reduce((sum, words) => sum + words.size, 0);
  console.log(`${total} words (${stop.size} stop words) → ${OUT}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
