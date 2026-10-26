import { LessThanOrEqual, type Repository } from 'typeorm';
import type { ExchangeRate } from '../../entities/exchange-rate.entity';
import type { WorkspaceExchangeRate } from '../../entities/workspace-exchange-rate.entity';

/** One point of a rate curve: the rate that applies from `date` onwards. */
export interface RatePoint {
  date: string;
  rate: number;
}

/** A quote on its way to becoming a curve point; `manual` decides precedence. */
interface RateCurveQuote {
  date: string;
  rate: number;
  manual: boolean;
}

/**
 * Every quote for the pair up to `toDate`, ascending, with the manual one
 * last inside a day so that it overwrites the provider's — the precedence
 * `getRateQuote` applies, expressed once for a whole window.
 */
export async function collectRateQuotes(
  exchangeRateRepository: Repository<ExchangeRate>,
  manual: { repository?: Repository<WorkspaceExchangeRate>; workspaceId: string } | undefined,
  normalizedFrom: string,
  normalizedTo: string,
  toDate: string,
): Promise<RateCurveQuote[]> {
  const onOrBefore = LessThanOrEqual(new Date(toDate));
  const order = { rateDate: 'ASC' as const };
  const pair = (base: string, target: string) => ({
    baseCurrency: base,
    targetCurrency: target,
    rateDate: onOrBefore,
  });

  const [direct, reverse] = await Promise.all([
    exchangeRateRepository.find({ where: pair(normalizedFrom, normalizedTo), order }),
    exchangeRateRepository.find({ where: pair(normalizedTo, normalizedFrom), order }),
  ]);
  // Reverse first: a direct quote for the same day is the one worth keeping.
  const quotes = [...toCurveQuotes(reverse, false, true), ...toCurveQuotes(direct, false, false)];

  if (manual?.repository) {
    const { repository, workspaceId } = manual;
    const [manualDirect, manualReverse] = await Promise.all([
      repository.find({ where: { workspaceId, ...pair(normalizedFrom, normalizedTo) }, order }),
      repository.find({ where: { workspaceId, ...pair(normalizedTo, normalizedFrom) }, order }),
    ]);
    quotes.push(
      ...toCurveQuotes(manualReverse, true, true),
      ...toCurveQuotes(manualDirect, true, false),
    );
  }

  return quotes.sort((a, b) => a.date.localeCompare(b.date) || Number(a.manual) - Number(b.manual));
}

/**
 * The quotes as a curve; everything before the window collapses into one
 * opening point. `fresh` is the quote for the last day, which may only exist
 * behind the network or the cache; one equal to the running rate adds nothing.
 */
export function foldRateCurve(
  quotes: RateCurveQuote[],
  fromDate: string,
  toDate: string,
  fresh: number | null,
): RatePoint[] {
  const curve: RatePoint[] = [];
  for (const quote of quotes) {
    const last = curve[curve.length - 1];
    if (last && last.date === quote.date) {
      last.rate = quote.rate;
    } else if (quote.date < fromDate) {
      curve.length = 0;
      curve.push({ date: fromDate, rate: quote.rate });
    } else {
      curve.push({ date: quote.date, rate: quote.rate });
    }
  }
  const last = curve[curve.length - 1];
  if (fresh !== null && fresh !== last?.rate) {
    if (last && last.date === toDate) {
      last.rate = fresh;
    } else {
      curve.push({ date: toDate, rate: fresh });
    }
  }
  return curve;
}

/** Rows as curve quotes, dropping anything that is not a usable rate. */
function toCurveQuotes(
  rows: Array<{ rateDate: Date | string; rate: number | string }>,
  manual: boolean,
  invert: boolean,
): RateCurveQuote[] {
  return rows
    .map(row => ({ date: toDateOnly(row.rateDate), rate: Number(row.rate), manual }))
    .filter(quote => Number.isFinite(quote.rate) && quote.rate > 0)
    .map(quote => (invert ? { ...quote, rate: 1 / quote.rate } : quote));
}

function toDateOnly(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}
