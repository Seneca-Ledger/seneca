/** How many rows a leaderboard draws before the tail stops being a ranking. */
export const LEADERBOARD_ROW_LIMIT = 60;

/**
 * The rows to draw: the top of the ranking, plus the row a deep link points
 * at when the ranking left it out.
 *
 * Advice links at a single row (`?focus=merchant:<name>`), and a workspace
 * with hundreds of merchants can easily rank it past the cut — the ring would
 * then wait for an element that is never drawn and the page would look like
 * it had ignored the click.
 */
export function rowsWithFocused<T>(
  rows: T[],
  attentionIdOf: (row: T) => string,
  focusId: string | null,
): T[] {
  const visible = rows.slice(0, LEADERBOARD_ROW_LIMIT);
  if (focusId === null || visible.some(row => attentionIdOf(row) === focusId)) {
    return visible;
  }
  const focused = rows.find(row => attentionIdOf(row) === focusId);
  return focused ? [...visible, focused] : visible;
}
