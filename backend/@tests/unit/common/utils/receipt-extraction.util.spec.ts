import {
  buildCurrencyTokenPattern,
  extractLineItemsFromLines,
  extractAmountFragments,
  escapeRegex,
  isAddressLike,
  isDateRangeLike,
  isLikelySentence,
  isYearLikeAmount,
  lineItemsReconcile,
  scoreAmountCandidate,
  shouldSkipLineItem,
} from '@/common/utils/receipt-extraction.util';

describe('receipt-extraction util', () => {
  it('detects sentence-like descriptions', () => {
    expect(isLikelySentence('Thanks for your purchase!')).toBe(true);
    expect(isLikelySentence('GitHub Actions')).toBe(false);
  });

  it('detects date range and address-like descriptions', () => {
    expect(isDateRangeLike('Feb 27, 2026 - Mar 15, 2026')).toBe(true);
    expect(isDateRangeLike('GitHub Actions')).toBe(false);
    expect(isAddressLike('San Francisco, CA 94107')).toBe(true);
    expect(isAddressLike('Claude subscription')).toBe(false);
  });

  it('treats plain year-like amounts as invalid line item values unless currency is explicit', () => {
    expect(isYearLikeAmount(2026, false)).toBe(true);
    expect(isYearLikeAmount(2026, true)).toBe(false);
  });

  it('extracts currency and total fragments from line text', () => {
    const fragments = extractAmountFragments('Amount Due: $1,234.56', true, '(?:\\$|USD)');

    expect(fragments).toEqual(['$1,234.56', '1,234.56']);
  });

  it('scores total lines with explicit currency above neutral candidates', () => {
    const neutral = scoreAmountCandidate(100, false, false, 0, 5);
    const total = scoreAmountCandidate(100, true, true, 4, 5);

    expect(total).toBeGreaterThan(neutral);
  });

  it('combines the guards for line-item filtering', () => {
    expect(shouldSkipLineItem('Thanks for your purchase!', 202.0, false)).toBe(true);
    expect(shouldSkipLineItem('GitHub Actions', 10.0, false)).toBe(false);
  });

  it('escapes regex special characters for currency symbols', () => {
    expect(escapeRegex('A+B?')).toBe('A\\+B\\?');
  });

  it('builds a currency token pattern from symbols and codes', () => {
    expect(buildCurrencyTokenPattern(['$', 'A+B'], ['USD', 'KZT'])).toBe(
      '(?:A\\+B|\\$|USD|KZT)',
    );
  });

  it('extracts line items with configurable tax-line skipping', async () => {
    const result = await extractLineItemsFromLines({
      lines: ['Service Fee 10.00', 'Tax 1.00', 'Total 11.00'],
      currencyTokenPattern: '(?:USD|\\$)',
      numberPattern: '-?\\d+(?:[.,]\\d{1,2})?',
      hasTotalKeyword: line => /total/i.test(line),
      isTaxLine: line => /tax/i.test(line),
      parseAmountFragment: async fragment => ({
        amount: Number(fragment.replace(/[^\d.]/g, '')),
      }),
      extractCurrency: () => undefined,
      skipTaxLines: true,
    });

    expect(result).toEqual([{ description: 'Service Fee', amount: 10 }]);
  });
});

describe('lineItemsReconcile', () => {
  const items = (...amounts: number[]) => amounts.map(amount => ({ amount }));

  it('accepts items that add up to the total, the subtotal or the total less tax', () => {
    expect(lineItemsReconcile(items(10, 20.49), { totalAmount: 30.49 })).toBe(true);
    expect(lineItemsReconcile(items(40), { totalAmount: 47.6, subtotal: 40 })).toBe(true);
    expect(lineItemsReconcile(items(40), { totalAmount: 47.6, tax: 7.6 })).toBe(true);
  });

  it('allows 5% for rounding and a tip, not more', () => {
    expect(lineItemsReconcile(items(100), { totalAmount: 104.9 })).toBe(true);
    expect(lineItemsReconcile(items(100), { totalAmount: 106 })).toBe(false);
  });

  it('rejects page numbers, dates and postcodes read as prices', () => {
    // What a Railway invoice yielded: "Page 1 of 2", "June 13, 202", "PMB 689", a ZIP.
    expect(lineItemsReconcile(items(2, 202, 202, 689, 941), { totalAmount: 14.63 })).toBe(false);
  });

  it('cannot confirm anything without a figure to compare against', () => {
    expect(lineItemsReconcile(items(10, 20), {})).toBe(false);
    expect(lineItemsReconcile([], { totalAmount: 30 })).toBe(false);
  });
});

