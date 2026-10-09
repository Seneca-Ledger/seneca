import { BalanceAccount, BalanceAccountKind } from '../../../entities/balance-account.entity';
import {
  InvestmentAssetClass,
  InvestmentHolding,
  InvestmentMetal,
  InvestmentPriceSource,
  MetalWeightUnit,
} from '../../../entities/investment-holding.entity';
import {
  normalizeCurrencyCode,
  parseImportDate,
  parseImportNumber,
} from '../helpers/import-values';
import { resolveEnumAlias } from '../target-aliases';
import type { ImportContext, ImportTarget, RowResult } from './target.types';

/**
 * A stacker's spreadsheet: one row per lot. Weight and fineness stay apart, so
 * ten gross ounces of 22 carat gold import as ten gross ounces of 22 carat
 * gold and are valued on their fine weight like every other lot.
 *
 * Prices are not fetched here. Rows land with no price and the import service
 * quotes them once, after the transaction commits.
 */
export class MetalsTarget implements ImportTarget {
  readonly kind = 'metals' as const;

  async run(rows: string[][], ctx: ImportContext, dryRun: boolean): Promise<RowResult[]> {
    const repo = ctx.manager.getRepository(InvestmentHolding);
    const account = await ctx.manager.getRepository(BalanceAccount).findOne({
      where: { workspaceId: ctx.workspaceId, accountKind: BalanceAccountKind.METALS },
      select: ['id'],
    });
    const results: RowResult[] = [];

    for (const [index, row] of rows.entries()) {
      const metal = resolveEnumAlias('metal', ctx.cell(row, 'metal')) as InvestmentMetal | null;
      if (!metal) {
        results.push({ index, status: 'error', reason: 'metal' });
        continue;
      }
      const { value: unitWeight } = parseImportNumber(ctx.cell(row, 'unitWeight'));
      if (unitWeight === null || unitWeight <= 0) {
        results.push({ index, status: 'error', reason: 'unitWeight' });
        continue;
      }
      const { value: pieces } = parseImportNumber(ctx.cell(row, 'quantity'));
      const quantity = pieces === null || pieces <= 0 ? 1 : pieces;
      const weightUnit =
        (resolveEnumAlias('weightUnit', ctx.cell(row, 'weightUnit')) as MetalWeightUnit | null) ??
        MetalWeightUnit.TROY_OUNCE;
      const purity = parsePurity(ctx.cell(row, 'purity'));
      if (purity === null) {
        results.push({ index, status: 'error', reason: 'purity' });
        continue;
      }
      const { value: cost, currency: cellCurrency } = parseImportNumber(ctx.cell(row, 'cost'));

      if (dryRun || !account) {
        // Without an account there is nowhere to put the lot; the service
        // creates one before a real run, so this only guards the dry run.
        results.push({ index, status: 'created' });
        continue;
      }

      const saved = await repo.save(
        repo.create({
          workspaceId: ctx.workspaceId,
          accountId: account.id,
          symbol: null,
          name:
            ctx.cell(row, 'name').trim() || `${quantity} × ${unitWeight} ${weightUnit} ${metal}`,
          assetClass: InvestmentAssetClass.METAL,
          metal,
          quantity,
          unitWeight,
          weightUnit,
          purity,
          acquiredOn: parseImportDate(ctx.cell(row, 'acquiredOn')),
          costTotal: cost !== null && cost > 0 ? cost : null,
          costCurrency:
            cost !== null && cost > 0
              ? (normalizeCurrencyCode(ctx.cell(row, 'currency')) ?? cellCurrency ?? ctx.currency)
              : null,
          counterparty: ctx.cell(row, 'counterparty').trim() || null,
          price: 0,
          priceCurrency: ctx.currency,
          priceSource: InvestmentPriceSource.AUTO,
          pricedAt: null,
        }),
      );
      ctx.created.push({ kind: 'metal_lot', id: saved.id });
      results.push({ index, status: 'created', id: saved.id });
    }
    return results;
  }
}

/**
 * Fineness as a fraction. Spreadsheets write it both ways — 0.999 and 999 —
 * and 999 taken literally would value a lot a thousand times over, so the
 * millesimal form is converted rather than rejected. Anything else is an error.
 */
function parsePurity(raw: string): number | null {
  const { value } = parseImportNumber(raw);
  if (value === null) return 1;
  if (value > 0 && value <= 1) return value;
  if (value > 1 && value <= 1000) return value / 1000;
  return null;
}
