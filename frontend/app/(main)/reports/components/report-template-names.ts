/**
 * The label key that names each template.
 *
 * History rows store the name the server used when the file was produced, which
 * is English. The reader should see the template in their own language, so the
 * row is labelled by its id and the stored name is only a fallback for a
 * template that no longer exists.
 */
export const TEMPLATE_NAME_KEYS: Record<string, string> = {
  pnl: 'templatePnlName',
  'balance-sheet': 'templateBalanceName',
  'cash-flow': 'templateCashFlowName',
  'expense-by-category': 'templateExpenseByCategoryName',
  'transaction-register': 'templateTransactionRegisterName',
  'monthly-summary': 'templateMonthlySummaryName',
  'category-by-month': 'templateCategoryByMonthName',
  'budget-vs-actual': 'templateBudgetVsActualName',
  'investment-holdings': 'templateInvestmentHoldingsName',
};
