import type { Repository } from 'typeorm';
import type { Transaction } from '../../entities/transaction.entity';
import type { RateQuote, RateQuoteOptions } from './exchange-rates.service';

export interface CurrencyCoverage {
  currency: string;
  rate: number | null;
  rateDate: string | null;
  stale: boolean;
  rows: number;
}

/**
 * Every currency the workspace's rows carry, with whether a rate to the
 * workspace currency exists. The dashboard and reports convert at 1.0 when
 * none does; this is where that becomes visible instead of silent.
 */
export async function currencyCoverage(
  transactionRepository: Repository<Transaction>,
  rates: {
    getRateQuote(
      from: string,
      to: string,
      date: Date,
      options: RateQuoteOptions,
    ): Promise<RateQuote | null>;
  },
  input: {
    workspaceId: string;
    target: string;
    sinceDays: number;
    normalize: (code: string) => string;
  },
): Promise<CurrencyCoverage[]> {
  const { workspaceId, target, sinceDays, normalize } = input;
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const rows = await transactionRepository
    .createQueryBuilder('t')
    .select('UPPER(t.currency)', 'currency')
    .addSelect('COUNT(*)', 'rows')
    .where('t.workspaceId = :workspaceId', { workspaceId })
    .andWhere('t.transactionDate >= :since', { since })
    .andWhere('t.currency IS NOT NULL')
    .groupBy('UPPER(t.currency)')
    .getRawMany<{ currency: string; rows: string }>();
  const result: CurrencyCoverage[] = [];
  for (const row of rows) {
    const currency = normalize(row.currency);
    if (currency === target) {
      continue;
    }
    const quote = await rates.getRateQuote(currency, target, new Date(), { workspaceId });
    result.push({
      currency,
      rate: quote?.rate ?? null,
      rateDate: quote?.rateDate ?? null,
      stale: quote?.stale ?? false,
      rows: Number(row.rows),
    });
  }
  return result.sort(
    (a, b) => Number(a.rate !== null) - Number(b.rate !== null) || b.rows - a.rows,
  );
}
