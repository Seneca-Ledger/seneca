import { CategoryType } from '../../entities/category.entity';

/**
 * The default categories every workspace gets. `key` is the stable identity
 * code looks a system category up by: the stored name is English but may have
 * been renamed by older migrations (to Russian in 1763400000000) or by nothing
 * the code controls, so a name is not a key.
 *
 * Seeded in English; clients resolve the display name through the
 * systemCategories dictionary, keyed on the stored name.
 */
export type SystemCategoryKey =
  | 'sales'
  | 'services'
  | 'interest_income'
  | 'other_income'
  | 'salary'
  | 'advertising'
  | 'benefits'
  | 'vehicle'
  | 'equipment'
  | 'fees'
  | 'home_office'
  | 'insurance'
  | 'interest'
  | 'payroll'
  | 'maintenance'
  | 'materials'
  | 'meals'
  | 'office_supplies'
  | 'other_expenses'
  | 'professional_services'
  | 'rent'
  | 'taxes'
  | 'travel'
  | 'utilities'
  | 'transfers_people'
  | 'cash'
  | 'groceries'
  | 'dining'
  | 'transport'
  | 'fuel'
  | 'phone_internet'
  | 'subscriptions'
  | 'shopping'
  | 'health';

export type SystemCategory = {
  key: SystemCategoryKey;
  name: string;
  type: CategoryType;
  /** Names the same category was stored under before (older seeds, migrations). */
  aliases?: readonly string[];
};

const { INCOME, EXPENSE } = CategoryType;

export const DEFAULT_SYSTEM_CATEGORIES: readonly SystemCategory[] = [
  { key: 'sales', name: 'Sales', type: INCOME, aliases: ['Продажи'] },
  { key: 'services', name: 'Services', type: INCOME, aliases: ['Услуги'] },
  {
    key: 'interest_income',
    name: 'Interest income',
    type: INCOME,
    aliases: ['Процентный доход'],
  },
  { key: 'other_income', name: 'Other income', type: INCOME, aliases: ['Прочий доход'] },
  { key: 'salary', name: 'Salary', type: INCOME },
  { key: 'advertising', name: 'Advertising', type: EXPENSE, aliases: ['Реклама'] },
  {
    key: 'benefits',
    name: 'Benefits and compensation',
    type: EXPENSE,
    aliases: ['Benefits', 'Льготы и компенсации'],
  },
  {
    key: 'vehicle',
    name: 'Vehicle expenses',
    type: EXPENSE,
    aliases: ['Car', 'Автомобильные расходы'],
  },
  { key: 'equipment', name: 'Equipment', type: EXPENSE, aliases: ['Оборудование'] },
  {
    key: 'fees',
    name: 'Fees and charges',
    type: EXPENSE,
    aliases: ['Fees', 'Комиссии и сборы'],
  },
  { key: 'home_office', name: 'Home office', type: EXPENSE, aliases: ['Домашний офис'] },
  { key: 'insurance', name: 'Insurance', type: EXPENSE, aliases: ['Страхование'] },
  { key: 'interest', name: 'Interest', type: EXPENSE, aliases: ['Проценты'] },
  { key: 'payroll', name: 'Payroll', type: EXPENSE, aliases: ['Labor', 'Оплата труда'] },
  {
    key: 'maintenance',
    name: 'Maintenance and repairs',
    type: EXPENSE,
    aliases: ['Maintenance', 'Обслуживание и ремонт'],
  },
  { key: 'materials', name: 'Materials', type: EXPENSE, aliases: ['Материалы'] },
  {
    key: 'meals',
    name: 'Meals and entertainment',
    type: EXPENSE,
    aliases: ['Питание и представительские расходы'],
  },
  {
    key: 'office_supplies',
    name: 'Office supplies',
    type: EXPENSE,
    aliases: ['Канцелярские товары'],
  },
  {
    key: 'other_expenses',
    name: 'Other expenses',
    type: EXPENSE,
    aliases: ['Other', 'Прочие расходы'],
  },
  {
    key: 'professional_services',
    name: 'Professional services',
    type: EXPENSE,
    aliases: ['Профессиональные услуги'],
  },
  { key: 'rent', name: 'Rent', type: EXPENSE, aliases: ['Аренда'] },
  { key: 'taxes', name: 'Taxes', type: EXPENSE, aliases: ['Налоги'] },
  { key: 'travel', name: 'Travel', type: EXPENSE, aliases: ['Командировки'] },
  { key: 'utilities', name: 'Utilities', type: EXPENSE, aliases: ['Коммунальные услуги'] },
  // What a suggestion can name (classification/suggestions): the kind of an
  // operation and the usual targets of a known brand.
  { key: 'transfers_people', name: 'Transfers to people', type: EXPENSE },
  { key: 'cash', name: 'Cash withdrawals', type: EXPENSE },
  { key: 'groceries', name: 'Groceries', type: EXPENSE },
  { key: 'dining', name: 'Dining out', type: EXPENSE },
  { key: 'transport', name: 'Transport', type: EXPENSE },
  { key: 'fuel', name: 'Fuel', type: EXPENSE },
  { key: 'phone_internet', name: 'Phone and internet', type: EXPENSE },
  { key: 'subscriptions', name: 'Subscriptions', type: EXPENSE },
  { key: 'shopping', name: 'Shopping', type: EXPENSE },
  { key: 'health', name: 'Health', type: EXPENSE },
];
