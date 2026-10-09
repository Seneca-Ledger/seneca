import type { EntityManager } from 'typeorm';
import { In } from 'typeorm';
import { fromMinor, toMinor } from '../../common/utils/money.util';
import { TaxRate } from '../../entities/tax-rate.entity';
import { computeTax, type TaxBreakdown } from '../tax/tax-calculation';
import type { InvoiceDocumentLine } from './invoice-document';

export interface LineTaxRate {
  rate: number;
  name: string;
  isReverseCharge: boolean;
}

export type PricedLine = TaxBreakdown & { categoryId: string | null };

/** Any line that carries money: an invoice's or a credit note's. */
export interface PricableLine {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxRateId: string | null;
  categoryId: string | null;
}

function round2(value: number): number {
  return Math.round(Number(value) * 100) / 100;
}

export async function taxRatesByLineItems(
  manager: EntityManager,
  lineItems: PricableLine[],
): Promise<Map<string, LineTaxRate>> {
  const taxRateIds = [
    ...new Set(lineItems.map(item => item.taxRateId).filter((id): id is string => !!id)),
  ];
  if (taxRateIds.length === 0) {
    return new Map();
  }
  const taxRates = await manager.getRepository(TaxRate).findBy({ id: In(taxRateIds) });
  return new Map(
    taxRates.map(rate => [
      rate.id,
      { rate: Number(rate.rate), name: rate.name, isReverseCharge: rate.isReverseCharge },
    ]),
  );
}

/**
 * Splits every line into net, tax and gross — once, for both the totals the
 * client sees and the legs the ledger books, so the two cannot drift.
 *
 * The arithmetic is `computeTax`, the same engine the rest of the system uses:
 * it is the only place that knows how to extract tax from a tax-inclusive
 * price and that a reverse-charged supply carries none.
 */
export async function priceLines(
  manager: EntityManager,
  lineItems: PricableLine[],
  pricesIncludeTax: boolean,
): Promise<PricedLine[]> {
  const rateById = await taxRatesByLineItems(manager, lineItems);
  return lineItems.map(item => {
    const amountMinor = toMinor(round2(Number(item.quantity) * Number(item.unitPrice)));
    const rate = item.taxRateId ? rateById.get(item.taxRateId) : undefined;
    const breakdown = computeTax({
      amountMinor,
      rate: rate?.rate ?? 0,
      // With no tax rate on the line there is nothing to extract, whatever
      // the invoice says about its prices.
      isInclusive: Boolean(rate) && pricesIncludeTax,
      isReverseCharge: rate?.isReverseCharge ?? false,
    });
    return { ...breakdown, categoryId: item.categoryId };
  });
}

/** Every figure the document prints for a line, including its tax rate. */
export async function documentLines(
  manager: EntityManager,
  lineItems: PricableLine[],
  pricesIncludeTax: boolean,
): Promise<InvoiceDocumentLine[]> {
  const rateById = await taxRatesByLineItems(manager, lineItems);
  const priced = await priceLines(manager, lineItems, pricesIncludeTax);
  return lineItems.map((item, index) => {
    const rate = item.taxRateId ? rateById.get(item.taxRateId) : undefined;
    const line = priced[index];
    return {
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRatePercent: rate ? rate.rate : null,
      taxRateName: rate?.name ?? null,
      isReverseCharge: rate?.isReverseCharge ?? false,
      netAmount: fromMinor(line.netMinor),
      taxAmount: fromMinor(line.taxMinor),
      grossAmount: fromMinor(line.grossMinor),
    };
  });
}

/** What the lines add up to: net, tax and gross, in major units. */
export function totalsOf(priced: PricedLine[]): {
  subtotal: number;
  taxTotal: number;
  total: number;
} {
  const sums = priced.reduce(
    (acc, line) => ({
      netMinor: acc.netMinor + line.netMinor,
      taxMinor: acc.taxMinor + line.taxMinor,
      grossMinor: acc.grossMinor + line.grossMinor,
    }),
    { netMinor: 0, taxMinor: 0, grossMinor: 0 },
  );
  return {
    subtotal: fromMinor(sums.netMinor),
    taxTotal: fromMinor(sums.taxMinor),
    total: fromMinor(sums.grossMinor),
  };
}
