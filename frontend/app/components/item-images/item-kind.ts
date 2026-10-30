import { FILLER_WORDS, leadingPhrase, SEPARATORS, trailingPhrase } from './item-phrases';

const TRAILING_SEPARATORS = /[\s:;,.–—\-|/]+$/u;
const firstWord = (text: string): string => text.split(' ')[0].toLocaleLowerCase();

/** The note without the deal ("Sold", "Купил", "Zahlung für") and stray marks: what the thing is called. */
export function itemSearchTerm(note: string): string {
  let text = note
    .replace(/[«»"“”„()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (let changed = true; changed && text; ) {
    changed = false;
    const lead = leadingPhrase(text);
    if (lead && lead.length < text.length) {
      text = text.slice(lead.length).replace(SEPARATORS, '');
      for (let first = firstWord(text); FILLER_WORDS.has(first) && text.includes(' '); ) {
        text = text.slice(first.length).trimStart();
        first = firstWord(text);
      }
      changed = true;
    }
    const trail = trailingPhrase(text);
    if (trail && trail.length < text.length) {
      text = text.slice(0, -trail.length).replace(TRAILING_SEPARATORS, '');
      changed = true;
    }
  }
  return text.slice(0, 100);
}
