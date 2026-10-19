/**
 * Resolves a secret from a chain of candidates, refusing to fall back to a
 * literal.
 *
 * Several call sites used to end their chain with a hardcoded string
 * ('lumio-state', 'session-default-secret'). Those are published in this
 * repository, so any deployment that had not set the corresponding variable was
 * signing and hashing with a key everyone can read — while looking configured.
 * Failing at startup is the honest outcome.
 */
export function requireSecret(name: string, ...candidates: (string | undefined | null)[]): string {
  const resolved = candidates.find(candidate => candidate && candidate.trim() !== '');
  if (!resolved) {
    throw new Error(`Missing required secret: set ${name}`);
  }
  return resolved;
}
