import {
  getExcludedColumnIndexes,
  mapPdfTableRowsToTransactions,
  pickReconciledTransactions,
} from '@/modules/parsing/helpers/pdf-table.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';

describe('pdf-table.helper', () => {
  it('collects excluded column indexes for the provided keys', () => {
    expect(
      getExcludedColumnIndexes(
        {
          date: 0,
          document: 1,
          debit: 5,
          credit: 6,
          purpose: 7,
        },
        ['date', 'document', 'debit', 'credit', 'purpose'],
      ),
    ).toEqual(new Set([0, 1, 5, 6, 7]));
  });

  it('maps debit and credit by their header labels instead of numeric column order', () => {
    const transactions = mapPdfTableRowsToTransactions([
      ['Назначение', 'Кредит', 'Дата', 'Контрагент', 'Дебет', 'Номер'],
      ['Оплата услуг', '', '05.01.2024', 'Поставщик', '1 250,50', 'DOC-1'],
      ['Возврат', '300,00', '06.01.2024', 'Клиент', '', 'DOC-2'],
    ]);

    expect(transactions).toEqual([
      expect.objectContaining({
        documentNumber: 'DOC-1',
        debit: 1250.5,
        credit: undefined,
        counterpartyName: 'Поставщик',
        paymentPurpose: 'Оплата услуг',
      }),
      expect.objectContaining({
        documentNumber: 'DOC-2',
        debit: undefined,
        credit: 300,
        counterpartyName: 'Клиент',
        paymentPurpose: 'Возврат',
      }),
    ]);
  });

  it('skips the "1 2 3 … 9" column-numbering row under the header', () => {
    const transactions = mapPdfTableRowsToTransactions([
      ['Номер документа', 'Дата операции', 'Дебет', 'Кредит', 'Назначение платежа'],
      ['1', '2', '3', '4', '5'],
      ['84093716', '25.11.2025 23:59:59', '200', '', 'Бонусы'],
    ]);

    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toEqual(expect.objectContaining({ documentNumber: '84093716', debit: 200 }));
  });

  it('takes the BIN from the cell that starts with it, not from a purpose quoting one', () => {
    const transactions = mapPdfTableRowsToTransactions([
      ['Дата', 'Номер', 'Наименование', 'Реквизиты', 'Дебет', 'Кредит', 'Назначение платежа'],
      [
        '27.11.2025 09:24',
        '7343263',
        'АО "Bereke Bank"',
        'БИН: 051041002766 KZ33914044601KZ0028P',
        '385,12',
        '',
        'Внешний перевод, ИП Памир, БИН 620504499044',
      ],
      [
        '27.11.2025 16:24',
        '7343683',
        'АО "Bereke Bank"',
        'БИН: 051041002766 KZ33914044601KZ0028P',
        '400,00',
        '',
        'Внешний перевод, ИП Памир, БИН 620504499044',
      ],
    ]);

    expect(transactions[0]).toEqual(
      expect.objectContaining({
        counterpartyBin: '051041002766',
        counterpartyAccount: 'KZ33914044601KZ0028P',
        paymentPurpose: 'Внешний перевод, ИП Памир, БИН 620504499044',
      }),
    );
  });
});

describe('pickReconciledTransactions', () => {
  const tx = (debit?: number, credit?: number) =>
    ({ transactionDate: new Date(2025, 0, 1), debit, credit }) as ParsedTransaction;

  it('picks the attempt that carries the opening balance to the closing one', () => {
    const misread = [tx(100), tx(3, 4)];
    const correct = [tx(100), tx(undefined, 50)];

    expect(pickReconciledTransactions([misread, correct], 1000, 950)).toBe(correct);
  });

  it('never unions attempts: without a reconciling one the first non-empty wins', () => {
    const first = [tx(100)];
    const second = [tx(100), tx(7)];

    expect(pickReconciledTransactions([[], first, second], 1000, 1)).toBe(first);
    expect(pickReconciledTransactions([[], first, second], null, null)).toBe(first);
    expect(pickReconciledTransactions([[], []], 1000, 900)).toEqual([]);
  });
});
