/**
 * What a quote speaks to. Every advice situation maps to one theme
 * (situation-themes.ts), so the quote of the day is about what is actually
 * going on in the user's money rather than a random aphorism.
 */
export type QuoteTheme =
  | 'discipline'
  | 'temperance'
  | 'small_things'
  | 'patience'
  | 'fortune'
  | 'foresight'
  | 'generosity'
  | 'needs'
  | 'self_improvement'
  | 'contentment'
  | 'habit';

export interface QuoteEntry {
  id: string;
  author: string;
  /** Where the exact wording comes from — book, letter, year, translator. */
  source: string;
  sourceUrl: string;
  themes: QuoteTheme[];
}
