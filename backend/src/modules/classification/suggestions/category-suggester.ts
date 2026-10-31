import { TransactionCategorySource } from '../../../entities/transaction-category-source';
import type { SystemCategoryKey } from '../../categories/system-categories';
import { matchBuiltinRule } from '../engine/builtin-rules';
import type { BrandMatch } from './brand-index';
import { detectKind, type KindContext, type KindRow } from './operation-kind';

/** A default category to suggest, with the step that found it. */
export type KeySuggestion = {
  key: SystemCategoryKey;
  source: TransactionCategorySource;
  /** Machine tag the UI can explain: `kind:p2p`, `kind:cash`, `kind:salary`, `brand:Q123`. */
  reason: string | null;
};

/**
 * What to suggest for a row nobody has filed and whose payee has no history:
 * the bank's own fee and interest rows, then what the descriptor says the
 * operation is, or a known brand. Strong kinds (cash, salary, a person's UPI
 * account) come first, then a brand for spending, then weak kinds (a bank
 * transfer to a person-like name), which a brand in the name outranks. A suggestion stays unconfirmed until a person accepts it, so it never
 * reaches a budget on its own.
 */
export function suggestKey(
  row: KindRow & { currency?: string | null },
  type: 'income' | 'expense',
  ctx: KindContext,
  brands: { match: (row: KindRow & { currency?: string | null }) => BrandMatch | null } | null,
): KeySuggestion | null {
  const builtin = matchBuiltinRule(row, type);
  if (builtin) {
    return { key: builtin, source: TransactionCategorySource.KEYWORD, reason: null };
  }
  const kind = detectKind(row, type, ctx);
  const byKind = kind
    ? { key: kind.key, source: TransactionCategorySource.KIND, reason: `kind:${kind.reason}` }
    : null;
  if (kind?.strength === 'strong') {
    return byKind;
  }
  // A refund from a shop is not shopping: brands only file spending.
  const brand = type === 'expense' ? brands?.match(row) : null;
  if (brand) {
    return {
      key: brand.key,
      source: TransactionCategorySource.BRAND,
      reason: brand.qid ? `brand:${brand.qid}` : 'brand',
    };
  }
  return byKind;
}
