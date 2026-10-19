const normalizeLocale = (locale: string | undefined): string | null => {
  if (!locale) {
    return null;
  }

  const normalized = locale.trim().replace('_', '-').toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized;
};

const getLocaleCandidates = (locale: string | undefined): string[] => {
  const normalized = normalizeLocale(locale);
  if (!normalized) {
    return [];
  }

  const base = normalized.split('-')[0] || normalized;
  const candidates = [locale || '', normalized, base].map(item => item.trim()).filter(Boolean);

  return Array.from(new Set(candidates));
};

const readLocalizedFromRecord = (source: unknown, candidates: string[]): string | null => {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const record = source as Record<string, unknown>;

  for (const key of candidates) {
    const direct = record[key];
    if (typeof direct === 'string' && direct.length > 0) {
      return direct;
    }

    const lowerKey = key.toLowerCase();
    const lower = record[lowerKey];
    if (typeof lower === 'string' && lower.length > 0) {
      return lower;
    }
  }

  return null;
};

/**
 * Read, never `'value' in token`: intlayer hands back its nodes as proxies whose
 * `value` exists on read but not to the `in` operator, and that check sent every
 * string to the English fallback.
 */
const readValue = (token: unknown): unknown =>
  token && typeof token === 'object' ? (token as { value?: unknown }).value : undefined;

const isMeaningfulStringified = (value: string): boolean => {
  return value.length > 0 && value !== '[object Object]';
};

export function getNestedOnboardingValue(source: unknown, path: string[]): unknown {
  let current = source;

  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function resolveOnboardingText(
  token: unknown,
  fallback = '',
  preferredLocale?: string,
): string {
  if (typeof token === 'string') {
    return token;
  }

  const candidates = getLocaleCandidates(preferredLocale);

  if (candidates.length > 0) {
    const localizedFromToken = readLocalizedFromRecord(token, candidates);
    if (localizedFromToken) {
      return localizedFromToken;
    }

    const localizedFromValue = readLocalizedFromRecord(readValue(token), candidates);
    if (localizedFromValue) {
      return localizedFromValue;
    }
  }

  if (token !== null && token !== undefined) {
    const stringified = String(token);
    if (isMeaningfulStringified(stringified)) {
      return stringified;
    }
  }

  const value = readValue(token);
  if (typeof value === 'string') {
    return value;
  }

  return fallback;
}
