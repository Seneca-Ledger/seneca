import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import type { Transaction } from '../types';

const LOCALE_MAP: Record<string, string> = {
  kk: 'kk-KZ',
  ru: 'ru-RU',
  en: 'en-US',
};

function resolveLocale(locale: string): string {
  return LOCALE_MAP[locale] ?? 'en-US';
}

export function formatDate(dateString: string, locale: string): string {
  return formatStoredDateWithOptions(
    dateString,
    { year: 'numeric', month: 'short', day: 'numeric' },
    resolveLocale(locale),
  );
}

export function formatAmount(amount: number, currency: string, locale: string): string {
  if (Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function truncateText(text: string, maxLength = 60): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}…`;
}

export function resolveDisplayCurrency(tx: Transaction, showConverted: boolean): string {
  return showConverted && tx.convertedCurrency
    ? tx.convertedCurrency
    : (tx.currency ?? FALLBACK_CURRENCY);
}

export interface CategoryStyleOptions {
  hasDisabledCategory: boolean;
  color?: string;
}

export function buildCategoryStyle(options: CategoryStyleOptions): React.CSSProperties {
  const { hasDisabledCategory, color } = options;
  return {
    backgroundColor: hasDisabledCategory ? '#fee2e2' : color ? `${color}15` : '#e5e7eb',
    color: hasDisabledCategory ? '#b91c1c' : (color ?? '#374151'),
  };
}

// Derives display label + style for a category trigger button.
// Extracted from CategoryDropdown to keep the component complexity under the limit.
function buildCategoryLabel(
  name: string | undefined,
  hasDisabled: boolean,
  fallback: string,
): string {
  if (hasDisabled) return `${name ?? ''} — select category`;
  return name ?? fallback;
}

export function resolveCategoryDisplay(
  tx: Transaction,
  fallbackLabel: string,
  locale: string,
): { triggerLabel: string; style: React.CSSProperties } {
  const hasDisabledCategory = tx.category?.isEnabled === false;
  const categoryName = tx.category ? getCategoryDisplayName(tx.category, locale) : undefined;
  const triggerLabel = buildCategoryLabel(categoryName, hasDisabledCategory, fallbackLabel);
  return {
    triggerLabel,
    style: buildCategoryStyle({ hasDisabledCategory, color: tx.category?.color }),
  };
}

export function resolveDisplayAmount(
  tx: Transaction,
  rawAmount: number,
  showConverted: boolean,
): number {
  if (!showConverted || tx.convertedAmount === undefined) return rawAmount;
  return tx.convertedAmount;
}
