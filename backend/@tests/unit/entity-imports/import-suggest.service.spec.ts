import { ImportSuggestService } from '../../../src/modules/entity-imports/import-suggest.service';
import {
  parseImportBoolean,
  parseImportDate,
  parseImportNumber,
} from '../../../src/modules/entity-imports/helpers/import-values';
import { headerMatchScore, resolveEnumAlias } from '../../../src/modules/entity-imports/target-aliases';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';

describe('ImportSuggestService (heuristics only)', () => {
  const service = new ImportSuggestService();

  it('recognises a payables sheet and maps vendor, amount and due date', async () => {
    const result = await service.suggest(WORKSPACE_ID, {
      headers: ['Vendor', 'Amount', 'Due date', 'Status', 'Comment'],
      samples: [
        ['Electric Co', '120.50', '2026-10-15', 'unpaid', 'october'],
        ['Landlord', '1 500', '2026-10-01', 'paid', ''],
      ],
    });
    expect(result.target).toBe('payables');
    expect(result.source).toBe('heuristic');
    const roles = Object.fromEntries(result.columns.map(c => [c.index, c.role]));
    expect(roles).toMatchObject({ 0: 'vendor', 1: 'amount', 2: 'dueDate', 3: 'status', 4: 'comment' });
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('recognises a Russian subscriptions sheet', async () => {
    const result = await service.suggest(WORKSPACE_ID, {
      headers: ['Подписка', 'Сумма, ₸', 'Периодичность', 'Следующее списание'],
      samples: [
        ['Netflix', '4 990 ₸', 'ежемесячно', '05.10.2026'],
        ['Spotify', '1 690', 'месяц', '12.10.2026'],
      ],
    });
    expect(result.target).toBe('subscriptions');
    const roles = Object.fromEntries(result.columns.map(c => [c.index, c.role]));
    expect(roles).toMatchObject({ 0: 'vendorName', 1: 'amount', 2: 'frequency', 3: 'nextChargeDate' });
  });

  it('recognises bank-like rows as transactions', async () => {
    const result = await service.suggest(WORKSPACE_ID, {
      headers: ['Date', 'Merchant', 'Amount', 'Category'],
      samples: [
        ['2026-09-01', 'Coffee shop', '-4.50', 'Food'],
        ['2026-09-02', 'Salary', '3000', 'Income'],
      ],
    });
    expect(result.target).toBe('transactions');
  });

  it('falls back to a plain table when required fields are missing', async () => {
    const result = await service.suggest(WORKSPACE_ID, {
      headers: ['Project', 'Owner', 'Notes'],
      samples: [['Site redesign', 'Anna', 'started']],
    });
    expect(result.target).toBe('table');
    expect(result.columns.every(c => c.role === null)).toBe(true);
  });

  it('does not map a text column onto a number field', async () => {
    const result = await service.suggest(WORKSPACE_ID, {
      headers: ['Category', 'Limit', 'Period'],
      samples: [
        ['Food', 'a lot', 'monthly'],
        ['Rent', 'unknown', 'monthly'],
      ],
    });
    expect(result.target).toBe('table');
  });
});

describe('aliases and value parsers', () => {
  it('scores exact and partial header matches', () => {
    expect(headerMatchScore('Due Date', ['due date'])).toBe(1);
    expect(headerMatchScore('Срок оплаты (дн.)', ['срок оплаты'])).toBe(0.7);
    expect(headerMatchScore('Amount', ['date'])).toBe(0);
  });

  it('resolves enum aliases in several languages', () => {
    expect(resolveEnumAlias('frequency', 'Ежемесячно')).toBe('monthly');
    expect(resolveEnumAlias('frequency', 'yearly')).toBe('annual');
    expect(resolveEnumAlias('status', 'не оплачен')).toBe('to_pay');
    expect(resolveEnumAlias('type', 'credit')).toBe('income');
    expect(resolveEnumAlias('type', 'whatever')).toBeNull();
  });

  it('parses numbers with currency symbols and codes', () => {
    expect(parseImportNumber('1 500,50 ₸')).toEqual({ value: 1500.5, currency: 'KZT' });
    expect(parseImportNumber('$1,234.00')).toEqual({ value: 1234, currency: 'USD' });
    expect(parseImportNumber('120 EUR')).toEqual({ value: 120, currency: 'EUR' });
    expect(parseImportNumber('(100)').value).toBe(-100);
    expect(parseImportNumber('n/a').value).toBeNull();
  });

  it('parses ISO, European and Excel-serial dates', () => {
    expect(parseImportDate('2026-10-05')).toBe('2026-10-05');
    expect(parseImportDate('05.10.2026')).toBe('2026-10-05');
    expect(parseImportDate('46300')).toBe('2026-10-05');
    expect(parseImportDate('1500')).toBeNull();
    expect(parseImportDate('hello')).toBeNull();
  });

  it('parses booleans', () => {
    expect(parseImportBoolean('да')).toBe(true);
    expect(parseImportBoolean('no')).toBe(false);
    expect(parseImportBoolean('maybe')).toBeNull();
  });
});
