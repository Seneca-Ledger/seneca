/** Amounts added up per currency (upper-cased); zero and negative amounts are skipped. */
export class CurrencyTotals {
  private readonly amounts = new Map<string, number>();

  add(currency: string, amount: number): void {
    if (amount <= 0) return;
    const code = currency.toUpperCase();
    this.amounts.set(code, (this.amounts.get(code) ?? 0) + amount);
  }

  /** Rounded to cents, largest first. */
  list(): Array<{ currency: string; amount: number }> {
    return [...this.amounts]
      .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  }
}
