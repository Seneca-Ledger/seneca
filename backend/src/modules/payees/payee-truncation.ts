import type { EntityManager } from 'typeorm';

/** Shortest name, spaces left out, that a cut-off may stand for a longer one. */
const MIN_PREFIX = 8;
/** One name spelled with other spaces ("MAMTAKUMARIDA S") needs fewer letters to be sure. */
const MIN_RESPACED = 6;

const compact = (payeeKey: string): string => payeeKey.replace(/ /gu, '');

/** Whether `letters` letters into `key` (spaces not counted) fall inside a word. */
function cutsAWord(key: string, letters: number): boolean {
  let seen = 0;
  for (let index = 0; index < key.length; index += 1) {
    if (key[index] !== ' ') {
      seen += 1;
    }
    if (seen === letters) {
      return index + 1 < key.length && key[index + 1] !== ' ';
    }
  }
  return false;
}

/**
 * Whether two payee keys can be one payee whose name a bank cut short or
 * spaced differently: "mamta kum", "mamtakum" and "mamta kumari das" all can.
 * The shorter, spaces left out, must start the longer, be long enough not to
 * be a common first word, and end inside one of the longer's words: "acme
 * store" is a whole name of its own next to "acme store berlin", not a cut.
 */
export function sameTruncatedName(a: string, b: string): boolean {
  const [shortKey, longKey] = [a, b].sort((x, y) => compact(x).length - compact(y).length);
  const [short, long] = [compact(shortKey), compact(longKey)];
  if (!(short && long)) {
    return false;
  }
  if (short === long) {
    return short.length >= MIN_RESPACED;
  }
  return short.length >= MIN_PREFIX && long.startsWith(short) && cutsAWord(longKey, short.length);
}

/**
 * The one payee of the workspace whose name this key could be a cut-off or a
 * respacing of, or that could be one of it. Null when there is none, or more
 * than one: "MAMTA KUM" next to both "MAMTA KUMARI" and "MAMTA KUMAR SINGH"
 * cannot be told apart.
 */
export async function truncatedTwinId(
  manager: EntityManager,
  workspaceId: string,
  payeeKey: string,
): Promise<string | null> {
  const key = compact(payeeKey);
  if (key.length < MIN_RESPACED) {
    return null;
  }
  const rows: Array<{ payee_id: string; payee_key: string }> = await manager.query(
    `SELECT payee_id, payee_key FROM payee_aliases
     WHERE workspace_id = $1
       AND (replace(payee_key, ' ', '') LIKE $2 || '%' OR $2 LIKE replace(payee_key, ' ', '') || '%')`,
    [workspaceId, key],
  );
  const twins = new Set(
    rows.filter(row => sameTruncatedName(row.payee_key, payeeKey)).map(row => row.payee_id),
  );
  const [only] = twins;
  return twins.size === 1 && only ? only : null;
}

/**
 * Moves payees' rows, aliases and subscription links to `targetId`, then
 * deletes them. The data half of a merge; the caller audits it.
 */
export async function movePayeesInto(
  manager: EntityManager,
  workspaceId: string,
  targetId: string,
  sourceIds: string[],
): Promise<void> {
  await manager.query(
    'UPDATE transactions SET payee_id = $1 WHERE workspace_id = $2 AND payee_id = ANY($3::uuid[])',
    [targetId, workspaceId, sourceIds],
  );
  await manager.query(
    'UPDATE payee_aliases SET payee_id = $1 WHERE workspace_id = $2 AND payee_id = ANY($3::uuid[])',
    [targetId, workspaceId, sourceIds],
  );
  // A subscription that recognised a source keeps recognising its rows,
  // now under the target; deleting the source would drop the rule with it.
  await manager.query(
    `INSERT INTO subscription_payees (workspace_id, subscription_id, payee_id)
     SELECT workspace_id, subscription_id, $1 FROM subscription_payees
      WHERE workspace_id = $2 AND payee_id = ANY($3::uuid[])
     ON CONFLICT (subscription_id, payee_id) DO NOTHING`,
    [targetId, workspaceId, sourceIds],
  );
  await manager.query('DELETE FROM payees WHERE workspace_id = $1 AND id = ANY($2::uuid[])', [
    workspaceId,
    sourceIds,
  ]);
}

type PayeeRow = {
  id: string;
  name: string;
  mode: string;
  category_id: string | null;
  rows: number;
};

/**
 * Merges payees of a workspace that are one name cut short by a bank: each
 * group joins its fullest name (the one with the most rows on a tie). Payees
 * pinned to different categories, or set to be left alone, are not merged:
 * a person told them apart. Answers the merges made, for the audit.
 */
export async function mergeTruncatedPayees(
  manager: EntityManager,
  workspaceId: string,
  payeeIds: readonly string[],
): Promise<Array<{ targetId: string; sources: Array<{ id: string; name: string }> }>> {
  if (payeeIds.length === 0) {
    return [];
  }
  const payees: PayeeRow[] = await manager.query(
    `SELECT p.id, p.name, p.mode, p.category_id,
            (SELECT COUNT(*)::int FROM transactions t WHERE t.payee_id = p.id) AS rows
     FROM payees p WHERE p.workspace_id = $1 AND p.mode <> 'never'`,
    [workspaceId],
  );
  const keyed = await manager.query(
    'SELECT payee_id, payee_key FROM payee_aliases WHERE workspace_id = $1',
    [workspaceId],
  );
  const keysOf = new Map<string, string[]>();
  for (const { payee_id, payee_key } of keyed as Array<{ payee_id: string; payee_key: string }>) {
    keysOf.set(payee_id, [...(keysOf.get(payee_id) ?? []), payee_key]);
  }
  const twinsOf = (payee: PayeeRow): PayeeRow[] =>
    payees.filter(
      other =>
        other.id !== payee.id &&
        (keysOf.get(payee.id) ?? []).some(a =>
          (keysOf.get(other.id) ?? []).some(b => sameTruncatedName(a, b)),
        ),
    );

  const merges: Array<{ targetId: string; sources: Array<{ id: string; name: string }> }> = [];
  const done = new Set<string>();
  for (const id of payeeIds) {
    const payee = payees.find(entry => entry.id === id);
    if (!payee || done.has(id)) {
      continue;
    }
    const group = [payee, ...twinsOf(payee)].filter(entry => !done.has(entry.id));
    // Every member must be a twin of every other: a chain is not one name.
    const tight = group.every(a => group.every(b => a === b || twinsOf(a).includes(b)));
    const pinned = new Set(group.map(entry => entry.category_id).filter(Boolean));
    if (group.length < 2 || !tight || pinned.size > 1) {
      continue;
    }
    const [target, ...sources] = [...group].sort(
      (a, b) =>
        b.name.replace(/\s/gu, '').length - a.name.replace(/\s/gu, '').length || b.rows - a.rows,
    );
    if (!target) {
      continue;
    }
    await movePayeesInto(
      manager,
      workspaceId,
      target.id,
      sources.map(source => source.id),
    );
    for (const entry of group) {
      done.add(entry.id);
    }
    merges.push({ targetId: target.id, sources: sources.map(({ id, name }) => ({ id, name })) });
  }
  return merges;
}
