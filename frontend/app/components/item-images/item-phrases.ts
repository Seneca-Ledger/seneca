/**
 * What a note says around the thing itself: "Sold", "Купил", "Zahlung für",
 * "Rückerstattung". Cut from the start and the end of a note before it becomes
 * a search, in every language the app speaks, plus Hebrew and Arabic, which
 * notes are often written in. The words are data (`item-phrases.data.json`).
 */
import phrases from './item-phrases.data.json';

/** Cuts from the start a separator after a phrase may leave: "Sold: …", "Продажа — …". */
const SEPARATORS = /^[\s:;,.–—\-|/]+/u;

const byLength = (a: string, b: string): number => b.length - a.length;
export const DEAL_PHRASES: readonly string[] = [
  ...new Set(Object.values(phrases.deals).flat()),
].sort(byLength);
export const FILLER_WORDS: ReadonlySet<string> = new Set(Object.values(phrases.fillers).flat());

/** Han, kana, Hangul and Thai run words together; a phrase there needs no space after it. */
const UNSPACED =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]/u;
const LETTER = /[\p{L}\p{N}]/u;

/** The phrase at the start of `text`, as a whole word unless the script has no spaces. */
export function leadingPhrase(text: string): string | null {
  const lower = text.toLocaleLowerCase();
  for (const phrase of DEAL_PHRASES) {
    if (!lower.startsWith(phrase)) {
      continue;
    }
    const next = lower.charAt(phrase.length);
    if (UNSPACED.test(phrase) || !LETTER.test(next)) {
      return text.slice(0, phrase.length);
    }
  }
  return null;
}

/** The phrase at the end of `text`, as a whole word unless the script has no spaces. */
export function trailingPhrase(text: string): string | null {
  const lower = text.toLocaleLowerCase();
  for (const phrase of DEAL_PHRASES) {
    if (!lower.endsWith(phrase)) {
      continue;
    }
    const before = lower.charAt(lower.length - phrase.length - 1);
    if (UNSPACED.test(phrase) || !LETTER.test(before)) {
      return text.slice(-phrase.length);
    }
  }
  return null;
}

export { SEPARATORS };
