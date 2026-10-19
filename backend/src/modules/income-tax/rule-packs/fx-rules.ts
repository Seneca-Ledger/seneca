/**
 * Which exchange rate converts foreign-currency amounts, by country.
 *
 * Only rules checked against the statute appear here. Everywhere else the draft
 * converts at the rate for the transaction's own date and says that this is an
 * assumption, not the country's official rule.
 */

export type FxRule = 'transaction_date' | 'nbp_previous_business_day' | 'bdi_reference_rate';

const COUNTRY_FX_RULES: Record<string, FxRule> = {
  // Art. 11a ustawy o PIT: NBP average rate (table A) of the last business day
  // before the day the revenue is earned or the cost incurred.
  PL: 'nbp_previous_business_day',
  // Redditi PF 2026 instructions, "Conversione delle valute estere": the reference
  // rate of the day received or paid, or the nearest earlier day; failing that,
  // the monthly average. The instructions point to Banca d'Italia for the rates.
  IT: 'bdi_reference_rate',
};

export function fxRuleFor(countryCode: string): FxRule {
  return COUNTRY_FX_RULES[countryCode.toUpperCase()] ?? 'transaction_date';
}
