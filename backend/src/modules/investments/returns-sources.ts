import type { ReturnsFlag, ReturnsFlagCode, ReturnsSource } from '../../contracts';
import { InvestmentPriceSource } from '../../entities/investment-holding.entity';
import { isoDate, shiftDays } from '../balance/snapshot-series';
import type { CryptoHoldingsService } from '../crypto/crypto-holdings.service';
import type { ValuedInvestmentFlow } from './investment-flows.service';
import type { MetalsService } from './metals.service';

/** A line of the balance sheet with a value history and dated flows behind it. */
export interface TrackedSource {
  kind: 'account' | 'metals';
  id: string;
  name: string;
  accountId: string | null;
  liveValue: number;
  flows: Array<Pick<ValuedInvestmentFlow, 'date' | 'value' | 'kind'>>;
  /** Flags that keep the source out of the return. */
  blockers: ReturnsFlagCode[];
  /** Flags worth saying that leave the figures standing. */
  notes: ReturnsFlagCode[];
}

type MetalsSummary = Awaited<ReturnType<MetalsService['getSummary']>>;
type CryptoHoldings = Awaited<ReturnType<CryptoHoldingsService['getHoldings']>>;

/** An automatic quote older than this is stale: the free sources quote daily. */
const STALE_AUTO_PRICE_DAYS = 3;
/** A price typed in by hand is worth a reminder once it is a month old. */
const STALE_MANUAL_PRICE_DAYS = 30;

/**
 * The metals line. A lot's cost went in on the day it was bought, and so
 * did the cost of every piece since sold; a sale's proceeds came out.
 */
export function metalsSource(
  metals: MetalsSummary,
  today: string,
  flags: ReturnsFlag[],
): TrackedSource | null {
  if (metals.lots.length === 0 && metals.sales.length === 0) {
    return null;
  }
  const id = metals.accountId ?? 'metals';
  const metalFlows: TrackedSource['flows'] = [];
  const missingCost: string[] = [];
  for (const lot of metals.lots) {
    if (lot.cost === null || !lot.acquiredOn) {
      missingCost.push(lot.name);
    } else {
      metalFlows.push({ date: lot.acquiredOn, value: lot.cost, kind: 'contribution' });
    }
  }
  for (const sale of metals.sales) {
    // The pieces sold were bought once too: their cost went in when they did.
    if (sale.costBasis === null || !sale.acquiredOn) {
      missingCost.push(sale.lotName);
    } else {
      metalFlows.push({ date: sale.acquiredOn, value: sale.costBasis, kind: 'contribution' });
    }
    metalFlows.push({ date: sale.soldOn, value: sale.proceeds, kind: 'withdrawal' });
  }
  const blockers: ReturnsFlagCode[] = [];
  if (missingCost.length > 0) {
    blockers.push('metal_cost_missing');
    flags.push({
      code: 'metal_cost_missing',
      sourceId: id,
      detail: [...new Set(missingCost)].join(', '),
    });
  }
  return {
    kind: 'metals',
    id,
    name: 'metals',
    accountId: metals.accountId,
    liveValue: metals.value,
    flows: metalFlows,
    blockers,
    notes: priceNotes(metals.lots, id, today, flags),
  };
}

/**
 * The crypto line, measured over its whole history and kept out of the
 * return: staking rewards, airdrops and coins from wallets Seneca does not
 * see arrive as purchases, so the dated flows a period return needs are not
 * trustworthy, while the cost basis of what is held still is.
 */
export function cryptoSource({
  holdings,
  unpriced,
}: CryptoHoldings): { row: ReturnsSource; flags: ReturnsFlag[] } | null {
  if (holdings.length === 0 && unpriced.length === 0) {
    return null;
  }

  const value = round2(holdings.reduce((sum, holding) => sum + holding.value, 0));
  const costHeld = holdings.reduce((sum, holding) => sum + (holding.cost ?? 0), 0);
  const realized = holdings.reduce((sum, holding) => sum + holding.realized, 0);
  const netInvested = round2(costHeld - realized);

  const codes: ReturnsFlagCode[] = ['crypto_not_in_return'];
  if (holdings.some(holding => holding.basisIncomplete || holding.cost === null)) {
    codes.push('crypto_basis_incomplete');
  }
  if (unpriced.length > 0) {
    codes.push('crypto_unpriced');
  }

  return {
    row: {
      kind: 'crypto',
      id: 'crypto',
      name: 'crypto',
      scope: 'all_time',
      startValue: 0,
      endValue: value,
      contributions: netInvested,
      withdrawals: 0,
      income: 0,
      gain: round2(value - netInvested),
      returnPercent: null,
      includedInReturn: false,
      flags: codes,
    },
    flags: codes.map(code =>
      code === 'crypto_unpriced'
        ? { code, sourceId: 'crypto', detail: unpriced.map(entry => entry.asset).join(', ') }
        : { code, sourceId: 'crypto' },
    ),
  };
}

/** Prices the figures stand on that may no longer be true. */
export function priceNotes(
  holdings: ReadonlyArray<{
    name: string;
    priceSource: `${InvestmentPriceSource}`;
    pricedAt: Date | string | null;
  }>,
  sourceId: string,
  today: string,
  flags: ReturnsFlag[],
): ReturnsFlagCode[] {
  const codes = new Set<ReturnsFlagCode>();
  for (const holding of holdings) {
    const priced = holding.pricedAt ? isoDate(new Date(holding.pricedAt)) : null;
    const auto = holding.priceSource === InvestmentPriceSource.AUTO;
    const limit = shiftDays(today, -(auto ? STALE_AUTO_PRICE_DAYS : STALE_MANUAL_PRICE_DAYS));
    if (priced && priced >= limit) {
      continue;
    }
    const code = auto ? 'stale_price' : 'manual_price';
    codes.add(code);
    flags.push({ code, sourceId, detail: holding.name });
  }
  return [...codes];
}

export function dedupe(flags: ReturnsFlag[]): ReturnsFlag[] {
  const seen = new Set<string>();
  return flags.filter(flag => {
    const key = `${flag.code}|${flag.sourceId ?? ''}|${flag.detail ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
