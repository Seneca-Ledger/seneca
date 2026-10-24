/** Company forms and web endings that do not tell two businesses apart. */
const NOISE_WORDS = new Set([
  'gmbh',
  'ag',
  'kg',
  'ug',
  'ohg',
  'llc',
  'ltd',
  'limited',
  'inc',
  'corp',
  'co',
  'sa',
  'sas',
  'sarl',
  'srl',
  'spa',
  'bv',
  'nv',
  'ab',
  'as',
  'oy',
  'plc',
  'sro',
  'sp',
  'zoo',
  'com',
  'de',
  'net',
  'org',
  'eu',
]);

/** "ACME Store GmbH", "acme-store.com" and "Acme Store" all read "acme store". */
export function comparableName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(word => word && !NOISE_WORDS.has(word))
    .join(' ');
}

/** A short name is too common a prefix ("the", "bar") to say two payees are one. */
const MIN_PREFIX_LENGTH = 5;

/**
 * Payees whose names look like one business: the same once company forms and
 * punctuation are dropped, or one name continuing the other word by word
 * ("Amazon" and "Amazon Marketplace"). Only suggestions: merging stays the
 * person's call.
 */
export function groupLikelyDuplicates<P extends { id: string; name: string }>(payees: P[]): P[][] {
  const named = payees
    .map(payee => ({ payee, key: comparableName(payee.name) }))
    .filter(entry => entry.key)
    .sort((a, b) => a.key.length - b.key.length || a.key.localeCompare(b.key));

  const groupOf = new Map<string, P[]>();
  const groups: P[][] = [];
  for (const { payee, key } of named) {
    const root = [...groupOf.keys()].find(
      existing =>
        existing === key ||
        (existing.length >= MIN_PREFIX_LENGTH && key.startsWith(`${existing} `)),
    );
    if (root) {
      groupOf.get(root)?.push(payee);
      continue;
    }
    const group = [payee];
    groupOf.set(key, group);
    groups.push(group);
  }
  return groups.filter(group => group.length > 1);
}
