import { normalizeCurrencyCode } from '../exchange-rates/currency-converter';

/** What parsing writes when a statement names no account: not an account number. */
const NO_ACCOUNT_NUMBER = 'Unknown';

/** The statement's account number, or null when it has none. */
export function realAccountNumber(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  return trimmed && trimmed !== NO_ACCOUNT_NUMBER ? trimmed : null;
}

/** Letters and digits only, upper-cased: "DE89 3704-0044" and "de8937040044" are one account. */
export function normalizeAccountNumber(value: string | null | undefined): string {
  return String(realAccountNumber(value) ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

/**
 * Whether a wallet's account number names the statement's account. People often
 * type only the last digits, so a wallet number of 4+ characters matches the end
 * of the statement's full one.
 */
function sameAccount(walletNumber: string, statementNumber: string): boolean {
  if (!(walletNumber && statementNumber)) {
    return false;
  }
  if (walletNumber === statementNumber) {
    return true;
  }
  return walletNumber.length >= 4 && statementNumber.endsWith(walletNumber);
}

/**
 * The one active wallet a statement belongs to by its account number and
 * currency, or null when none or several fit: an ambiguous match is left to the
 * user rather than guessed.
 */
export function pickWalletForAccount<
  W extends { id: string; accountNumber: string | null; currency: string; isActive: boolean },
>(wallets: W[], accountNumber: string | null | undefined, currency: string | null | undefined) {
  const statementNumber = normalizeAccountNumber(accountNumber);
  const statementCurrency = normalizeCurrencyCode(currency);
  const matches = wallets.filter(
    wallet =>
      wallet.isActive &&
      normalizeCurrencyCode(wallet.currency) === statementCurrency &&
      sameAccount(normalizeAccountNumber(wallet.accountNumber), statementNumber),
  );
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Where a statement with no account number came from: its bank and the export
 * layout (a known preset's name, else the CSV header). Null when nothing tells
 * one source from another.
 */
export function statementSource(
  bankName: string | null | undefined,
  institution: string | null | undefined,
  normalizedHeader: string | null | undefined,
): string | null {
  const layout = String(institution || normalizedHeader || '').trim();
  return layout ? `${String(bankName ?? '').toLowerCase()}|${layout.toLowerCase()}` : null;
}

/**
 * The account earlier statements of the same source and currency were linked
 * to, when they all sit in one active account. Unlinking them forgets it; two
 * accounts fed by the same export leave the choice to the user.
 */
export function pickWalletBySource<W extends { id: string; currency: string; isActive: boolean }>(
  wallets: W[],
  linked: { walletId: string; source: string | null; currency: string | null }[],
  source: string | null,
  currency: string | null | undefined,
): W | null {
  if (!source) {
    return null;
  }
  const statementCurrency = normalizeCurrencyCode(currency);
  const walletIds = new Set(
    linked
      .filter(
        item =>
          item.source === source && normalizeCurrencyCode(item.currency) === statementCurrency,
      )
      .map(item => item.walletId),
  );
  if (walletIds.size !== 1) {
    return null;
  }
  const [walletId] = walletIds;
  return (
    wallets.find(
      wallet =>
        wallet.id === walletId &&
        wallet.isActive &&
        normalizeCurrencyCode(wallet.currency) === statementCurrency,
    ) ?? null
  );
}
