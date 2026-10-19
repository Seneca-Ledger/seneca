import { TransactionType } from '../../../../src/entities/transaction.entity';
import {
  accountKey,
  amountsMatch,
  matchTransferPairs,
  type RateLookup,
  type TransferLeg,
} from '../../../../src/modules/transactions/services/transfer-pairing.matcher';

type LegInput = Partial<TransferLeg> & { id: string };

function leg(input: LegInput): TransferLeg {
  const type = input.transactionType ?? TransactionType.EXPENSE;
  const amount = input.amount ?? 100;
  return {
    transactionDate: new Date('2026-03-10'),
    currency: 'EUR',
    statementId: 'stmt-a',
    walletId: null,
    cryptoWalletId: null,
    statement: null,
    debit: type === TransactionType.EXPENSE ? amount : null,
    credit: type === TransactionType.INCOME ? amount : null,
    ...input,
    transactionType: type,
    amount,
  };
}

const out = (id: string, extra: Partial<TransferLeg> = {}) =>
  leg({ id, transactionType: TransactionType.EXPENSE, statementId: 'stmt-a', ...extra });
const inc = (id: string, extra: Partial<TransferLeg> = {}) =>
  leg({ id, transactionType: TransactionType.INCOME, statementId: 'stmt-b', ...extra });

const noRates: RateLookup = async () => null;

describe('transfer-pairing matcher', () => {
  describe('a chain leg against a bank leg', () => {
    it('allows the exchange’s cut between the money paid and the coin received', async () => {
      const card = out('card', { amount: 505, currency: 'USD' });
      const arrival = inc('coin', {
        amount: 500,
        currency: 'USD',
        cryptoWalletId: 'wallet-1',
        statementId: null,
      });

      expect(await amountsMatch(card, arrival, noRates)).toBe(true);
    });

    it('still refuses a gap wider than the cut', async () => {
      const card = out('card', { amount: 600, currency: 'USD' });
      const arrival = inc('coin', {
        amount: 500,
        currency: 'USD',
        cryptoWalletId: 'wallet-1',
        statementId: null,
      });

      expect(await amountsMatch(card, arrival, noRates)).toBe(false);
    });

    it('keeps two bank legs cent-exact: there is no conversion between them', async () => {
      expect(
        await amountsMatch(
          out('a', { amount: 505, currency: 'USD' }),
          inc('b', { amount: 500, currency: 'USD' }),
          noRates,
        ),
      ).toBe(false);
    });
  });


  describe('accountKey', () => {
    it('prefers the crypto wallet, then the statement account number, then the statement', () => {
      expect(accountKey(leg({ id: 'a', cryptoWalletId: 'cw' }))).toBe('crypto:cw');
      // The default wallet is auto-assigned to every row, so it tells nothing.
      expect(accountKey(leg({ id: 'a', walletId: 'w', statementId: 's1' }))).toBe('statement:s1');
      expect(accountKey(leg({ id: 'a', statement: { accountNumber: ' KZ123 ' } }))).toBe(
        'account:KZ123',
      );
      expect(accountKey(leg({ id: 'a', statementId: 's1' }))).toBe('statement:s1');
      expect(accountKey(leg({ id: 'a', statementId: null }))).toBeNull();
    });
  });

  describe('amountsMatch', () => {
    it('matches to the cent in one currency and never consults a rate', async () => {
      const lookup = jest.fn(noRates);
      expect(await amountsMatch(out('a', { amount: 100 }), inc('b', { amount: 100 }), lookup)).toBe(
        true,
      );
      expect(
        await amountsMatch(out('a', { amount: 100 }), inc('b', { amount: 100.01 }), lookup),
      ).toBe(false);
      expect(lookup).not.toHaveBeenCalled();
    });

    it('converts across currencies with a 2% tolerance', async () => {
      const lookup: RateLookup = async (from, to) => (from === 'USD' && to === 'EUR' ? 0.9 : null);
      const usd = out('a', { amount: 100, currency: 'USD' });
      expect(await amountsMatch(usd, inc('b', { amount: 90 }), lookup)).toBe(true);
      expect(await amountsMatch(usd, inc('b', { amount: 88.5 }), lookup)).toBe(true);
      expect(await amountsMatch(usd, inc('b', { amount: 85 }), lookup)).toBe(false);
    });

    it('refuses cross-currency legs when no rate is known', async () => {
      const usd = out('a', { amount: 100, currency: 'USD' });
      expect(await amountsMatch(usd, inc('b', { amount: 100 }), noRates)).toBe(false);
    });
  });

  describe('matchTransferPairs', () => {
    it('pairs an outgoing and an incoming leg on different accounts', async () => {
      const a = out('a');
      const b = inc('b', { transactionDate: new Date('2026-03-12') });
      const pairs = await matchTransferPairs([a], [a, b], noRates);
      expect(pairs).toEqual([{ outgoing: a, incoming: b }]);
    });

    it('orients the pair by direction even when the incoming leg is checked first', async () => {
      const a = out('a');
      const b = inc('b');
      const pairs = await matchTransferPairs([b], [a, b], noRates);
      expect(pairs).toEqual([{ outgoing: a, incoming: b }]);
    });

    it('does not pair two legs of the same account', async () => {
      const a = out('a', { statementId: 'stmt-a' });
      const b = inc('b', { statementId: 'stmt-a' });
      expect(await matchTransferPairs([a], [a, b], noRates)).toEqual([]);
    });

    it('does not pair legs whose account cannot be told apart', async () => {
      const a = out('a', { statementId: null });
      const b = inc('b', { statementId: null });
      expect(await matchTransferPairs([a], [a, b], noRates)).toEqual([]);
    });

    it('does not pair legs more than three days apart', async () => {
      const a = out('a', { transactionDate: new Date('2026-03-10') });
      const b = inc('b', { transactionDate: new Date('2026-03-14') });
      expect(await matchTransferPairs([a], [a, b], noRates)).toEqual([]);
    });

    it('does not pair two expenses', async () => {
      const a = out('a');
      const b = out('b', { statementId: 'stmt-b' });
      expect(await matchTransferPairs([a], [a, b], noRates)).toEqual([]);
    });

    it('pairs nothing when two counterparts qualify', async () => {
      const a = out('a');
      const b = inc('b');
      const c = inc('c', { statementId: 'stmt-c' });
      expect(await matchTransferPairs([a], [a, b, c], noRates)).toEqual([]);
    });

    it('uses every row at most once', async () => {
      const a = out('a');
      const b = inc('b');
      const c = out('c', { statementId: 'stmt-c' });
      const pairs = await matchTransferPairs([a, c], [a, b, c], noRates);
      expect(pairs).toEqual([{ outgoing: a, incoming: b }]);
    });

    it('pairs across currencies through the rate lookup', async () => {
      const lookup: RateLookup = async (from, to) => (from === 'USD' && to === 'EUR' ? 0.9 : null);
      const a = out('a', { amount: 100, currency: 'USD' });
      const b = inc('b', { amount: 90, currency: 'EUR' });
      expect(await matchTransferPairs([a], [a, b], lookup)).toEqual([
        { outgoing: a, incoming: b },
      ]);
    });

    it('matches independently of the order rows arrive in', async () => {
      const a = out('a', { transactionDate: new Date('2026-03-11') });
      const b = inc('b', { transactionDate: new Date('2026-03-10') });
      const c = out('c', { statementId: 'stmt-c', transactionDate: new Date('2026-03-09') });
      const d = inc('d', { statementId: 'stmt-d', transactionDate: new Date('2026-03-12') });
      // a/b and c/d both qualify for each other, so every row sees two counterparts.
      expect(await matchTransferPairs([d, c, b, a], [a, b, c, d], noRates)).toEqual([]);
    });
  });
});
