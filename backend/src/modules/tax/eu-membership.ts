/**
 * EU member states, by ISO-3166-1 alpha-2.
 *
 * Kept separate from the jurisdiction catalogue on purpose. That table holds
 * the countries a workspace can file in — six of them — while a counterparty
 * can sit in any member state. Deciding reverse charge from the catalogue would
 * mean a French supplier failed the EU test simply because nobody files in
 * France here, and the supply would be taxed the ordinary way instead.
 *
 * `tax_jurisdictions.is_eu` mirrors this for the countries we do support, and
 * exists so the API can describe a jurisdiction without consulting this list.
 */
const EU_COUNTRIES: ReadonlySet<string> = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export function isEuCountry(code: string | null | undefined): boolean {
  return code ? EU_COUNTRIES.has(code.toUpperCase()) : false;
}
