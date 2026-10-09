import {
  Payable,
  PayableDirection,
  PayableSource,
  PayableStatus,
} from '../../../entities/payable.entity';
import {
  nameKey,
  normalizeCurrencyCode,
  parseImportBoolean,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

/** Same vendor, amount and due date already present → skipped, never duplicated. */
export class PayablesTarget implements ImportTarget {
  readonly kind = 'payables' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const repo = ctx.manager.getRepository(Payable);
    const existing = await repo.find({
      where: { workspaceId: ctx.workspaceId },
      select: ['vendor', 'amount', 'dueDate'],
      withDeleted: false,
    });
    const seen = new Set(
      existing.map(item => this.key(item.vendor, Number(item.amount), item.dueDate)),
    );
    const results: RowResult[] = [];
    for (const [index, row] of rows.entries()) {
      const vendor = ctx.cell(row, 'vendor').trim();
      const { value, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'amount'));
      if (!vendor) {
        results.push({ index, status: 'error', reason: 'vendor' });
        continue;
      }
      if (value === null || value === 0) {
        results.push({ index, status: 'error', reason: 'amount' });
        continue;
      }
      const dueDate = parseImportDate(ctx.cell(row, 'dueDate'));
      const amount = Math.abs(value);
      const key = this.key(vendor, amount, dueDate);
      if (seen.has(key)) {
        results.push({ index, status: 'skipped', reason: 'duplicate' });
        continue;
      }
      seen.add(key);
      if (dryRun) {
        results.push({ index, status: 'created' });
        continue;
      }
      const status =
        (resolveEnumAlias('status', ctx.cell(row, 'status')) as PayableStatus | null) ??
        PayableStatus.TO_PAY;
      const direction =
        (resolveEnumAlias('direction', ctx.cell(row, 'direction')) as PayableDirection | null) ??
        (value < 0 ? PayableDirection.PAYABLE : PayableDirection.PAYABLE);
      const saved = await repo.save(
        repo.create({
          workspaceId: ctx.workspaceId,
          createdById: ctx.userId,
          vendor,
          amount,
          currency:
            normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency,
          dueDate: dueDate ? new Date(dueDate) : null,
          status,
          direction,
          source: PayableSource.MANUAL,
          isRecurring: parseImportBoolean(ctx.cell(row, 'isRecurring')) ?? false,
          comment: ctx.cell(row, 'comment').trim() || null,
          paidAt: status === PayableStatus.PAID ? new Date() : null,
        }),
      );
      ctx.created.push({ kind: 'payable', id: saved.id });
      results.push({ index, status: 'created', id: saved.id });
    }
    return results;
  }

  private key(vendor: string, amount: number, dueDate: Date | string | null): string {
    const day = dueDate ? new Date(dueDate).toISOString().slice(0, 10) : '';
    return `${nameKey(vendor)}|${amount.toFixed(2)}|${day}`;
  }
}
