/** Quote texts and author names in one language, keyed by quote id and English author name. */
export interface QuoteTexts {
  quotes: Record<string, string>;
  authors: Record<string, string>;
}
