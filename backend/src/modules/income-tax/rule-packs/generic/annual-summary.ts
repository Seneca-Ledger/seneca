import type { PackInput, PackResult, RulePack } from '../types';
import { sumItems } from '../types';

/**
 * Annual income and expense summary, for every country and taxpayer type that
 * has no verified form yet.
 *
 * It deliberately knows nothing about any form: no line numbers, no limits, no
 * tariff. What it offers is the year's figures in the declaration currency,
 * which is what the user needs in front of them when filling in whatever form
 * their country uses.
 */

const INCOME_CATEGORIES = ['Sales', 'Services', 'Interest income', 'Other income'];
const EXPENSE_CATEGORIES = [
  'Advertising',
  'Benefits and compensation',
  'Vehicle expenses',
  'Equipment',
  'Fees and charges',
  'Home office',
  'Insurance',
  'Interest',
  'Payroll',
  'Maintenance and repairs',
  'Materials',
  'Meals and entertainment',
  'Office supplies',
  'Other expenses',
  'Professional services',
  'Rent',
  'Taxes',
  'Travel',
  'Utilities',
];

function compute(input: PackInput): PackResult {
  const incomeMinor = sumItems(input.items.income);
  const expenseMinor = sumItems(input.items.expense);

  const figure = (
    key: string,
    label: string,
    section: 'income' | 'expense' | 'result',
    amountMinor: number,
  ) => ({
    key,
    lineNo: null,
    fieldNo: null,
    label,
    section,
    amountMinor,
    deductibleMinor: amountMinor,
  });

  return {
    figures: [
      figure('income', 'Income', 'income', incomeMinor),
      figure('expense', 'Expenses', 'expense', expenseMinor),
      figure('result', 'Income minus expenses', 'result', incomeMinor - expenseMinor),
    ],
    warnings: [],
    taxEstimate: null,
  };
}

export const genericSummaryPack: RulePack = {
  formKey: 'generic-annual-summary',
  name: 'Annual income and expense summary',
  countryCode: null,
  taxpayerTypes: ['self_employed', 'employee', 'company'],
  taxYears: [],
  formEditionYear: null,
  filingChannel: null,
  lines: [
    {
      key: 'income',
      section: 'income',
      lineNo: null,
      fieldNo: null,
      label: 'Income',
      suggestedFor: INCOME_CATEGORIES,
    },
    {
      key: 'expense',
      section: 'expense',
      lineNo: null,
      fieldNo: null,
      label: 'Expenses',
      suggestedFor: EXPENSE_CATEGORIES,
    },
    {
      key: 'excluded',
      section: 'excluded',
      lineNo: null,
      fieldNo: null,
      label: 'Not included (private or unrelated)',
      suggestedFor: [],
    },
  ],
  compute,
};
