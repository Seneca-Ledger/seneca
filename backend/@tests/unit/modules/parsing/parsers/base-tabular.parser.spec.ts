import { appDefaultCurrency } from '@/common/utils/currency.util';
import { BaseTabularParser } from '@/modules/parsing/parsers/base-tabular.parser';

class TestTabularParser extends BaseTabularParser {
  async canParse() {
    return true;
  }

  async parse() {
    throw new Error('not implemented');
  }
}

describe('BaseTabularParser', () => {
  const parser = new TestTabularParser();

  it('maps tabular headers into semantic columns', () => {
    const mapping = parser['mapColumns']([
      'Дата',
      'Документ',
      'Контрагент',
      'БИН',
      'Счет',
      'Банк',
      'Дебет',
      'Кредит',
      'Назначение',
    ]);

    expect(mapping).toEqual({
      date: 0,
      document: 1,
      counterparty: 2,
      bin: 3,
      account: 4,
      bank: 5,
      debit: 6,
      credit: 7,
      purpose: 8,
    });
  });

  it('keeps the first matching column when two headers match the same category (regression)', () => {
    // "Сумма операции" (transaction amount) and "Сумма в валюте счета"
    // (converted amount) both contain "сумма" — the primary, left-most
    // column must win rather than the secondary one silently overwriting it.
    const mapping = parser['mapColumns']([
      'Дата',
      'Сумма операции',
      'Счет',
      'Сумма в валюте счета',
    ]);

    expect(mapping.amount).toBe(1);
  });

  it('parses row values into ParsedTransaction', () => {
    const transaction = parser['parseRow'](
      ['2026-01-15', 'DOC-1', 'Acme', '123456789012', 'KZ123', 'HSBK', '1200.50', '', 'Invoice payment'],
      {
        date: 0,
        document: 1,
        counterparty: 2,
        bin: 3,
        account: 4,
        bank: 5,
        debit: 6,
        credit: 7,
        purpose: 8,
      },
      index => ['2026-01-15', 'DOC-1', 'Acme', '123456789012', 'KZ123', 'HSBK', '1200.50', '', 'Invoice payment'][index],
    );

    expect(transaction).toMatchObject({
      documentNumber: 'DOC-1',
      counterpartyName: 'Acme',
      counterpartyBin: '123456789012',
      counterpartyAccount: 'KZ123',
      counterpartyBank: 'HSBK',
      debit: 1200.5,
      credit: undefined,
      paymentPurpose: 'Invoice payment',
      currency: appDefaultCurrency(),
    });
  });

  it('maps a single "Сумма" header to the amount column', () => {
    const mapping = parser['mapColumns'](['Дата', 'Категория', 'Сумма']);
    expect(mapping).toEqual({ date: 0, amount: 2 });
  });

  it('maps a single "Amount" header to the amount column', () => {
    const mapping = parser['mapColumns'](['Date', 'Category', 'Amount']);
    expect(mapping).toEqual({ date: 0, amount: 2 });
  });

  describe('single signed amount column (no separate debit/credit)', () => {
    const columnMapping = { date: 0, amount: 1 };

    it('treats a negative amount as debit (expense)', () => {
      const row = ['2026-01-15', '-1500.00'];
      const transaction = parser['parseRow'](row, columnMapping, index => row[index]);

      expect(transaction).toMatchObject({ debit: 1500, credit: undefined });
    });

    it('treats a positive amount as credit (income)', () => {
      const row = ['2026-01-15', '2500.75'];
      const transaction = parser['parseRow'](row, columnMapping, index => row[index]);

      expect(transaction).toMatchObject({ debit: undefined, credit: 2500.75 });
    });

    it('does not derive debit/credit from amount when explicit debit/credit columns exist', () => {
      const row = ['2026-01-15', '-999', '100.00', ''];
      const transaction = parser['parseRow'](
        row,
        { date: 0, amount: 1, debit: 2, credit: 3 },
        index => row[index],
      );

      // Separate debit/credit columns take priority over the signed amount.
      expect(transaction).toMatchObject({ debit: 100, credit: undefined });
    });
  });
});
