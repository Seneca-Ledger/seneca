// The name the server gives the account it creates on a fresh install
// (DEV_DEFAULTS.ADMIN_NAME in the backend): a technical label, not a person.
const TECHNICAL_NAMES = new Set(['administrator']);

/** The first word of the person's name for a greeting, or null when there is no real one. */
export function greetingName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? '';
  if (!trimmed || TECHNICAL_NAMES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed.split(/\s+/)[0] ?? null;
}
