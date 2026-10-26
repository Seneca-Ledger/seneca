import {
  normalizeAccountNumber,
  pickWalletForAccount,
  realAccountNumber,
} from '@/modules/wallets/wallet-account-match';

const statementNumber = 'DE00 1234 5678 0000 0001';
const wallet = (id: string, accountNumber: string | null, currency = 'EUR', isActive = true) => ({
  id,
  accountNumber,
  currency,
  isActive,
});

describe('wallet account matching', () => {
  it('ignores spaces, dashes and case', () => {
    expect(normalizeAccountNumber(statementNumber)).toBe(
      normalizeAccountNumber('de00-1234-5678-0000-0001'),
    );
  });

  it('reads the parser placeholder as no account number', () => {
    expect(realAccountNumber('Unknown')).toBeNull();
    expect(realAccountNumber('  ')).toBeNull();
    expect(pickWalletForAccount([wallet('w1', 'Unknown')], 'Unknown', 'EUR')).toBeNull();
  });

  it('matches the full number, or its last four or more characters', () => {
    expect(pickWalletForAccount([wallet('w1', statementNumber)], statementNumber, 'EUR')?.id).toBe(
      'w1',
    );
    expect(pickWalletForAccount([wallet('w1', '0001')], statementNumber, 'eur')?.id).toBe('w1');
    expect(pickWalletForAccount([wallet('w1', '001')], statementNumber, 'EUR')).toBeNull();
  });

  it('needs the same currency and an active account', () => {
    expect(pickWalletForAccount([wallet('w1', '0001', 'USD')], statementNumber, 'EUR')).toBeNull();
    expect(
      pickWalletForAccount([wallet('w1', '0001', 'EUR', false)], statementNumber, 'EUR'),
    ).toBeNull();
  });

  it('leaves an ambiguous match to the user', () => {
    const wallets = [wallet('w1', '0001'), wallet('w2', '00000001')];
    expect(pickWalletForAccount(wallets, statementNumber, 'EUR')).toBeNull();
  });
});
