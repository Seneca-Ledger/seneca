import type { SystemCategoryKey } from '../../categories/system-categories';

/**
 * The few rows every bank writes the same way: its own fees, the interest it
 * pays or charges, and an insurance premium it collects. They name the bank's action, not a merchant, so a word
 * match is safe here where it is not for shops ("TRAVELODGE" is no travel
 * category, but "SMS alert charges" is always a fee).
 *
 * A rule names one of the default categories by its system key. The
 * workspace's own copy is used when it is enabled; none is ever created. Rules run after the user's rules and the payee's
 * history, so anything a person taught wins.
 */
type BuiltinRule = {
  category: SystemCategoryKey;
  type: 'income' | 'expense';
  pattern: RegExp;
};

const BUILTIN_RULES: readonly BuiltinRule[] = [
  {
    category: 'fees',
    type: 'expense',
    pattern: new RegExp(
      [
        // "Chrgs" is bank shorthand; nobody else abbreviates it so.
        String.raw`\bchrgs?\b`,
        String.raw`\bsms\s*alerts?\b`,
        String.raw`\b(annual|card|account|maintenance|monthly|bank|atm|abm|network|txn|transaction)\s+(fees?|charges?)\b`,
        String.raw`\bkontof(ü|ue)hrung`,
        String.raw`комиссия\s+(за|банка)`,
      ].join('|'),
      'iu',
    ),
  },
  {
    category: 'interest_income',
    type: 'income',
    pattern: new RegExp(
      [
        String.raw`\bint\.?\s*pd\b`,
        String.raw`\b(sb|savings)\s+int(erest)?\b`,
        String.raw`\binterest\s+(credit|credited|paid|earned)\b`,
        String.raw`\bcredit\s+interest\b`,
        String.raw`\bhabenzinsen\b`,
        String.raw`начисление\s+процентов|проценты\s+по\s+(вкладу|депозиту)`,
      ].join('|'),
      'iu',
    ),
  },
  {
    // The premium, not the insurer's name: "Example Insurance AG" may be a refund or a claim.
    category: 'insurance',
    type: 'expense',
    pattern: new RegExp(
      [
        String.raw`\binsurance\s+premium\b`,
        String.raw`\bversicherungsbeitrag\b`,
        String.raw`страхов\p{L}*\s+(взнос|преми)`,
      ].join('|'),
      'iu',
    ),
  },
  {
    category: 'interest',
    type: 'expense',
    pattern: new RegExp(
      [
        String.raw`\b(interest\s+(charged|debit|charge)|debit\s+interest|overdraft\s+interest)\b`,
        String.raw`\bfinance\s+charges?\b`,
        String.raw`\bsollzinsen\b`,
        String.raw`проценты\s+по\s+кредиту`,
      ].join('|'),
      'iu',
    ),
  },
];

/** The default category a bank's own row belongs to, by key; null when no rule fits. */
export function matchBuiltinRule(
  row: { counterpartyName?: string | null; paymentPurpose?: string | null },
  type: 'income' | 'expense',
): SystemCategoryKey | null {
  const text = `${row.counterpartyName ?? ''} ${row.paymentPurpose ?? ''}`;
  return (
    BUILTIN_RULES.find(rule => rule.type === type && rule.pattern.test(text))?.category ?? null
  );
}
