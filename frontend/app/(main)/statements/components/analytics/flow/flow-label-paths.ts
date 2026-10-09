/**
 * Labels the analytics flow (header toggles, sankey, empty month) needs on
 * every analytics page. They live once in the statementsPage dictionary under
 * `topSpenders`; each page's label builder spreads these paths into its own.
 */
export const FLOW_LABEL_PATHS: Record<string, [string[], string]> = {
  viewChart: [['topSpenders', 'viewChart'], 'Chart'],
  viewTable: [['topSpenders', 'viewTable'], 'Table'],
  viewModeLabel: [['topSpenders', 'viewModeLabel'], 'View mode'],
  flowTypeLabel: [['topSpenders', 'flowTypeLabel'], 'Spending or income'],
  flowTotalSpend: [['topSpenders', 'totalSpend'], 'Total spend'],
  flowTotalIncome: [['topSpenders', 'totalIncome'], 'Total income'],
  flowTitle: [['topSpenders', 'flowTitle'], 'Where the money goes'],
  flowIncomeTitle: [['topSpenders', 'flowIncomeTitle'], 'Where the money comes from'],
  flowSubtitle: [
    ['topSpenders', 'flowSubtitle'],
    'From categorized transactions: categories and companies',
  ],
  flowSubtitleMerchants: [
    ['topSpenders', 'flowSubtitleMerchants'],
    'From transactions: the largest companies',
  ],
  flowSubtitleCategories: [
    ['topSpenders', 'flowSubtitleCategories'],
    'From categorized transactions: categories and subcategories',
  ],
  flowUncategorised: [['topSpenders', 'flowUncategorised'], 'Uncategorised'],
  flowUnknownMerchant: [['topSpenders', 'flowUnknownMerchant'], 'Unnamed'],
  flowNoSubcategory: [['topSpenders', 'flowNoSubcategory'], 'No subcategory'],
  flowOtherMerchants: [['topSpenders', 'flowOtherMerchants'], 'Other ({{count}})'],
  flowOtherCategories: [['topSpenders', 'flowOtherCategories'], 'Other categories ({{count}})'],
  emptyMonthSpend: [['topSpenders', 'emptyMonthSpend'], 'Nothing spent in {{month}} yet'],
  emptyMonthIncome: [['topSpenders', 'emptyMonthIncome'], 'No income in {{month}} yet'],
  emptyMonthHint: [
    ['topSpenders', 'emptyMonthHint'],
    'Upload a statement or scan a receipt and this month’s picture will appear here.',
  ],
  flowError: [['topSpenders', 'flowError'], 'Could not load the chart'],
};
