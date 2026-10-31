/**
 * Words of a brand name or a bank descriptor, compared the same way on both
 * sides: lower case, no diacritics, "&" read as "and", anything that is not a
 * letter or digit a separator. "7-Eleven" and "7-ELEVEN #1234" both give
 * "7 eleven", "McDonald's" and "MCDONALDS" both "mcdonalds"; in a descriptor,
 * store and terminal numbers (a token with two or more digits) are dropped.
 */
export function brandWords(text: string, { dropReferences = false } = {}): string[] {
  const words = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // "McDonald's" and "MCDONALDS" are one name.
    .replace(/['’`]/gu, '')
    .replace(/&/gu, ' and ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return dropReferences ? words.filter(word => (word.match(/\p{N}/gu) ?? []).length < 2) : words;
}
