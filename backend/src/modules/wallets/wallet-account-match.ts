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
