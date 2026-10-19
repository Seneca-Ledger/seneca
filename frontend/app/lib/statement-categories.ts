import { getIntlayer } from 'react-intlayer';
import { normalizeLocale } from './locale';
export type StatementCategorySource = 'system' | 'user' | 'parsing';

export interface StatementCategoryNode {
  id: string;
  name: string;
  source?: StatementCategorySource;
  isSystem?: boolean;
  children?: StatementCategoryNode[];
}

export interface StatementCategoryOption {
  id: string;
  name: string;
  source?: StatementCategorySource;
  isSystem?: boolean;
}

/**
 * Category rows store a plain name, and the parser creates categories with
 * names of its own, so a name is the only stable join key available — there is
 * no system_key column to rely on. Aliases cover the Russian, English and
 * Kazakh spellings a workspace may already have persisted.
 */
const NAME_TO_SLUG = new Map<string, string>([
  ['advertising', 'advertising'],
  ['bank fees', 'bankFees'],
  ['benefits and compensation', 'benefits'],
  ['equipment', 'equipment'],
  ['fees and charges', 'feesAndCharges'],
  ['home office', 'homeOffice'],
  ['income', 'income'],
  ['insurance', 'insurance'],
  ['interest', 'interest'],
  ['interest income', 'interestIncome'],
  ['internal transfers', 'internalTransfers'],
  ['inventory purchases', 'inventoryPurchases'],
  ['it services', 'itServices'],
  ['it услуги', 'itServices'],
  ['it қызметтері', 'itServices'],
  ['kaspi fees', 'kaspiFees'],
  ['kaspi red payments', 'kaspiRedPayments'],
  ['kaspi red төлемдері', 'kaspiRedPayments'],
  ['kaspi sales', 'kaspiSales'],
  ['kaspi комиссиялары', 'kaspiFees'],
  ['kaspi сатылымдары', 'kaspiSales'],
  ['loans and borrowings', 'loans'],
  ['logistics and delivery', 'logistics'],
  ['maintenance and repairs', 'maintenance'],
  ['marketing and advertising', 'marketing'],
  ['materials', 'materials'],
  ['meals and entertainment', 'meals'],
  ['office supplies', 'officeSupplies'],
  ['other expenses', 'otherExpenses'],
  ['other income', 'otherIncome'],
  ['payroll', 'payroll'],
  ['payroll expenses', 'employeeSalaries'],
  ['professional services', 'professionalServices'],
  ['rent', 'rent'],
  ['sales', 'sales'],
  ['service payments', 'servicePayments'],
  ['services', 'services'],
  ['taxes', 'taxes'],
  ['travel', 'travel'],
  ['uncategorized', 'uncategorized'],
  ['utilities', 'utilities'],
  ['vehicle expenses', 'vehicleExpenses'],
  ['автомобильные расходы', 'vehicleExpenses'],
  ['аренда', 'rent'],
  ['банк комиссиялары', 'bankFees'],
  ['без категории', 'uncategorized'],
  ['внутренние переводы', 'internalTransfers'],
  ['домашний офис', 'homeOffice'],
  ['еңбекақы', 'payroll'],
  ['жабдық', 'equipment'],
  ['жалға алу', 'rent'],
  ['жарнама', 'advertising'],
  ['жеңілдіктер мен өтемақылар', 'benefits'],
  ['закупки товаров', 'inventoryPurchases'],
  ['зарплаты сотрудникам', 'employeeSalaries'],
  ['канцелярские товары', 'officeSupplies'],
  ['кеңсе тауарлары', 'officeSupplies'],
  ['командировки', 'travel'],
  ['комиссии kaspi', 'kaspiFees'],
  ['комиссии банка', 'bankFees'],
  ['комиссии и сборы', 'feesAndCharges'],
  ['комиссиялар мен алымдар', 'feesAndCharges'],
  ['коммуналдық қызметтер', 'utilities'],
  ['коммунальные услуги', 'utilities'],
  ['кредиты и займы', 'loans'],
  ['кіріс', 'income'],
  ['кәсіби қызметтер', 'professionalServices'],
  ['көлік шығындары', 'vehicleExpenses'],
  ['логистика және жеткізу', 'logistics'],
  ['логистика и доставка', 'logistics'],
  ['льготы и компенсации', 'benefits'],
  ['маркетинг және жарнама', 'marketing'],
  ['маркетинг и реклама', 'marketing'],
  ['материалдар', 'materials'],
  ['материалы', 'materials'],
  ['налоги', 'taxes'],
  ['несиелер мен қарыздар', 'loans'],
  ['оборудование', 'equipment'],
  ['обслуживание и ремонт', 'maintenance'],
  ['оплата труда', 'payroll'],
  ['оплата услуг', 'servicePayments'],
  ['пайыздар', 'interest'],
  ['пайыздық табыс', 'interestIncome'],
  ['питание и представительские расходы', 'meals'],
  ['платежи kaspi red', 'kaspiRedPayments'],
  ['приход', 'income'],
  ['продажи', 'sales'],
  ['продажи kaspi', 'kaspiSales'],
  ['профессиональные услуги', 'professionalServices'],
  ['процентный доход', 'interestIncome'],
  ['проценты', 'interest'],
  ['прочие расходы', 'otherExpenses'],
  ['прочий доход', 'otherIncome'],
  ['реклама', 'advertising'],
  ['салықтар', 'taxes'],
  ['санатсыз', 'uncategorized'],
  ['сатылымдар', 'sales'],
  ['сақтандыру', 'insurance'],
  ['страхование', 'insurance'],
  ['тамақтану және өкілдік шығыстар', 'meals'],
  ['тауар сатып алу', 'inventoryPurchases'],
  ['услуги', 'services'],
  ['іссапарлар', 'travel'],
  ['ішкі аударымдар', 'internalTransfers'],
  ['қызмет ақылары', 'servicePayments'],
  ['қызмет көрсету және жөндеу', 'maintenance'],
  ['қызметкерлердің жалақысы', 'employeeSalaries'],
  ['қызметтер', 'services'],
  ['үй кеңсесі', 'homeOffice'],
  ['өзге табыс', 'otherIncome'],
  ['өзге шығыстар', 'otherExpenses'],
]);

/** System-category slug for a stored name (any supported language), or `null` for user-defined names. */
export function resolveCategorySlug(name: string | null | undefined): string | null {
  if (!name) {
    return null;
  }
  return NAME_TO_SLUG.get(name.trim().toLowerCase()) ?? null;
}

type CategoryDictionary = Record<string, { value?: unknown } | string | undefined>;

/**
 * getIntlayer returns a path-stringifying Proxy when a dictionary is missing,
 * so only a genuine string counts as a hit — anything else must fall through
 * to the stored category name.
 */
const readValue = (node: { value?: unknown } | string | undefined): string | undefined => {
  if (typeof node === 'string') {
    return node;
  }
  const value = node?.value;
  return typeof value === 'string' ? value : undefined;
};

/**
 * getIntlayer rebuilds the dictionary on every call, and this runs once per
 * category row, so memoise per locale.
 */
const dictionaryByLocale = new Map<string, CategoryDictionary | null>();

const getCategoryDictionary = (locale: string): CategoryDictionary | null => {
  const cached = dictionaryByLocale.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  let dictionary: CategoryDictionary | null = null;
  try {
    dictionary = getIntlayer('systemCategories', locale) as CategoryDictionary;
  } catch {
    dictionary = null;
  }
  dictionaryByLocale.set(locale, dictionary);
  return dictionary;
};

const shouldLocalizeCategory = (
  category: Pick<StatementCategoryNode, 'name' | 'source' | 'isSystem'>,
) => {
  if (category.isSystem === true || category.source === 'system') {
    return true;
  }

  if (category.source === 'user' || category.source === 'parsing') {
    return false;
  }

  return NAME_TO_SLUG.has(category.name.trim().toLowerCase());
};

export const localizeStatementCategoryName = (name: string, locale: string): string => {
  const slug = NAME_TO_SLUG.get(name.trim().toLowerCase());
  if (!slug) {
    return name;
  }

  const dictionary = getCategoryDictionary(normalizeLocale(locale));
  return (dictionary ? readValue(dictionary[slug]) : undefined) ?? name;
};

export const getCategoryDisplayName = (
  category: Pick<StatementCategoryNode, 'name' | 'source' | 'isSystem'>,
  locale: string,
): string => {
  if (!shouldLocalizeCategory(category)) {
    return category.name;
  }

  return localizeStatementCategoryName(category.name, locale);
};

export const flattenStatementCategories = (
  categories: StatementCategoryNode[],
  prefix = '',
  locale = 'ru',
): StatementCategoryOption[] => {
  return categories.flatMap(category => {
    const localizedName = getCategoryDisplayName(category, locale);
    const currentName = prefix ? `${prefix} / ${localizedName}` : localizedName;
    return [
      {
        id: category.id,
        name: currentName,
        source: category.source,
        isSystem: category.isSystem,
      },
      ...(category.children
        ? flattenStatementCategories(category.children, currentName, locale)
        : []),
    ];
  });
};

export const filterStatementCategories = (
  categories: StatementCategoryNode[],
  query: string,
  locale = 'ru',
): StatementCategoryOption[] => {
  const normalizedQuery = query.trim().toLowerCase();
  const flattened = flattenStatementCategories(categories, '', locale);

  if (!normalizedQuery) {
    return flattened;
  }

  return flattened.filter(category => category.name.toLowerCase().includes(normalizedQuery));
};
