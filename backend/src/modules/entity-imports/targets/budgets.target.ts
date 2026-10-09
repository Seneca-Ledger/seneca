import { IsNull } from 'typeorm';
import { Budget, BudgetPeriodType } from '../../../entities/budget.entity';
import { computePeriodRange } from '../../budgets/budget-period.util';
import { normalizeCurrencyCode, parseImportNumber } from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

/**
 * One budget per category and period (goal-less). An existing one gets its
 * limit replaced, keeping the old limit for undo; a new category is created.
 */
export class BudgetsTarget implements ImportTarget {
  readonly kind = 'budgets' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const repo = ctx.manager.getRepository(Budget);
    const existing = await repo.find({ where: { workspaceId: ctx.workspaceId, goalId: IsNull() } });
    const byKey = new Map(existing.map(item => [`${item.categoryId}|${item.periodType}`, item]));
    const seenInFile = new Set<string>();
    const results: RowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const categoryName = ctx.cell(row, 'category').trim();
      const { value, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'limit'));
      if (!categoryName) {
        results.push({ index, status: 'error', reason: 'category' });
        continue;
      }
      if (value === null || value <= 0) {
        results.push({ index, status: 'error', reason: 'limit' });
        continue;
      }
      const periodType =
        (resolveEnumAlias('frequency', ctx.cell(row, 'periodType')) as BudgetPeriodType | null) ??
        BudgetPeriodType.MONTHLY;
      const fileKey = `${categoryName.toLowerCase()}|${periodType}`;
      if (seenInFile.has(fileKey)) {
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      seenInFile.add(fileKey);
      if (dryRun) {
        // Category lookup is read-only in a dry run; new categories count as created.
        results.push({ index, status: 'created' });
        continue;
      }
      const categoryId = await ctx.category(categoryName, 'expense');
      if (!categoryId) {
        results.push({ index, status: 'error', reason: 'category' });
        continue;
      }
      const current = byKey.get(`${categoryId}|${periodType}`);
      if (current) {
        if (Number(current.limitAmount) === value) {
          results.push({ index, status: 'skipped', reason: 'unchanged', id: current.id });
          continue;
        }
        ctx.updated.push({
          kind: 'budget',
          id: current.id,
          before: { limitAmount: Number(current.limitAmount), currency: current.currency },
        });
        await repo.update(current.id, { limitAmount: value });
        results.push({ index, status: 'updated', id: current.id });
        continue;
      }
      const { start } = computePeriodRange(periodType, new Date());
      const saved = await repo.save(
        repo.create({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          name: ctx.cell(row, 'name').trim() || categoryName,
          categoryId,
          limitAmount: value,
          currency:
            normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency,
          periodType,
          currentPeriodStart: start,
          goalId: null,
        }),
      );
      byKey.set(`${categoryId}|${periodType}`, saved);
      ctx.created.push({ kind: 'budget', id: saved.id });
      results.push({ index, status: 'created', id: saved.id });
    }
    return results;
  }
}
