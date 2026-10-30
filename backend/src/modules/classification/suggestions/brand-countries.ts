/**
 * Where a statement's money is spent, read off its currency: a brand is only
 * matched where NSI says it trades, so "Spar" in a rupee statement is not the
 * Austrian supermarket. A currency shared by many countries (the euro) gives
 * them all; an unknown one gives none, and only worldwide brands match.
 */
const BY_CURRENCY: Record<string, readonly string[]> = {
  INR: ['in'],
  USD: ['us'],
  GBP: ['gb'],
  EUR: [
    'de',
    'fr',
    'es',
    'it',
    'nl',
    'be',
    'at',
    'ie',
    'pt',
    'fi',
    'gr',
    'sk',
    'si',
    'ee',
    'lv',
    'lt',
    'lu',
    'mt',
    'cy',
    'hr',
  ],
  KZT: ['kz'],
  RUB: ['ru'],
  UAH: ['ua'],
  BYN: ['by'],
  PLN: ['pl'],
  CZK: ['cz'],
  HUF: ['hu'],
  RON: ['ro'],
  BGN: ['bg'],
  RSD: ['rs'],
  BAM: ['ba'],
  MKD: ['mk'],
  CHF: ['ch'],
  SEK: ['se'],
  NOK: ['no'],
  DKK: ['dk'],
  ISK: ['is'],
  TRY: ['tr'],
  ILS: ['il'],
  AED: ['ae'],
  CNY: ['cn'],
  JPY: ['jp'],
  KRW: ['kr'],
  SGD: ['sg'],
  IDR: ['id'],
  VND: ['vn'],
  AUD: ['au'],
  NZD: ['nz'],
  CAD: ['ca'],
  MXN: ['mx'],
  BRL: ['br'],
  ZAR: ['za'],
};

/** Countries inside NSI's region codes ("150" is Europe); "001" is the whole world. */
const EUROPE = new Set([
  ...BY_CURRENCY.EUR,
  'gb',
  'ru',
  'ua',
  'by',
  'pl',
  'cz',
  'hu',
  'ro',
  'bg',
  'rs',
  'ba',
  'mk',
  'ch',
  'se',
  'no',
  'dk',
  'is',
]);

export function countriesForCurrency(currency: string | null | undefined): readonly string[] {
  return BY_CURRENCY[(currency ?? '').toUpperCase()] ?? [];
}

/**
 * Whether one NSI location code covers one of these countries: a country
 * ("de"), a part of one ("us-ca", "gb-lon.geojson"), Europe ("150") or the
 * world ("001").
 */
export function locationCovers(code: string, countries: readonly string[]): boolean {
  if (code === '001') {
    return true;
  }
  if (code === '150') {
    return countries.some(country => EUROPE.has(country));
  }
  const country = /^([a-z]{2})(?:[-.]|$)/u.exec(code)?.[1];
  return country !== undefined && countries.includes(country);
}
