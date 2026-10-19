import { type BdiRates, referenceRateFor } from '@/modules/income-tax/bdi-rates.service';

const rates: BdiRates = {
  daily: [
    { date: '2025-03-06', perEuro: 1.078 },
    { date: '2025-03-07', perEuro: 1.0833 },
    { date: '2025-03-10', perEuro: 1.0827 },
    { date: '2025-03-28', perEuro: 1.08 },
  ],
  monthly: { '2025-03': 1.0807 },
};

describe("Banca d'Italia reference rate", () => {
  it('uses the rate of the transaction day when one was fixed', () => {
    expect(referenceRateFor(rates, '2025-03-10')).toEqual({
      perEuro: 1.0827,
      rateDate: '2025-03-10',
    });
  });

  it('falls back to the nearest earlier day over a weekend', () => {
    expect(referenceRateFor(rates, '2025-03-09')).toEqual({
      perEuro: 1.0833,
      rateDate: '2025-03-07',
    });
  });

  it('uses the monthly average when no rate was fixed around the day', () => {
    expect(referenceRateFor(rates, '2025-03-25')).toEqual({ perEuro: 1.0807, rateDate: '2025-03' });
  });

  it('returns null when there is neither a daily rate nor a monthly average', () => {
    expect(referenceRateFor({ daily: [], monthly: {} }, '2025-03-10')).toBeNull();
  });
});
