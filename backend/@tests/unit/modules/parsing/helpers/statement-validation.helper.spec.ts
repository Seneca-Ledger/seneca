import { validateParsedStatement } from '@/modules/parsing/helpers/statement-validation.helper';
import type { ParsedTransaction } from '@/modules/parsing/interfaces/parsed-statement.interface';

const row = (amounts: Partial<ParsedTransaction>): ParsedTransaction => ({
  transactionDate: new Date(2025, 0, 2),
  counterpartyName: 'ACME Store',
  paymentPurpose: 'ACME Store',
  currency: 'USD',
  ...amounts,
});

const rows = [row({ credit: 200 }), row({ debit: 100 })];
const balances = { balanceStart: 1000, balanceEnd: 1100 };

describe('validateParsedStatement', () => {
  it('passes a statement that reconciles and whose checks passed', () => {
    const result = validateParsedStatement(balances, rows, {
      tolerance: 0.01,
      dropInfo: { rawCount: 2, droppedCount: 0 },
      checks: [{ code: 'balance_chain', passed: true }],
    });
    expect(result).toMatchObject({ passed: true, warnings: [], reasonCodes: [] });
  });

  it('gives each failed check a reason code and a warning saying where', () => {
    const result = validateParsedStatement(balances, rows, {
      tolerance: 0.01,
      checks: [
        { code: 'balance_chain', passed: false, detail: { row: 3, date: '04/01', expected: 1110, actual: 1050 } },
        { code: 'printed_totals', passed: false, detail: { side: 'debits', expected: 50.25, actual: 50 } },
        { code: 'section_totals', passed: false, detail: { side: 'credits', expected: 100, actual: 90 } },
        { code: 'printed_balances', passed: false, detail: { side: 'end', expected: 900, actual: 950 } },
        { code: 'dates_in_period', passed: false, detail: { row: 2, date: '2026-02-04' } },
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.reasonCodes).toEqual([
      'balance_chain',
      'printed_totals',
      'section_totals',
      'printed_balances',
      'dates_in_period',
    ]);
    expect(result.warnings).toEqual([
      'Balance chain broken at row 3 (04/01): expected 1110.00 got 1050.00',
      'Printed totals mismatch: debits expected 50.25 got 50.00',
      'Section total mismatch: credits expected 100.00 got 90.00',
      'Printed balance mismatch: end expected 900.00 got 950.00',
      'Row 2 dated 2026-02-04 falls outside the statement period',
    ]);
  });

  it('names a balance that does not reconcile and rows lost to validation', () => {
    expect(
      validateParsedStatement({ balanceStart: 1000, balanceEnd: 1500 }, rows, { tolerance: 0.01 })
        .reasonCodes,
    ).toEqual(['balance_mismatch']);
    const dropInfo = (rawCount: number, droppedCount: number) => ({ rawCount, droppedCount });
    const codes = (kept: ParsedTransaction[], info: { rawCount: number; droppedCount: number }, meta = balances) =>
      validateParsedStatement(meta, kept, { tolerance: 0.01, dropInfo: info }).reasonCodes;
    expect(codes([], dropInfo(3, 3), {} as typeof balances)).toEqual(['no_rows_kept']);
    expect(codes([row({ credit: 100 })], dropInfo(3, 2), { balanceStart: 1000, balanceEnd: 1100 })).toEqual([
      'rows_dropped',
    ]);
    expect(codes([], dropInfo(0, 0), { balanceStart: 1000 } as typeof balances)).toEqual([
      'nothing_extracted',
    ]);
  });

  it('does not reconcile rows in several currencies', () => {
    const mixed = [row({ credit: 200 }), row({ debit: 100, currency: 'EUR' })];
    expect(validateParsedStatement(balances, mixed, { tolerance: 0.01 }).reasonCodes).toEqual([
      'mixed_currencies',
    ]);
  });
});
