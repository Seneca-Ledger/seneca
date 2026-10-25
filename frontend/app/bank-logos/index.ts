export type BankLogoKey = 'kaspi' | 'bereke' | 'other';

export type ResolvedBankLogo = {
  key: BankLogoKey;
  src: string;
  displayName: string;
};

const LOGO_SRC_BY_KEY: Record<BankLogoKey, string> = {
  kaspi: '/images/bank-logo/kaspi.png',
  bereke: '/images/bank-logo/bereke-bank.png',
  other: '/images/bank-logo/bank.png',
};

const DISPLAY_NAME_BY_KEY: Record<BankLogoKey, string> = {
  kaspi: 'Kaspi',
  bereke: 'Bereke',
  other: 'Bank',
};

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\u00A0\s]+/g, ' ')
    .replace(/[._-]+/g, ' ')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const resolveKeyFromName = (bankName: string): BankLogoKey => {
  const n = normalize(bankName);

  // Backend enum values
  if (n === 'kaspi' || n.includes('kaspi')) {
    return 'kaspi';
  }
  if (n === 'bereke new' || n === 'bereke old' || n.includes('bereke')) {
    return 'bereke';
  }
  if (n === 'other') {
    return 'other';
  }

  // Common aliases / noisy variants
  if (n.includes('kaspi bank')) {
    return 'kaspi';
  }
  if (n.includes('bereke bank')) {
    return 'bereke';
  }

  return 'other';
};

export const resolveBankLogo = (bankName?: string | null): ResolvedBankLogo => {
  const key = bankName ? resolveKeyFromName(bankName) : 'other';
  return {
    key,
    src: LOGO_SRC_BY_KEY[key],
    displayName: DISPLAY_NAME_BY_KEY[key],
  };
};
