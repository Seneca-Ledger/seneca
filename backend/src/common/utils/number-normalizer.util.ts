/**
 * Normalizes numbers from bank statements
 * - Replaces comma with dot
 * - Removes thousands separators
 * - Converts to number
 */
export function normalizeNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  // Remove all whitespace (including non-breaking space, used as a thousands separator)
  let normalized = value.replace(/[\s ]/g, '');

  // Unicode minus sign behaves like ASCII minus
  normalized = normalized.replace(/−/g, '-');

  let negative = false;

  // Parenthesised amounts are a common negative-number convention: (100) = -100
  if (/^\(.*\)$/.test(normalized)) {
    negative = true;
    normalized = normalized.slice(1, -1);
  }

  // Trailing minus: "100-" = -100
  if (normalized.endsWith('-')) {
    negative = true;
    normalized = normalized.slice(0, -1);
  }

  if (normalized.startsWith('-')) {
    negative = true;
    normalized = normalized.slice(1);
  }

  // Remove any non-digit characters except dot and comma
  normalized = normalized.replace(/[^\d.,]/g, '');

  if (!normalized) {
    return null;
  }

  const commaCount = (normalized.match(/,/g) || []).length;
  const dotCount = (normalized.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    // Both separators present: whichever appears last is the decimal separator,
    // the other is thousands grouping.
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (commaCount === 1 || dotCount === 1) {
    const separator = commaCount === 1 ? ',' : '.';
    const digitsAfter = normalized.length - normalized.indexOf(separator) - 1;
    // ponytail: a lone separator with exactly 3 digits after it is ambiguous
    // (thousands grouping vs. a 3-decimal currency). This codebase only
    // deals with 2-decimal currencies, so treat it as grouping. Revisit if
    // a 3-decimal currency (e.g. KWD) needs support.
    normalized =
      digitsAfter === 3 ? normalized.replace(separator, '') : normalized.replace(separator, '.');
  } else if (commaCount > 1) {
    // Multiple commas, no dot: all commas are thousands separators.
    normalized = normalized.replace(/,/g, '');
  } else if (dotCount > 1) {
    // Multiple dots, no comma: keep only the last dot as the decimal separator.
    const parts = normalized.split('.');
    normalized = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
  }

  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return negative ? -parsed : parsed;
}

export function normalizeNumberAdvanced(
  value: string | number | null | undefined,
  locale = 'en',
): { value: number | null; normalized: string } {
  if (value === null || value === undefined) {
    return { value: null, normalized: '' };
  }

  if (typeof value === 'number') {
    return { value, normalized: String(value) };
  }

  if (typeof value !== 'string') {
    return { value: null, normalized: '' };
  }

  let sanitized = value.replace(/[^\d.,-]/g, '').replace(/\s+/g, '');

  if (locale === 'de' || locale === 'ru') {
    sanitized = sanitized.replace(/\./g, '').replace(/,/g, '.');
  } else {
    if (sanitized.includes(',') && !sanitized.includes('.')) {
      sanitized = sanitized.replace(/,/g, '.');
    } else {
      sanitized = sanitized.replace(/,/g, '');
    }
  }

  const parts = sanitized.split('.');
  if (parts.length > 2) {
    sanitized = `${parts.slice(0, -1).join('')}.${parts[parts.length - 1]}`;
  }

  const num = Number.parseFloat(sanitized);
  return { value: Number.isFinite(num) ? num : null, normalized: sanitized };
}

/**
 * Normalizes date strings to Date objects
 */
export function normalizeDate(dateStr: string): Date | null {
  if (!dateStr) {
    return null;
  }

  const trimmed = dateStr.trim();
  // Banks print "0:20:11" (one-digit hour) and "09:22" (no seconds) as well.
  const dateTimeMatch = trimmed.match(
    /(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (dateTimeMatch) {
    const [, dd, mm, yyyy, hh = '00', min = '00', ss = '00'] = dateTimeMatch;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
  }

  // Try different date formats
  const formats = [
    /(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[1]) {
        // YYYY-MM-DD
        const parsed = new Date(dateStr);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
        continue;
      }

      // DD.MM.YYYY or DD/MM/YYYY; US statements use MM/DD/YYYY, so swap when
      // the middle component cannot be a month.
      let day = Number(match[1]);
      let month = Number(match[2]);
      const year = Number(match[3]);
      if (month > 12 && day <= 12) {
        [day, month] = [month, day];
      }
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day);
      }
    }
  }

  // DD/MM/YY (2-digit year)
  const shortYearMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{2})(?!\d)/);
  if (shortYearMatch) {
    const [, dd, mm, yy] = shortYearMatch;
    const year = Number(yy) <= 49 ? 2000 + Number(yy) : 1900 + Number(yy);
    return new Date(year, Number(mm) - 1, Number(dd));
  }

  // A bare number is never a date here: V8 reads "2" as February 2001 and
  // "2026" as January 1st, which turns column numbers and years into rows.
  if (/^\d+$/.test(trimmed)) {
    return null;
  }

  // Try direct parsing; reject nonsense years (e.g. "45424" parsed as a year)
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    if (year >= 1950 && year <= 2100) {
      return parsed;
    }
  }

  return null;
}
