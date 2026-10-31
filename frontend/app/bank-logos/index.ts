export type BankLogoKey =
  | 'kaspi'
  | 'bereke'
  | 'hapoalim'
  | 'absa'
  | 'ally'
  | 'anz'
  | 'associated'
  | 'atb'
  | 'axis'
  | 'banco_do_brasil'
  | 'bank_of_china'
  | 'bank_of_scotland'
  | 'barclays'
  | 'other';

export type ResolvedBankLogo = {
  key: BankLogoKey;
  src: string;
  displayName: string;
};

const LOGO_SRC_BY_KEY: Record<BankLogoKey, string> = {
  kaspi: '/images/bank-logo/kaspi.png',
  bereke: '/images/bank-logo/bereke-bank.png',
  // No logo of their own yet.
  hapoalim: '/images/bank-logo/bank.png',
  absa: '/images/bank-logo/bank.png',
  ally: '/images/bank-logo/bank.png',
  anz: '/images/bank-logo/bank.png',
  associated: '/images/bank-logo/bank.png',
  atb: '/images/bank-logo/bank.png',
  axis: '/images/bank-logo/bank.png',
  banco_do_brasil: '/images/bank-logo/bank.png',
  bank_of_china: '/images/bank-logo/bank.png',
  bank_of_scotland: '/images/bank-logo/bank.png',
  barclays: '/images/bank-logo/bank.png',
  other: '/images/bank-logo/bank.png',
};

const DISPLAY_NAME_BY_KEY: Record<BankLogoKey, string> = {
  kaspi: 'Kaspi',
  bereke: 'Bereke',
  hapoalim: 'Bank Hapoalim',
  absa: 'Absa Bank',
  ally: 'Ally Bank',
  anz: 'ANZ',
  associated: 'Associated Bank',
  atb: 'ATB Financial',
  axis: 'Axis Bank',
  banco_do_brasil: 'Banco do Brasil',
  bank_of_china: 'Bank of China (Hong Kong)',
  bank_of_scotland: 'Bank of Scotland',
  barclays: 'Barclays',
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
  if (n.includes('hapoalim')) {
    return 'hapoalim';
  }
  if (n === 'absa' || n.startsWith('absa ')) {
    return 'absa';
  }
  if (n === 'ally' || n.startsWith('ally bank')) {
    return 'ally';
  }
  if (n === 'anz' || n.startsWith('anz ')) {
    return 'anz';
  }
  if (n === 'associated' || n.startsWith('associated bank')) {
    return 'associated';
  }
  if (n === 'atb' || n.startsWith('atb ')) {
    return 'atb';
  }
  if (n === 'axis' || n.startsWith('axis bank')) {
    return 'axis';
  }
  if (n === 'banco_do_brasil' || n.startsWith('banco do brasil')) {
    return 'banco_do_brasil';
  }
  if (n === 'bank_of_china' || n.startsWith('bank of china')) {
    return 'bank_of_china';
  }
  if (n === 'bank_of_scotland' || n.startsWith('bank of scotland')) {
    return 'bank_of_scotland';
  }
  if (n.startsWith('barclays')) {
    return 'barclays';
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
