import {
  Subscription,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '../../../entities/subscription.entity';
import {
  isBlank,
  nameKey,
  normalizeCurrencyCode,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

/**
 * One subscription per vendor: a known vendor gets its amount, frequency and
 * next charge date refreshed (old values kept for undo), a new one is created.
 */
export class SubscriptionsTarget implements ImportTarget {
  readonly kind = 'subscriptions' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const repo = ctx.manager.getRepository(Subscription);
    const existing = await repo.find({ where: { workspaceId: ctx.workspaceId } });
    const byVendor = new Map(existing.map(item => [nameKey(item.vendorName), item]));
    const seenInFile = new Set<string>();
    const results: RowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const vendorName = ctx.cell(row, 'vendorName').trim();
      const { value, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'amount'));
      if (!vendorName) {
        results.push({ index, status: 'error', reason: 'vendorName' });
        continue;
      }
      if (value === null || value === 0) {
        results.push({ index, status: 'error', reason: 'amount' });
        continue;
      }
      const key = nameKey(vendorName);
      if (seenInFile.has(key)) {
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      seenInFile.add(key);
      const amount = Math.abs(value);
      const frequency =
        (resolveEnumAlias(
          'frequency',
          ctx.cell(row, 'frequency'),
        ) as SubscriptionFrequency | null) ?? SubscriptionFrequency.MONTHLY;
      const nextChargeDate = parseImportDate(ctx.cell(row, 'nextChargeDate'));
      const currency =
        normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency;
      const current = byVendor.get(key);
      if (current) {
        const unchanged =
          Number(current.amount) === amount &&
          current.frequency === frequency &&
          (nextChargeDate === null ||
            (current.nextChargeDate &&
              new Date(current.nextChargeDate).toISOString().slice(0, 10) === nextChargeDate));
        if (unchanged) {
          results.push({ index, status: 'skipped', reason: 'unchanged', id: current.id });
          continue;
        }
        if (!dryRun) {
          ctx.updated.push({
            kind: 'subscription',
            id: current.id,
            before: {
              amount: Number(current.amount),
              frequency: current.frequency,
              nextChargeDate: current.nextChargeDate,
              currency: current.currency,
            },
          });
          await repo.update(current.id, {
            amount,
            frequency,
            currency,
            ...(nextChargeDate ? { nextChargeDate: new Date(nextChargeDate) } : {}),
          });
        }
        results.push({ index, status: 'updated', id: current.id });
        continue;
      }
      if (dryRun) {
        results.push({ index, status: 'created' });
        continue;
      }
      const categoryName = ctx.cell(row, 'category');
      const saved = await repo.save(
        repo.create({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          vendorName,
          amount,
          frequency,
          currency,
          nextChargeDate: nextChargeDate ? new Date(nextChargeDate) : null,
          categoryId: isBlank(categoryName) ? null : await ctx.category(categoryName, 'expense'),
          status: SubscriptionStatus.ACTIVE,
        }),
      );
      ctx.created.push({ kind: 'subscription', id: saved.id });
      results.push({ index, status: 'created', id: saved.id });
    }
    return results;
  }
}
