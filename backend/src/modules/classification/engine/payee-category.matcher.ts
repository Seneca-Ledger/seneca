/**
 * Which category a payee defaults to, by the rule YNAB settled on in 2026-08:
 * the default only moves when **two of the three most recent transactions**
 * agree on a different category. Before that rule, the last transaction won,
 * so buying a gift card at the grocery store filed every later grocery run
 * under Gifts — the single most upvoted complaint about auto-categorisation.
 *
 * Below three transactions there is no window to speak of, so the last
 * category used is the default.
 */

/** Oldest first, the order the transactions were booked in. */
export type PayeeHistoryEntry = { categoryId: string };

export type PayeeOverride = {
  /** `auto` learns from history, `always` pins a category, `never` abstains. */
  mode: 'auto' | 'always' | 'never';
  categoryId?: string | null;
};

export type PayeeDecision = {
  categoryId: string;
  /** Where the answer came from, for the "why" shown next to the category. */
  basis: 'payee-default' | 'payee-pinned';
};

const WINDOW = 3;
const AGREEING = 2;

/** The one category at least two of these three share, if there is one. */
function windowWinner(window: readonly PayeeHistoryEntry[]): string | null {
  const counts = new Map<string, number>();
  for (const entry of window) {
    counts.set(entry.categoryId, (counts.get(entry.categoryId) ?? 0) + 1);
  }
  for (const [categoryId, count] of counts) {
    if (count >= AGREEING) {
      return categoryId;
    }
  }
  return null;
}

export function decidePayeeCategory({
  history,
  override,
}: {
  history: readonly PayeeHistoryEntry[];
  override?: PayeeOverride;
}): PayeeDecision | null {
  if (override?.mode === 'never') {
    return null;
  }
  if (override?.mode === 'always' && override.categoryId) {
    return { categoryId: override.categoryId, basis: 'payee-pinned' };
  }

  // Replayed forward: a window without two agreeing transactions leaves the
  // default where it was, so an established category survives a run of one-offs.
  let current: string | null = null;
  for (let index = 0; index < history.length; index += 1) {
    const window = history.slice(Math.max(0, index - (WINDOW - 1)), index + 1);
    if (window.length < WINDOW) {
      current = history[index].categoryId;
      continue;
    }
    current = windowWinner(window) ?? current;
  }

  return current ? { categoryId: current, basis: 'payee-default' } : null;
}
