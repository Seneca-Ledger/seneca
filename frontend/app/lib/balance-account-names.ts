import { getCachedIntlayer } from '@/app/lib/locale-packs';
import { normalizeLocale } from './locale';

/**
 * The server names preset balance accounts in Russian, English or Kazakh only
 * (and its own crypto and metals accounts in English). Any of those spellings,
 * without the article numeral, finds the account's slug in the
 * balanceAccountNames dictionary. A name the user typed is not in the table
 * and is shown as typed.
 */
const NAME_TO_SLUG = new Map<string, string>([
  ['внеоборотные активы', 'nonCurrentAssets'],
  ['non-current assets', 'nonCurrentAssets'],
  ['айналымнан тыс активтер', 'nonCurrentAssets'],
  ['основные средства', 'fixedAssets'],
  ['fixed assets', 'fixedAssets'],
  ['негізгі құралдар', 'fixedAssets'],
  ['нематериальные активы', 'intangibleAssets'],
  ['intangible assets', 'intangibleAssets'],
  ['материалдық емес активтер', 'intangibleAssets'],
  ['инвестиции', 'investments'],
  ['investments', 'investments'],
  ['инвестициялар', 'investments'],
  ['оборотные активы', 'currentAssets'],
  ['current assets', 'currentAssets'],
  ['айналым активтері', 'currentAssets'],
  ['запасы', 'inventory'],
  ['inventory', 'inventory'],
  ['қорлар', 'inventory'],
  ['дебиторская задолженность', 'receivables'],
  ['accounts receivable', 'receivables'],
  ['дебиторлық берешек', 'receivables'],
  ['деньги', 'cash'],
  ['cash', 'cash'],
  ['ақша', 'cash'],
  ['собственный капитал', 'equity'],
  ['equity', 'equity'],
  ['меншікті капитал', 'equity'],
  ['уставный капитал', 'authorizedCapital'],
  ['authorized capital', 'authorizedCapital'],
  ['жарғылық капитал', 'authorizedCapital'],
  ['дополнительный капитал', 'additionalCapital'],
  ['additional capital', 'additionalCapital'],
  ['қосымша капитал', 'additionalCapital'],
  ['нераспределённая прибыль (непокрытый убыток)', 'retainedEarnings'],
  ['retained earnings (uncovered loss)', 'retainedEarnings'],
  ['бөлінбеген пайда (жабылмаған залал)', 'retainedEarnings'],
  ['ссудный капитал', 'borrowedCapital'],
  ['borrowed capital', 'borrowedCapital'],
  ['қарыз капиталы', 'borrowedCapital'],
  ['криптовалюта', 'crypto'],
  ['crypto', 'crypto'],
  ['драгоценные металлы', 'preciousMetals'],
  ['precious metals', 'preciousMetals'],
  ['асыл металдар', 'preciousMetals'],
]);

/** "III. Cash": balance-sheet article numerals, kept in front of the translation. */
const ARTICLE = /^[IVXLC]+\.\s+/;

type Dictionary = Record<string, { value?: unknown } | string | undefined>;

const dictionaryByLocale = new Map<string, Dictionary | null>();

const dictionaryFor = (locale: string): Dictionary | null => {
  const cached = dictionaryByLocale.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  let dictionary: Dictionary | null;
  try {
    dictionary = getCachedIntlayer('balanceAccountNames', locale) as Dictionary;
  } catch {
    dictionary = null;
  }
  dictionaryByLocale.set(locale, dictionary);
  return dictionary;
};

/** A missing dictionary answers with a Proxy, so only a real string counts. */
const readValue = (node: { value?: unknown } | string | undefined): string | undefined => {
  if (typeof node === 'string') {
    return node;
  }
  const value = node?.value;
  return typeof value === 'string' ? value : undefined;
};

export function localizeBalanceAccountName(name: string, locale: string): string {
  const article = ARTICLE.exec(name)?.[0] ?? '';
  const slug = NAME_TO_SLUG.get(name.slice(article.length).trim().toLowerCase());
  if (!slug) {
    return name;
  }
  const dictionary = dictionaryFor(normalizeLocale(locale));
  const translated = dictionary ? readValue(dictionary[slug]) : undefined;
  return translated ? `${article}${translated}` : name;
}
