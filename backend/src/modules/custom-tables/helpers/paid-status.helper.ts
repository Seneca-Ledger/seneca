export type PaidStatusInput = {
  id: string;
  counterparty?: string | null;
  comment?: string | null;
};

const PAID_PATTERNS = [
  /\bpaid\b/i,
  /\bsettled\b/i,
  /\bcompleted\b/i,
  /\bprocessed\b/i,
  /\bcleared\b/i,
  /оплачен/i,
  /оплачено/i,
  /погашен/i,
  /погашено/i,
  /закрыт/i,
  /закрыта/i,
];

const UNPAID_PATTERNS = [
  /\bunpaid\b/i,
  /\bpending\b/i,
  /\bawaiting\b/i,
  /\bto pay\b/i,
  /не\s*опла/i,
  /неопла/i,
  /ожида/i,
  /к оплат/i,
  /счет\s*на\s*оплат/i,
  /сч[её]т\s*на\s*оплат/i,
];

/** Paid, unpaid, or `null` when the row's text says neither. */
export const detectPaidStatus = (input: PaidStatusInput): boolean | null => {
  const combined = `${input.counterparty || ''} ${input.comment || ''}`.trim();
  if (!combined) {
    return null;
  }
  const normalized = combined.toLowerCase();
  if (UNPAID_PATTERNS.some(re => re.test(normalized))) {
    return false;
  }
  if (PAID_PATTERNS.some(re => re.test(normalized))) {
    return true;
  }
  return null;
};
