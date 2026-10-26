import type { Mock } from 'vitest';
import { BankName, FileType } from '@/entities/statement.entity';
import { BerekeBaseParser } from '@/modules/parsing/parsers/bereke-base.parser';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  extractTablesFromPdf,
  extractTextAndLayoutFromPdf,
  extractTextFromPdf,
} from '@/common/utils/pdf-parser.util';

vi.mock('@/common/utils/advanced-language-detector.util', () => ({
  advancedLanguageDetector: {
    detectLanguage: vi.fn().mockResolvedValue({
      locale: 'unknown',
      confidence: 0,
      method: 'legacy',
      reason: 'mock',
    }),
  },
}));

vi.mock('@/common/utils/pdf-parser.util', () => ({
  extractTextFromPdf: vi.fn(),
  extractTextAndLayoutFromPdf: vi.fn(),
  extractTablesFromPdf: vi.fn(),
}));

type TestColumnKey = 'date' | 'document' | 'counterparty' | 'bank' | 'debit' | 'credit' | 'purpose';

class TestBerekeParser extends BerekeBaseParser<TestColumnKey> {
  protected readonly parserName = 'TestBerekeParser';

  protected getSupportedBankName(): BankName {
    return BankName.BEREKE_NEW;
  }

  protected matchesBankText(text: string): boolean {
    return text.includes('bereke');
  }

  protected getBalanceStartLabels(): string[] {
    return ['Opening balance'];
  }

  protected getBalanceEndLabels(): string[] {
    return ['Closing balance'];
  }

  protected getDefaultMetadataDates(
    dateRange: { from: Date | null; to: Date | null },
    transactions: ParsedTransaction[],
  ): { from: Date; to: Date } {
    const inferred = this.inferDateRangeFromTransactions(transactions);
    const fallback = new Date('2024-01-31T00:00:00.000Z');

    return {
      from: dateRange.from || inferred.from || fallback,
      to: dateRange.to || inferred.to || dateRange.from || fallback,
    };
  }

  protected isHeaderRow(text: string): boolean {
    return text.toLowerCase().includes('header') || text.toLowerCase().includes('заголовок');
  }

  protected detectColumnKey(label: string): TestColumnKey | null {
    const lower = label.toLowerCase();
    if (lower.includes('date')) return 'date';
    if (lower.includes('document')) return 'document';
    if (lower.includes('counterparty')) return 'counterparty';
    if (lower.includes('bank')) return 'bank';
    if (lower.includes('debit')) return 'debit';
    if (lower.includes('credit')) return 'credit';
    if (lower.includes('purpose')) return 'purpose';
    return null;
  }

  protected getExpectedColumnOrder(): TestColumnKey[] {
    return ['date', 'document', 'counterparty', 'bank', 'debit', 'credit', 'purpose'];
  }

  protected createEmptyCells(): Record<TestColumnKey, string> {
    return {
      date: '',
      document: '',
      counterparty: '',
      bank: '',
      debit: '',
      credit: '',
      purpose: '',
    };
  }

  protected isEndOfTable(text: string): boolean {
    return text.toLowerCase().includes('totals') || text.toLowerCase().includes('итого');
  }

  protected resolveCounterpartyBlock(cells: Record<TestColumnKey, string>, combinedText: string): string {
    return cells.counterparty || combinedText;
  }

  protected resolveBankBlock(cells: Record<TestColumnKey, string>): string {
    return cells.bank || '';
  }
}

describe('BerekeBaseParser', () => {
  const parser = new TestBerekeParser();

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
    vi.clearAllMocks();
  });

  it('uses cached text in canParse and skips PDF extraction', async () => {
    const result = await parser.canParse(
      BankName.BEREKE_NEW,
      FileType.PDF,
      '/tmp/mock.pdf',
      'Bereke statement',
    );

    expect(result).toBe(true);
    expect(extractTextFromPdf).not.toHaveBeenCalled();
  });

  it('extracts counterparty details by removing BIN and account values', () => {
    expect(parser['extractCounterpartyDetails']('ТОО Acme 123456789012 KZ1234567890123456')).toEqual({
      name: 'ТОО Acme',
      bin: '123456789012',
      account: 'KZ1234567890123456',
    });
  });

  it('strips structural tokens from purpose text', () => {
    expect(
      parser['extractPurposeFromText'](
        '01.01.2026 DOC123456 ТОО Acme KZ1234567890123456 123456789012 1 200,00 Оплата услуг',
        'ТОО Acme',
      ),
    ).toBe('Оплата услуг');
  });

  it('falls back to a resolved organization name when counterparty is unknown', () => {
    expect(
      parser['resolveCounterpartyName'](
        'Не указано',
        'Оплата в ТОО Acme за услуги',
        '01.01.2026 Оплата в ТОО Acme за услуги',
      ),
    ).toBe('ТОО Acme за услуги');
  });

  it('infers metadata dates from extracted transactions when statement range is missing', async () => {
    const text = ['Bereke statement', 'Opening balance 1 000,00', 'Closing balance 2 500,00'].join('\n');

    (extractTextAndLayoutFromPdf as Mock).mockResolvedValue({
      text,
      rows: [
        { page: 1, y: 0, text: 'Header row', items: [] },
        {
          page: 1,
          y: 1,
          text: '15.02.2024 80000001 ТОО Ромашка BRKEKZKA 1 500,00 Payment',
          items: [],
        },
        {
          page: 1,
          y: 2,
          text: '20.02.2024 80000002 ТОО Лилия BRKEKZKA 2 000,00 Services',
          items: [],
        },
      ],
    });
    (extractTablesFromPdf as Mock).mockResolvedValue({ rowSets: [] });

    const result = await parser.parse('/tmp/mock.pdf');

    expect(result.metadata.balanceStart).toBe(1000);
    expect(result.metadata.balanceEnd).toBe(2500);
    expectDateParts(result.metadata.dateFrom, '2024-02-15');
    expectDateParts(result.metadata.dateTo, '2024-02-20');
  });

  it('preserves a legitimate zero opening balance instead of dropping it', async () => {
    const text = ['Bereke statement', 'Opening balance 0,00', 'Closing balance 500,00'].join('\n');

    (extractTextAndLayoutFromPdf as Mock).mockResolvedValue({ text, rows: [] });
    (extractTablesFromPdf as Mock).mockResolvedValue({ rowSets: [] });

    const result = await parser.parse('/tmp/mock.pdf');

    expect(result.metadata.balanceStart).toBe(0);
    expect(result.metadata.balanceEnd).toBe(500);
  });

  it('groups rows into transactions until the table footer', () => {
    const rows = [
      { text: '01.01.2026 Первая операция' },
      { text: 'Продолжение операции' },
      { text: '02.01.2026 Вторая операция' },
      { text: 'Итого обороты за период' },
      { text: '03.01.2026 Не должна попасть' },
    ];

    const result = parser.groupRowsIntoTransactions(rows as any);

    expect(result).toEqual([[rows[0], rows[1]], [rows[2]]]);
  });

  it('maps positioned items into cells using the configured boundaries', () => {
    const result = parser.extractCellsByColumn(
      [
        { x: 10, text: '01.01.2026' },
        { x: 120, text: 'DOC123456' },
        { x: 260, text: 'ТОО Acme' },
      ] as any,
      [
        { key: 'date', label: 'date', start: 0, end: 100, mid: 50 },
        { key: 'document', label: 'document', start: 100, end: 200, mid: 150 },
        { key: 'counterparty', label: 'counterparty', start: 200, end: 400, mid: 300 },
      ] as any,
    );

    expect(result).toEqual({
      date: '01.01.2026',
      document: 'DOC123456',
      counterparty: 'ТОО Acme',
      bank: '',
      debit: '',
      credit: '',
      purpose: '',
    });
  });

  it('infers the min and max transaction dates from valid rows', () => {
    const result = parser.inferDateRangeFromTransactions([
      {
        transactionDate: new Date('2026-01-03T00:00:00Z'),
        counterpartyName: 'Later',
        paymentPurpose: 'later',
      },
      {
        transactionDate: new Date('2026-01-01T00:00:00Z'),
        counterpartyName: 'Earlier',
        paymentPurpose: 'earlier',
      },
    ] as any);

    expect(result).toEqual({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-03T00:00:00Z'),
    });
  });

  it('ignores invalid dates when inferring a transaction range', () => {
    const result = parser.inferDateRangeFromTransactions([
      {
        transactionDate: new Date('invalid'),
        counterpartyName: 'Invalid',
        paymentPurpose: 'invalid',
      },
      {
        transactionDate: new Date('2026-01-02T00:00:00Z'),
        counterpartyName: 'Valid',
        paymentPurpose: 'valid',
      },
    ] as any);

    expect(result).toEqual({
      from: new Date('2026-01-02T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    });
  });

  it('extracts the first dd.mm.yyyy date from text', () => {
    expect(parser.extractFirstDate('Платеж от 03.01.2026 по документу 123456')).toBe('03.01.2026');
  });

  it('extracts a long document number after removing the date prefix', () => {
    expect(parser.extractDocumentNumber('03.01.2026 DOC 123456 для оплаты')).toBe('123456');
  });

  it('normalizes provided structured rows by trimming and collapsing whitespace', () => {
    const result = parser.prepareStructuredRows('ignored', [
      {
        page: 1,
        y: 10,
        text: '  01.01.2026   Платеж   ',
        items: [],
      },
    ] as any);

    expect(result).toEqual([
      {
        page: 1,
        y: 10,
        text: '01.01.2026 Платеж',
        items: [],
      },
    ]);
  });

  it('builds structured rows from plain text when layout rows are absent', () => {
    const result = parser.prepareStructuredRows('  Первая строка\n\n Вторая   строка ', []);

    expect(result).toEqual([
      {
        page: 1,
        y: 0,
        text: 'Первая строка',
        items: [],
      },
      {
        page: 1,
        y: 2,
        text: 'Вторая   строка',
        items: [],
      },
    ]);
  });

  it('prepares clean rows and slices data rows after the detected header', () => {
    const rows = [
      { page: 1, y: 0, text: '', items: [] },
      { page: 1, y: 1, text: 'Заголовок таблицы', items: [] },
      { page: 1, y: 2, text: '01.01.2026 Платеж', items: [] },
    ];

    const result = parser.prepareRowsForTransactionParsing(rows as any);

    expect(result.cleanRows).toEqual([rows[1], rows[2]]);
    expect(result.headerIndex).toBe(0);
    expect(result.dataRows).toEqual([rows[2]]);
  });

  it('uses all clean rows as data rows when no header is detected', () => {
    const rows = [{ page: 1, y: 2, text: '01.01.2026 Платеж', items: [] }];

    const result = parser.prepareRowsForTransactionParsing(rows as any);

    expect(result.headerIndex).toBe(-1);
    expect(result.cleanRows).toEqual(rows);
    expect(result.dataRows).toEqual(rows);
  });

  it('collects successfully parsed transaction groups', () => {
    const groups = [[{ text: 'group-1' }], [{ text: 'group-2' }]];
    const parseGroup = vi
      .fn()
      .mockReturnValueOnce({
        transactionDate: new Date('2026-01-01T00:00:00Z'),
        counterpartyName: 'Tx 1',
        paymentPurpose: 'first',
      })
      .mockReturnValueOnce(null);

    const result = parser.collectParsedTransactions(groups as any, undefined, parseGroup);

    expect(parseGroup).toHaveBeenCalledTimes(2);
    expect(result.groupsDetected).toBe(2);
    expect(result.transactions).toEqual([
      {
        transactionDate: new Date('2026-01-01T00:00:00Z'),
        counterpartyName: 'Tx 1',
        paymentPurpose: 'first',
      },
    ]);
  });

  it('invokes collector callbacks while parsing groups in a single pass', () => {
    const groups = [[{ text: 'ok-group' }], [{ text: 'bad-group' }]];
    const parseGroup = vi
      .fn()
      .mockReturnValueOnce({
        transactionDate: new Date('2026-01-01T00:00:00Z'),
        counterpartyName: 'Tx 1',
        paymentPurpose: 'first',
      })
      .mockReturnValueOnce(null);
    const onParsed = vi.fn();
    const onFailed = vi.fn();

    parser.collectParsedTransactions(groups as any, undefined, parseGroup, { onParsed, onFailed });

    expect(parseGroup).toHaveBeenCalledTimes(2);
    expect(onParsed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith(groups[1], 1);
  });
});
