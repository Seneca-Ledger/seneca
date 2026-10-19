import { buildOfxStatement, ofxFileName } from '../../../../src/modules/bank-sync/bank-sync-ofx.util';
import type { BankSyncAccount } from '../../../../src/modules/bank-sync/bank-sync-provider.interface';
import { parseOfx, sniffStatementFormat } from '../../../../src/modules/parsing/parsers/statement-formats.util';

const account: BankSyncAccount = {
  id: 'ACT-1',
  name: 'Everyday <Checking> & more',
  org: 'Demo Bank',
  currency: 'usd',
  balance: 1234.5,
  balanceDate: new Date('2026-09-30T12:00:00Z'),
  transactions: [],
};

describe('buildOfxStatement', () => {
  it('round-trips through the OFX parser with ids, amounts, names and the balance', () => {
    const text = buildOfxStatement(account, [
      {
        id: 'TRN-1',
        posted: new Date('2026-09-03T10:00:00Z'),
        amount: -42.5,
        description: 'COFFEE CO',
        payee: 'Coffee & Co',
        memo: 'card 1234',
        pending: false,
      },
      {
        id: 'TRN-2',
        posted: new Date('2026-09-25T00:00:00Z'),
        amount: 3000,
        description: 'ACME PAYROLL',
        pending: false,
      },
    ]);

    expect(sniffStatementFormat(text)).toBe('ofx');
    const parsed = parseOfx(text);
    expect(parsed.metadata.accountNumber).toBe('ACT-1');
    expect(parsed.metadata.institution).toBe('Demo Bank');
    expect(parsed.metadata.balanceEnd).toBe(1234.5);
    expect(parsed.transactions).toHaveLength(2);
    expect(parsed.transactions[0]).toMatchObject({
      documentNumber: 'ACT-1:TRN-1',
      counterpartyName: 'Coffee & Co',
      paymentPurpose: 'card 1234',
      debit: 42.5,
      currency: 'usd',
    });
    expect(parsed.transactions[0].transactionDate.toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(parsed.transactions[1]).toMatchObject({
      documentNumber: 'ACT-1:TRN-2',
      counterpartyName: 'ACME PAYROLL',
      credit: 3000,
    });
  });

  it('is still a valid, empty statement without rows', () => {
    const text = buildOfxStatement({ ...account, balance: null }, []);
    const parsed = parseOfx(text);
    expect(parsed.transactions).toEqual([]);
    expect(parsed.metadata.balanceEnd).toBeUndefined();
  });

  it('names the file after the institution and account, safely', () => {
    expect(ofxFileName(account, new Date('2026-10-01T00:00:00Z'))).toBe(
      'demo-bank-everyday-checking-more-20261001.ofx',
    );
  });
});
