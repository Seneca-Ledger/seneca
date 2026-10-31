import { QUOTES } from './catalog';
import type { QuoteEntry } from './types';

export type QuoteVotes = Readonly<Record<string, 1 | -1>>;

/** A stored thumb: the vote and the reader's day it was given (`YYYY-MM-DD`). */
export interface StoredQuoteVote {
  vote: 1 | -1;
  on: string;
}

/**
 * The thumbs that steer `day`'s pick: only those given before it, so voting on
 * today's quote never swaps it for another — the change shows from tomorrow.
 */
export function votesBefore(
  stored: Readonly<Record<string, StoredQuoteVote>>,
  day: string,
): QuoteVotes {
  return Object.fromEntries(
    Object.entries(stored)
      .filter(([, entry]) => entry.on < day)
      .map(([id, entry]) => [id, entry.vote]),
  );
}

/** A quote nobody voted near comes up this many times per round of the pool. */
const BASE_WEIGHT = 2;
const MAX_WEIGHT = 6;

const BY_ID = new Map(QUOTES.map(quote => [quote.id, quote]));

/** Same author counts once, every shared theme once more. */
function likeness(a: QuoteEntry, b: QuoteEntry): number {
  const sameAuthor = a.author === b.author ? 1 : 0;
  return sameAuthor + a.themes.filter(theme => b.themes.includes(theme)).length;
}

/**
 * How often a quote should come up given the reader's thumbs: each vote pulls
 * its look-alikes up or down, kept between 1 (still possible) and MAX_WEIGHT.
 */
function weight(quote: QuoteEntry, votes: QuoteVotes): number {
  let total = BASE_WEIGHT;
  for (const [id, vote] of Object.entries(votes)) {
    const voted = BY_ID.get(id);
    if (voted && voted.id !== quote.id) {
      total += vote * likeness(quote, voted);
    }
  }
  return Math.min(MAX_WEIGHT, Math.max(1, total));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Picks the quote for `seed` (one per day). Every quote owns as many slots as
 * its weight; day by day the pick steps through the slots by about 0.618 of
 * their count — co-prime, so a full cycle visits each slot once — which keeps
 * neighbouring days far apart and gives each quote its weighted share. A
 * thumbed-down quote never comes back, unless every candidate was thumbed down.
 */
export function pickQuote(pool: QuoteEntry[], votes: QuoteVotes, seed: number): QuoteEntry {
  const allowed = pool.filter(quote => votes[quote.id] !== -1);
  const candidates = allowed.length > 0 ? allowed : pool;
  const weights = candidates.map(quote => weight(quote, votes));
  const slots = weights.reduce((sum, value) => sum + value, 0);
  let stride = Math.ceil(slots * 0.618);
  while (gcd(stride, slots) !== 1) {
    stride += 1;
  }
  let slot = ((seed % slots) * stride) % slots;
  for (const [index, quote] of candidates.entries()) {
    if (slot < weights[index]) {
      return quote;
    }
    slot -= weights[index];
  }
  return candidates[0];
}
