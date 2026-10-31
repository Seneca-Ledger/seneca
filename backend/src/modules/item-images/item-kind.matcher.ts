import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** The bundled dictionary, built by scripts/build-item-kinds.ts. */
export type ItemKindDictionary = {
  order: string[];
  /** Curated words (CLDR, extras): they may take an ending. */
  kinds: Record<string, string[]>;
  /** Wikidata's names: they match whole, or with a plural's one letter. */
  exact?: Record<string, string[]>;
};

type Entry = {
  kind: string;
  word: string;
  tokens: string[];
  unspaced: string | null;
  exact: boolean;
};

/** Han, kana and Hangul run words together: there a word is found anywhere in the note. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
/** Latin script, diacritics included: such words take a plural, never a case ending. */
const LATIN = /\p{Script=Latin}/u;
const normalize = (text: string): string => text.normalize('NFKC').toLocaleLowerCase();
const tokensOf = (text: string): string[] =>
  normalize(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
/** Entries are filed by the first two letters of their first word. */
const keyOf = (token: string): string => [...token].slice(0, 2).join('');

function sharedStart(a: string[], b: string[]): number {
  let at = 0;
  while (at < a.length && at < b.length && a[at] === b[at]) {
    at += 1;
  }
  return at;
}

/**
 * How well a word of the note matches a dictionary word, 0 for not at all,
 * allowing for an ending: "дивана" is "диван", "машину" is "машина", "bikes" is
 * "bike". Latin-script words take only a plural; elsewhere the shorter the word,
 * the shorter the ending — "платье" is not "платежи" — and a word under four
 * letters must match whole, or "car" would find "card". The score is the letters shared, so
 * "кровати" is nearer "кровать" than "кроватка".
 */
function wordScore(word: string, noteWord: string): number {
  const letters = [...word];
  const noteLetters = [...noteWord];
  const shared = sharedStart(letters, noteLetters);
  const length = letters.length;
  const extra = noteLetters.length - length;
  if (shared === length && extra === 0) {
    return shared + 1;
  }
  // Latin-script words take a plural, nothing more: "phone" is not "PhonePe", "campaña" not "campaign".
  if (LATIN.test(word)) {
    const rest = noteWord.slice(word.length);
    return length >= 4 && shared === length && (rest === 's' || rest === 'es') ? shared : 0;
  }
  const ending = length >= 7 ? 4 : length >= 5 ? 2 : 1;
  if (length >= 4 && shared === length && extra <= ending) {
    return shared;
  }
  // Inflected languages change the last letters: "машина" → "машину", "кровать" → "кровати".
  if (length >= 5 && shared >= length - 1 && extra >= 0 && extra <= 2) {
    return shared;
  }
  return length >= 7 && shared >= length - 2 && extra >= -1 && extra <= 2 ? shared : 0;
}

/**
 * Finds the kind of thing a note names ("Sold Mac Mini M4" → desktop), in any
 * of the dictionary's languages, or null when it names none it knows. Abstaining
 * is always allowed: a wrong icon is worse than a letter.
 */
export class ItemKindMatcher {
  private readonly index = new Map<string, Entry[]>();
  private readonly rank: Map<string, number>;

  constructor(dictionary: ItemKindDictionary) {
    this.rank = new Map(dictionary.order.map((kind, at) => [kind, at]));
    for (const kind of dictionary.order) {
      this.add(kind, dictionary.kinds[kind] ?? [], false);
      this.add(kind, dictionary.exact?.[kind] ?? [], true);
    }
  }

  private add(kind: string, words: string[], exact: boolean): void {
    for (const word of words) {
      const tokens = tokensOf(word);
      if (tokens.length === 0) {
        continue;
      }
      const unspaced = UNSPACED.test(word) ? normalize(word).replace(/\s+/g, '') : null;
      const key = unspaced ? '' : keyOf(tokens[0]);
      const list = this.index.get(key);
      const entry = { kind, word, tokens, unspaced, exact };
      if (list) {
        list.push(entry);
      } else {
        this.index.set(key, [entry]);
      }
    }
  }

  /** The match sharing the most letters wins ("mac mini" over "mini"); a tie goes to the more specific kind. */
  match(note: string): string | null {
    return this.explain(note)?.kind ?? null;
  }

  /** The kind and the dictionary word that named it, for tests and tuning. */
  explain(note: string): { kind: string; word: string } | null {
    const words = tokensOf(note);
    const joined = normalize(note).replace(/\s+/g, '');
    let best: { entry: Entry; score: number } | null = null;
    const consider = (entry: Entry, score: number): void => {
      if (
        !best ||
        score > best.score ||
        (score === best.score &&
          (this.rank.get(entry.kind) ?? 99) < (this.rank.get(best.entry.kind) ?? 99))
      ) {
        best = { entry, score };
      }
    };
    for (const entry of this.index.get('') ?? []) {
      if (entry.unspaced && joined.includes(entry.unspaced)) {
        consider(entry, [...entry.unspaced].length + 1);
      }
    }
    words.forEach((word, at) => {
      for (const entry of this.index.get(keyOf(word)) ?? []) {
        const score = phraseScore(entry, words, at);
        if (score > 0) {
          consider(entry, score);
        }
      }
    });
    const found = (best as { entry: Entry } | null)?.entry;
    return found ? { kind: found.kind, word: found.word } : null;
  }
}

/** A last letter a case ending replaces: "гитара" → "гитару", "кровать" → "кровати"; a consonant is never one. */
const ENDING_LETTER = /[аеёиоуыэюяьйіїєaeiouy]$/u;

/**
 * A Wikidata name matches whole, as a plural ("armchairs" — not "federa" in "federal"),
 * or, outside the Latin script, with a case ending — but only by adding one or
 * by changing a final vowel ("электрогитару"), never a consonant: "наличник" (a
 * window frame) is not "наличных".
 */
function exactScore(word: string, noteWord: string): number {
  if (word === noteWord) {
    return [...word].length + 1;
  }
  const letters = [...word];
  const length = letters.length;
  const noteLength = [...noteWord].length;
  if (length < 5) {
    return 0;
  }
  if (LATIN.test(word)) {
    const rest = noteWord.slice(word.length);
    return noteWord.startsWith(word) && (rest === 's' || rest === 'es') ? length : 0;
  }
  const shared = sharedStart(letters, [...noteWord]);
  if (shared === length && noteLength - length <= 2) {
    return shared;
  }
  return shared === length - 1 &&
    ENDING_LETTER.test(word) &&
    noteLength - length <= 1 &&
    noteLength >= length
    ? shared
    : 0;
}

/** The letters a phrase shares with the note's words from `at`, 0 when one word misses. */
function phraseScore(entry: Entry, words: string[], at: number): number {
  let total = 0;
  for (const [offset, token] of entry.tokens.entries()) {
    const noteWord = words[at + offset];
    const score =
      noteWord === undefined
        ? 0
        : entry.exact
          ? exactScore(token, noteWord)
          : wordScore(token, noteWord);
    if (score === 0) {
      return 0;
    }
    total += score;
  }
  return total;
}

let shared: ItemKindMatcher | null = null;

/** The matcher over the bundled dictionary, read on first use and kept for the life of the process. */
export function itemKindMatcher(): ItemKindMatcher {
  if (!shared) {
    const file = join(__dirname, '../../config-assets/item-kinds/item-kinds.json.gz');
    shared = new ItemKindMatcher(JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')));
  }
  return shared;
}
