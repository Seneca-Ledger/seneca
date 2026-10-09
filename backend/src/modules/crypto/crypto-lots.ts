/**
 * Cost basis, FIFO.
 *
 * What a coin cost is not a property of the coin, it is a property of the lots it
 * was bought in: 1 ETH bought at 1 000 and 1 ETH bought at 3 000 are two lots, and
 * selling one of them realises a gain against the older one first. Everything here
 * is a pure function of the events, so the rule can be read and tested on its own.
 *
 * Two honest limits are built in. A disposal with no purchase behind it — coins
 * that arrived before the wallet was connected, or beyond the history the explorer
 * returns — realises nothing rather than inventing a gain from a zero cost; the
 * asset is marked `incomplete` so the page can say the basis is partial. And the
 * quantity tracked here is the quantity the events describe, which the caller
 * compares against the balance the chain actually reports.
 */

export interface LotEvent {
  asset: string;
  /** ISO date; events are sorted by it before anything else happens. */
  date: string;
  direction: 'in' | 'out';
  /** Coin amount, positive. */
  amount: number;
  /** What it was worth in the workspace currency at the time. */
  value: number;
  /**
   * Whose wallet it happened in. Only `disposalsByOwner` reads it: the
   * portfolio is the workspace's, but a tax return is a person's.
   */
  owner?: string | null;
}

/**
 * One sale, matched against the purchases it consumed. `heldDays` is stated and
 * not judged: how long a coin must be held before a gain is taxed differently is
 * a question for the user's own tax authority, not for this file.
 */
export interface Disposal {
  /**
   * Identity of the sale within the report. Two sales of the same coin, the same
   * size, on the same day are ordinary — a fee paid twice in a day, for one — so
   * the sequence is what tells them apart.
   */
  id: string;
  asset: string;
  /** When it was sold. */
  date: string;
  /** Coins sold, as far as a purchase backs them. */
  amount: number;
  /** What they fetched. */
  proceeds: number;
  /** What those particular coins had cost. */
  cost: number;
  /** Proceeds minus cost. */
  gain: number;
  /** When the oldest consumed purchase was made; null when none did. */
  acquiredOn: string | null;
  /** Days between that purchase and this sale; null without a purchase. */
  heldDays: number | null;
  /**
   * Coins in this sale that no purchase backs — they arrived before the wallet
   * was connected, or beyond the history the explorer returns.
   */
  uncoveredAmount: number;
  /** What those unbacked coins fetched; a figure with no cost to set against. */
  uncoveredProceeds: number;
  /**
   * True when any part of the sale is unbacked. Such a row is not a finished
   * number: a tax return must not quietly treat the missing cost as zero.
   */
  costIncomplete: boolean;
}

export interface AssetBasis {
  asset: string;
  /** Coins still held according to the events. */
  quantity: number;
  /** What those coins cost. */
  cost: number;
  /** Cost per coin, or null when nothing is held. */
  avgCost: number | null;
  /** Gains and losses already taken, over every disposal in the events. */
  realized: number;
  /** True when a disposal had no purchase behind it: the basis is partial. */
  incomplete: boolean;
}

interface Lot {
  quantity: number;
  unitCost: number;
  date: string;
}

export interface BasisResult {
  byAsset: Map<string, AssetBasis>;
  /** Every sale in the events, oldest first. */
  disposals: Disposal[];
}

export function computeBasis(events: LotEvent[]): Map<string, AssetBasis> {
  return computeBasisWithDisposals(events).byAsset;
}

/**
 * The same first-in-first-out rule, run once per owner.
 *
 * A workspace's portfolio is one pile; a tax return is not. Two members each
 * holding ETH have each their own purchases, and matching one member's sale
 * against another's purchase would put a stranger's cost on a person's return.
 * Events nobody owns are grouped under `null`, which is as far as the data goes.
 */
export function disposalsByOwner(events: LotEvent[]): Map<string | null, Disposal[]> {
  const byOwner = new Map<string | null, LotEvent[]>();
  for (const event of events) {
    const owner = event.owner ?? null;
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), event]);
  }
  const result = new Map<string | null, Disposal[]>();
  for (const [owner, ownEvents] of byOwner) {
    result.set(owner, computeBasisWithDisposals(ownEvents).disposals);
  }
  return result;
}

export function computeBasisWithDisposals(events: LotEvent[]): BasisResult {
  const byAsset = new Map<string, LotEvent[]>();
  for (const event of events) {
    if (!(event.amount > 0)) {
      continue;
    }
    byAsset.set(event.asset, [...(byAsset.get(event.asset) ?? []), event]);
  }

  const result = new Map<string, AssetBasis>();
  const disposals: Disposal[] = [];
  for (const [asset, assetEvents] of byAsset) {
    const ordered = [...assetEvents].sort((a, b) => a.date.localeCompare(b.date));
    const lots: Lot[] = [];
    let realized = 0;
    let incomplete = false;
    let sequence = 0;

    for (const event of ordered) {
      if (event.direction === 'in') {
        lots.push({
          quantity: event.amount,
          unitCost: event.value / event.amount,
          date: event.date,
        });
        continue;
      }

      let left = event.amount;
      const proceedsPerUnit = event.value / event.amount;
      let matched = 0;
      let cost = 0;
      let oldest: string | null = null;
      while (left > 0 && lots.length > 0) {
        const lot = lots[0];
        const taken = Math.min(lot.quantity, left);
        realized += taken * (proceedsPerUnit - lot.unitCost);
        matched += taken;
        cost += taken * lot.unitCost;
        oldest = oldest ?? lot.date;
        lot.quantity -= taken;
        left -= taken;
        if (lot.quantity <= 1e-18) {
          lots.shift();
        }
      }
      // Sold more than we ever saw bought: the rest has no basis to measure against.
      const uncovered = left > 1e-18 ? left : 0;
      if (uncovered > 0) {
        incomplete = true;
      }
      // A sale is reported even when nothing backs it. Dropping it would hide
      // the one row a person most needs to look at before filing.
      if (matched > 1e-18 || uncovered > 0) {
        const proceeds = matched * proceedsPerUnit;
        sequence += 1;
        disposals.push({
          id: `${asset}-${event.date}-${sequence}`,
          asset,
          date: event.date,
          amount: round(matched, 18),
          proceeds: round(proceeds, 2),
          cost: round(cost, 2),
          gain: round(proceeds - cost, 2),
          acquiredOn: oldest,
          heldDays: oldest ? daysBetween(oldest, event.date) : null,
          uncoveredAmount: round(uncovered, 18),
          uncoveredProceeds: round(uncovered * proceedsPerUnit, 2),
          costIncomplete: uncovered > 0,
        });
      }
    }

    const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const cost = lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0);
    result.set(asset, {
      asset,
      quantity: round(quantity, 18),
      cost: round(cost, 2),
      avgCost: quantity > 0 ? cost / quantity : null,
      realized: round(realized, 2),
      incomplete,
    });
  }
  return {
    byAsset: result,
    disposals: disposals.sort((a, b) => a.date.localeCompare(b.date)),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
  return Number.isFinite(days) ? Math.max(Math.round(days), 0) : 0;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
