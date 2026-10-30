import type { SystemCategoryKey } from '../../categories/system-categories';

export type OnlineService = {
  /** Spellings as they appear in descriptors; matched on word boundaries. */
  names: readonly string[];
  key: SystemCategoryKey;
  /** Countries it is matched in; none means everywhere. */
  countries?: readonly string[];
};

/**
 * Services people pay online that OSM, a map of shops, does not list. Payment
 * apps (Paytm, PhonePe, GPay) are not here: their name sits next to whoever
 * was paid, it says nothing about what was bought. Nor are investment apps:
 * moving savings is not spending.
 */
export const ONLINE_SERVICES: readonly OnlineService[] = [
  { names: ['netflix'], key: 'subscriptions' },
  { names: ['spotify'], key: 'subscriptions' },
  { names: ['youtube premium', 'youtubepremium', 'google youtube'], key: 'subscriptions' },
  { names: ['disney plus', 'disneyplus'], key: 'subscriptions' },
  { names: ['amazon prime', 'prime video', 'primevideo'], key: 'subscriptions' },
  { names: ['apple com bill', 'itunes com bill'], key: 'subscriptions' },
  { names: ['hulu'], key: 'subscriptions', countries: ['us'] },
  { names: ['audible'], key: 'subscriptions' },
  { names: ['jio', 'reliance jio'], key: 'phone_internet', countries: ['in'] },
  { names: ['airtel', 'bharti airtel'], key: 'phone_internet', countries: ['in'] },
  { names: ['bsnl'], key: 'phone_internet', countries: ['in'] },
  { names: ['verizon', 'at and t', 't mobile'], key: 'phone_internet', countries: ['us'] },
  { names: ['kcell', 'beeline', 'tele2'], key: 'phone_internet', countries: ['kz'] },
  { names: ['мтс', 'билайн', 'мегафон'], key: 'phone_internet', countries: ['ru'] },
  { names: ['uber', 'uber trip'], key: 'transport' },
  { names: ['ola cabs', 'olacabs', 'rapido'], key: 'transport', countries: ['in'] },
  { names: ['lyft'], key: 'transport', countries: ['us', 'ca'] },
  { names: ['swiggy', 'zomato'], key: 'dining', countries: ['in'] },
  { names: ['doordash', 'grubhub', 'uber eats', 'ubereats'], key: 'dining' },
  { names: ['deliveroo', 'just eat', 'lieferando', 'wolt', 'glovo'], key: 'dining' },
];
