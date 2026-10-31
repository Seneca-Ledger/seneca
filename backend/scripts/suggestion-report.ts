/**
 * How well category suggestions do on real data, read-only and in numbers
 * only (no descriptor, amount or name leaves the database):
 *
 *   npm --prefix backend run suggestion-report [-- <workspaceId>]
 *
 * Per source: how many suggestions a person accepted as they were, how many
 * they changed (the real precision), and how many still wait; then how many
 * rows waiting for a decision carry a suggestion at all (the coverage).
 */
import { AppDataSource } from '../src/data-source';

const SUGGESTED = ['history', 'learned', 'keyword', 'kind', 'brand', 'receipt'];

const percent = (part: number, whole: number): string =>
  whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`;

async function main(): Promise<void> {
  const workspaceId = process.argv[2] ?? null;
  await AppDataSource.initialize();
  const scope = workspaceId ? 'AND workspace_id = $1' : '';
  const params = workspaceId ? [workspaceId] : [];

  const outcomes: Array<{ source: string; accepted: number; corrected: number }> =
    await AppDataSource.query(
      `SELECT source,
              COUNT(*) FILTER (WHERE outcome = 'accepted')::int AS accepted,
              COUNT(*) FILTER (WHERE outcome = 'corrected')::int AS corrected
       FROM category_suggestion_outcomes WHERE true ${scope}
       GROUP BY source ORDER BY source`,
      params,
    );
  const waiting: Array<{ source: string | null; rows: number }> = await AppDataSource.query(
    `SELECT category_source AS source, COUNT(*)::int AS rows
     FROM transactions
     WHERE is_verified = false AND is_duplicate = false AND transfer_pair_id IS NULL ${scope}
     GROUP BY category_source`,
    params,
  );

  const pending = new Map(waiting.map(row => [row.source, row.rows]));
  console.log(workspaceId ? `Workspace ${workspaceId}` : 'All workspaces');
  console.log('\nsource      accepted  corrected  precision  waiting');
  for (const source of SUGGESTED) {
    const row = outcomes.find(entry => entry.source === source);
    const accepted = row?.accepted ?? 0;
    const corrected = row?.corrected ?? 0;
    console.log(
      `${source.padEnd(11)} ${String(accepted).padStart(8)}  ${String(corrected).padStart(9)}  ${percent(accepted, accepted + corrected).padStart(9)}  ${String(pending.get(source) ?? 0).padStart(7)}`,
    );
  }
  const suggested = SUGGESTED.reduce((sum, source) => sum + (pending.get(source) ?? 0), 0);
  const open = suggested + (pending.get('default') ?? 0) + (pending.get(null) ?? 0);
  console.log(
    `\nRows waiting for a decision: ${open}, with a suggestion: ${suggested} (${percent(suggested, open)})`,
  );
  await AppDataSource.destroy();
}

main().catch(async error => {
  console.error(error);
  await AppDataSource.destroy();
  process.exit(1);
});
