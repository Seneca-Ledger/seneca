import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

const buildPublicCurrencyApiUrls = (from: string): string[] => {
  const fromCode = from.toLowerCase();
  const endpoint = `v1/currencies/${fromCode}.json`;
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/${endpoint}`,
    `https://latest.currency-api.pages.dev/${endpoint}`,
  ];
};

const extractPublicCurrencyRate = (
  data: Record<string, unknown>,
  from: string,
  to: string,
): number | null => {
  const targetKey = to.toLowerCase();
  const baseRates = data[from.toLowerCase()];
  const rate =
    baseRates && typeof baseRates === 'object' && !Array.isArray(baseRates)
      ? (baseRates as Record<string, unknown>)[targetKey]
      : data[targetKey];
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null;
};

const fetchPublicExchangeRate = async (from: string, to: string): Promise<number | null> => {
  for (const url of buildPublicCurrencyApiUrls(from)) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }
      const data = (await response.json()) as Record<string, unknown>;
      const rate = extractPublicCurrencyRate(data, from, to);
      if (rate !== null) {
        return rate;
      }
    } catch {
      // Try the next public mirror.
    }
  }
  return null;
};

/** Fetches a currency conversion rate, falling back to a public mirror if the server call fails. */
export const fetchExchangeRate = async (from: string, to: string): Promise<number | null> => {
  try {
    const quote = await apiQueryDecoded({
      url: '/exchange-rates',
      params: { from, to },
      contract: 'ExchangeRateQuote',
    });
    const rate = quote.rate;
    if (Number.isFinite(rate)) {
      return rate;
    }
  } catch {
    // Fall back to the public currency API so callers do not depend on
    // optional server-side exchange-rate connectivity.
  }
  return fetchPublicExchangeRate(from, to);
};
