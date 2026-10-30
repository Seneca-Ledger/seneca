import type { ReturnsRange } from './helpers/roi-url-state';
import type { ReturnsData, ReturnsFlag, ReturnsSource } from './hooks/useReturns';

/** `+4.2 %`, `−1 %`, `0 %` in the reader's locale; a dash when there is no figure. */
export function formatSignedPercent(value: number | null, locale: string): string {
  if (value === null) {
    return '—';
  }
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/** The preset's short label; `all` is a word and comes from the dictionary. */
export function rangeLabel(range: ReturnsRange, allLabel: string): string {
  switch (range) {
    case '30d':
      return '1M';
    case 'ytd':
      return 'YTD';
    case 'all':
      return allLabel;
    default:
      return range.toUpperCase();
  }
}

/** Nothing to show at all: no account, no metal, no coin. */
export function hasNothingToShow(data: ReturnsData): boolean {
  return data.sources.length === 0;
}

/** Crypto is listed but never in the return; the headline should say so when it is there. */
export function excludesCrypto(data: ReturnsData): boolean {
  return data.sources.some(source => source.kind === 'crypto');
}

/**
 * The name a flag refers to: the holding, lot or currency the server named,
 * or else the line it belongs to.
 */
export function flagSubject(
  flag: ReturnsFlag,
  sources: ReturnsSource[],
  sourceName: (source: ReturnsSource) => string,
): string {
  if (flag.detail) {
    return flag.detail;
  }
  const source = sources.find(entry => entry.id === flag.sourceId);
  return source ? sourceName(source) : '';
}
