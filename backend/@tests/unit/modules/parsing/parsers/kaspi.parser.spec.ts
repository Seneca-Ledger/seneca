import { extractTablesFromPdf, extractTextFromPdf } from '@/common/utils/pdf-parser.util';
import { BankName, FileType } from '@/entities/statement.entity';
import { KaspiParser } from '@/modules/parsing/parsers/kaspi.parser';

jest.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: jest.fn().mockResolvedValue({
      locale: 'unknown',
      confidence: 0,
      method: 'legacy',
      reason: 'mock',
    }),
  },
}));

jest.mock('@/common/utils/pdf-parser.util', () => ({
  extractTextFromPdf: jest.fn(),
  extractTablesFromPdf: jest.fn(),
}));

describe('KaspiParser', () => {
  const expectDateParts = (date: Date | null | undefined, expected: string) => {
    expect(date).toBeInstanceOf(Date);
    if (!date) {
      return;
    }
    const [year, month, day] = expected.split('-').map(Number);
    expect(date.getFullYear()).toBe(year);
    expect(date.getMonth() + 1).toBe(month);
    expect(date.getDate()).toBe(day);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canParse', () => {
    it('returns true for Kaspi PDF content', async () => {
      const parser = new KaspiParser();
      const result = await parser.canParse(
        BankName.KASPI,
        FileType.PDF,
        '/tmp/mock.pdf',
        'Kaspi Bank statement',
      );

      expect(result).toBe(true);
    });

    it('returns false for non-PDF files', async () => {
      const parser = new KaspiParser();
      const result = await parser.canParse(
        BankName.KASPI,
        FileType.XLSX,
        '/tmp/mock.xlsx',
        'Kaspi Bank statement',
      );

      expect(result).toBe(false);
      expect(extractTextFromPdf).not.toHaveBeenCalled();
    });
  });

  describe('extractBalancesFromText', () => {
    it('extracts balances with spaces', () => {
      const parser = new KaspiParser();
      const text = 'Входящий остаток 1 234 567,89 Исходящий остаток 9 876 543,21';

      const balances = (parser as any).extractBalancesFromText(text);

      expect(balances).toEqual({ start: 1234567.89, end: 9876543.21 });
    });

    it('extracts balances without spaces', () => {
      const parser = new KaspiParser();
      const text = 'Входящий остаток 1234567,89 Исходящий остаток 9876543,21';

      const balances = (parser as any).extractBalancesFromText(text);

      expect(balances).toEqual({ start: 1234567.89, end: 9876543.21 });
    });

    it('extracts balances with colon', () => {
      const parser = new KaspiParser();
      const text = 'Входящий остаток: 1 234,50 Исходящий остаток: 9 876,25';

      const balances = (parser as any).extractBalancesFromText(text);

      expect(balances).toEqual({ start: 1234.5, end: 9876.25 });
    });

    it('returns nulls when balances are missing', () => {
      const parser = new KaspiParser();
      const text = 'Входящий остаток Исходящий остаток';

      const balances = (parser as any).extractBalancesFromText(text);

      expect(balances).toEqual({ start: null, end: null });
    });
  });

  describe('extractPeriodFromText', () => {
    it('extracts date range', () => {
      const parser = new KaspiParser();
      const text = 'Период: 01.01.2024 - 31.01.2024';

      const period = (parser as any).extractPeriodFromText(text);

      expectDateParts(period.from, '2024-01-01');
      expectDateParts(period.to, '2024-01-31');
    });

    it('extracts single date period', () => {
      const parser = new KaspiParser();
      const text = 'Период: 15.02.2024';

      const period = (parser as any).extractPeriodFromText(text);

      expectDateParts(period.from, '2024-02-15');
      expectDateParts(period.to, '2024-02-15');
    });

    it('extracts period range using phrasing', () => {
      const parser = new KaspiParser();
      const text = 'Отчет за период с 05.03.2024 по 20.03.2024';

      const period = (parser as any).extractPeriodFromText(text);

      expectDateParts(period.from, '2024-03-05');
      expectDateParts(period.to, '2024-03-20');
    });
  });

  describe('extractKaspiAccountNumber', () => {
    it('extracts Kaspi account number', () => {
      const parser = new KaspiParser();
      const text = 'Счет клиента KZ12722S123456789012';

      const accountNumber = (parser as any).extractKaspiAccountNumber(text);

      expect(accountNumber).toBe('KZ12722S123456789012');
    });

    it('returns null when account number is missing', () => {
      const parser = new KaspiParser();
      const text = 'Счет клиента отсутствует';

      const accountNumber = (parser as any).extractKaspiAccountNumber(text);

      expect(accountNumber).toBeNull();
    });
  });

  describe('parse', () => {
    it('parses basic statement with text and empty tables', async () => {
      const parser = new KaspiParser();
      const text = [
        'Kaspi Bank',
        'Период: 01.01.2024 - 31.01.2024',
        'Входящий остаток 1 000,00',
        'Исходящий остаток 2 000,00',
        'KZ12722S123456789012',
        '80000001',
        '01.01.2024',
        '1 500,00',
        'ТОО Ромашка БИН/ИИН 123456789012',
        'KZ127220000000000000',
        'KZKOKZKX',
        '101',
        'Оплата услуг',
      ].join('\n');

      (extractTextFromPdf as jest.Mock).mockResolvedValue(text);
      (extractTablesFromPdf as jest.Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.metadata.accountNumber).toBe('KZ12722S123456789012');
      expect(result.metadata.balanceStart).toBe(1000);
      expect(result.metadata.balanceEnd).toBe(2000);
      expectDateParts(result.metadata.dateFrom, '2024-01-01');
      expectDateParts(result.metadata.dateTo, '2024-01-31');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        documentNumber: '80000001',
        counterpartyName: 'ТОО Ромашка',
        counterpartyBin: '123456789012',
        counterpartyAccount: 'KZ127220000000000000',
        counterpartyBank: 'KZKOKZKX',
        debit: 1500,
        paymentPurpose: 'ТОО Ромашка БИН/ИИН 123456789012 Оплата услуг',
        currency: 'KZT',
      });
    });

    it('classifies an incoming transfer as credit, not debit, in the text fallback path', async () => {
      const parser = new KaspiParser();
      const text = [
        'Kaspi Bank',
        'Период: 01.01.2024 - 31.01.2024',
        'Входящий остаток 1 000,00',
        'Исходящий остаток 2 500,00',
        'KZ12722S123456789012',
        '80000002',
        '02.01.2024',
        '1 500,00',
        'ТОО Ромашка БИН/ИИН 123456789012',
        'KZ127220000000000000',
        'KZKOKZKX',
        '101',
        'Зачисление перевода',
      ].join('\n');

      (extractTextFromPdf as jest.Mock).mockResolvedValue(text);
      (extractTablesFromPdf as jest.Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        debit: undefined,
        credit: 1500,
      });
    });

    it('keeps an outgoing mobile-balance top-up as debit despite containing "Пополнение"', async () => {
      const parser = new KaspiParser();
      const text = [
        'Kaspi Bank',
        'Период: 01.01.2024 - 31.01.2024',
        'Входящий остаток 1 000,00',
        'Исходящий остаток 500,00',
        'KZ12722S123456789012',
        '80000003',
        '03.01.2024',
        '500,00',
        'Пополнение баланса телефона',
      ].join('\n');

      (extractTextFromPdf as jest.Mock).mockResolvedValue(text);
      (extractTablesFromPdf as jest.Mock).mockResolvedValue({ rowSets: [] });

      const result = await parser.parse('/tmp/mock.pdf');

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0]).toMatchObject({
        debit: 500,
        credit: undefined,
      });
    });
  });
});
