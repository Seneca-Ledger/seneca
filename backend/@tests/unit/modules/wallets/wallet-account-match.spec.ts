import {
  normalizeAccountNumber,
  pickWalletBySource,
  pickWalletForAccount,
  realAccountNumber,
  statementSource,
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

  describe('by source, for statements with no number', () => {
    const source = statementSource('other', 'ACME Bank', 'date amount memo');
    const linked = (walletId: string, currency = 'EUR', from = source) => ({
      walletId,
      source: from,
      currency,
    });

    it('names a source by its bank and preset, else its header, ignoring case', () => {
      expect(source).toBe(statementSource('OTHER', 'acme bank', null));
      expect(statementSource('other', null, 'Date Amount Memo')).toBe(
        statementSource('other', '', 'date amount memo'),
      );
      expect(statementSource('other', null, '  ')).toBeNull();
    });

    it('takes the one account earlier statements of the source went to', () => {
      const wallets = [wallet('w1', null), wallet('w2', null)];
      expect(pickWalletBySource(wallets, [linked('w1'), linked('w1')], source, 'eur')?.id).toBe(
        'w1',
      );
    });

    it('leaves it to the user when the source feeds two accounts, or none fits', () => {
      const wallets = [wallet('w1', null), wallet('w2', null)];
      expect(pickWalletBySource(wallets, [linked('w1'), linked('w2')], source, 'EUR')).toBeNull();
      expect(pickWalletBySource(wallets, [linked('w1', 'USD')], source, 'EUR')).toBeNull();
      expect(
        pickWalletBySource(
          wallets,
          [linked('w1', 'EUR', statementSource('other', 'Other', null))],
          source,
          'EUR',
        ),
      ).toBeNull();
      expect(pickWalletBySource(wallets, [linked('w1')], null, 'EUR')).toBeNull();
      expect(
        pickWalletBySource([wallet('w1', null, 'EUR', false)], [linked('w1')], source, 'EUR'),
      ).toBeNull();
    });
  });
});
