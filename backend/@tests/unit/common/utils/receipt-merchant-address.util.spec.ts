import {
  extractMerchantAddress,
  normalizeMerchantAddress,
} from '@/common/utils/receipt-extraction.util';

describe('extractMerchantAddress', () => {
  it('finds a CIS street address in the receipt header', () => {
    const lines = [
      'ТОО "Magnum Cash&Carry"',
      'БИН 123456789012',
      'г. Алматы, ул. Абая 10',
      'Кассовый чек',
      'ИТОГО 4590',
    ];

    expect(extractMerchantAddress(lines)).toBe('г. Алматы, ул. Абая 10');
  });

  it('strips the address label and collapses spacing', () => {
    expect(extractMerchantAddress(['Кофейня', 'Адрес:  пр. Достык   5'])).toBe('пр. Достык 5');
  });

  it('still recognises US addresses', () => {
    expect(extractMerchantAddress(['Store ABC', '123 Main St, Springfield, IL 62701'])).toBe(
      '123 Main St, Springfield, IL 62701',
    );
  });

  it('skips totals, dates and phone lines', () => {
    expect(
      extractMerchantAddress(['ИТОГО 4590', 'Дата: 12.03.2026 д. 1', 'Тел: +7 727 000 00 10']),
    ).toBeUndefined();
  });

  it('needs a house number', () => {
    expect(extractMerchantAddress(['ул. Абая'])).toBeUndefined();
  });

  it('does not match keywords inside ordinary words', () => {
    expect(extractMerchantAddress(['Молоко домашнее 450', 'Продукты 2 шт'])).toBeUndefined();
  });

  it('only looks at the header', () => {
    const lines = [...Array.from({ length: 12 }, (_, index) => `Товар ${index}`), 'ул. Абая 10'];

    expect(extractMerchantAddress(lines)).toBeUndefined();
  });
});

describe('normalizeMerchantAddress', () => {
  it('accepts only non-empty strings', () => {
    expect(normalizeMerchantAddress(42)).toBeUndefined();
    expect(normalizeMerchantAddress('   ')).toBeUndefined();
    expect(normalizeMerchantAddress(' ул.\n Абая  10 ')).toBe('ул. Абая 10');
  });

  it('caps runaway model output', () => {
    expect(normalizeMerchantAddress('a'.repeat(500))).toHaveLength(300);
  });
});
