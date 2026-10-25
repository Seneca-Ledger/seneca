/**
 * Labels the analytics flow (header toggles, sankey, empty month) needs on
 * every analytics page. They live once in the statementsPage dictionary under
 * `topSpenders`; each page's label builder spreads these paths into its own.
 */
export const FLOW_LABEL_PATHS: Record<string, string[]> = {
  viewChart: ['topSpenders', 'viewChart'],
  viewTable: ['topSpenders', 'viewTable'],
  viewModeLabel: ['topSpenders', 'viewModeLabel'],
  flowTypeLabel: ['topSpenders', 'flowTypeLabel'],
  flowTotalSpend: ['topSpenders', 'totalSpend'],
  flowTotalIncome: ['topSpenders', 'totalIncome'],
  flowTitle: ['topSpenders', 'flowTitle'],
  flowIncomeTitle: ['topSpenders', 'flowIncomeTitle'],
  flowSubtitle: ['topSpenders', 'flowSubtitle'],
  flowSubtitleMerchants: ['topSpenders', 'flowSubtitleMerchants'],
  flowSubtitleCategories: ['topSpenders', 'flowSubtitleCategories'],
  flowUncategorised: ['topSpenders', 'flowUncategorised'],
  flowUnknownMerchant: ['topSpenders', 'flowUnknownMerchant'],
  flowNoSubcategory: ['topSpenders', 'flowNoSubcategory'],
  flowOtherMerchants: ['topSpenders', 'flowOtherMerchants'],
  flowOtherCategories: ['topSpenders', 'flowOtherCategories'],
  emptyMonthSpend: ['topSpenders', 'emptyMonthSpend'],
  emptyMonthIncome: ['topSpenders', 'emptyMonthIncome'],
  emptyMonthHint: ['topSpenders', 'emptyMonthHint'],
  flowError: ['topSpenders', 'flowError'],
};
