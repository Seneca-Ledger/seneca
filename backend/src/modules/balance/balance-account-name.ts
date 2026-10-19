/**
 * The name of a balance account in the reader's language. The stored `name` is
 * Russian (the default chart was written in it), so it is right only for ru;
 * kk has its own column, and every other language reads the English one, as
 * English does. A user's own account has no translations and keeps its name.
 */
export function balanceAccountName(
  account: { name: string; nameEn?: string | null; nameKk?: string | null },
  locale?: string,
): string {
  if (!locale || locale === 'ru') {
    return account.name;
  }
  if (locale === 'kk') {
    return account.nameKk || account.name;
  }
  return account.nameEn || account.name;
}
