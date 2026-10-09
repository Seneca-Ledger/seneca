import { BudgetPeriodType } from '../../../entities/budget.entity';
import { CustomTableColumnType } from '../../../entities/custom-table-column.entity';
import type { BudgetsService } from '../../budgets/budgets.service';
import type { SourceAdapter, SourceColumnDef, SourceFilters, SourceRow } from './source.types';
import { option, toDateOnly, toNumber } from './source.utils';

/** Reuses BudgetsService so "spent" matches the Budgets page, not a second formula. */
export class BudgetsSource implements SourceAdapter {
  readonly kind = 'budgets' as const;

  readonly columns: SourceColumnDef[] = [
    { field: 'name', title: 'Budget', type: CustomTableColumnType.TEXT },
    { field: 'category', title: 'Category', type: CustomTableColumnType.TEXT },
    { field: 'limit', title: 'Limit', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'spent', title: 'Spent', type: CustomTableColumnType.CURRENCY, money: true },
    { field: 'remaining', title: 'Remaining', type: CustomTableColumnType.CURRENCY, money: true },
    {
      field: 'percentUsed',
      title: 'Used %',
      type: CustomTableColumnType.NUMBER,
      config: { format: 'plain', precision: 0 },
    },
    {
      field: 'periodType',
      title: 'Period',
      type: CustomTableColumnType.SELECT,
      config: {
        options: [
          option(BudgetPeriodType.WEEKLY, 'blue'),
          option(BudgetPeriodType.MONTHLY, 'teal'),
          option(BudgetPeriodType.QUARTERLY, 'violet'),
          option(BudgetPeriodType.ANNUAL, 'amber'),
        ],
      },
    },
    { field: 'periodStart', title: 'Period start', type: CustomTableColumnType.DATE },
    { field: 'currency', title: 'Currency', type: CustomTableColumnType.TEXT },
  ];

  constructor(private readonly budgetsService: BudgetsService) {}

  async fetchRows(workspaceId: string, filters: SourceFilters = {}): Promise<SourceRow[]> {
    const all = await this.budgetsService.findAll(workspaceId);
    const wanted = filters.ids?.length ? new Set(filters.ids) : null;
    const budgets = wanted ? all.filter(budget => wanted.has(budget.id)) : all;
    return budgets.map(budget => {
      const limit = toNumber(budget.limitAmount) ?? 0;
      const spent = toNumber(budget.spentAmount) ?? 0;
      return {
        sourceKey: budget.id,
        values: {
          name: budget.name,
          category: budget.category?.name ?? '',
          limit,
          spent,
          remaining: Math.round((limit - spent) * 100) / 100,
          percentUsed: limit > 0 ? Math.round((spent / limit) * 100) : 0,
          periodType: budget.periodType,
          periodStart: toDateOnly(budget.currentPeriodStart),
          currency: budget.currency || '',
        },
      };
    });
  }
}
